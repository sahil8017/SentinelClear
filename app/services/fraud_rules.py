"""Individual fraud detection rules — each returns a score contribution.

Every rule is a standalone async function that receives transaction context
and returns a RuleResult. The fraud orchestrator in fraud.py calls all
enabled rules, multiplies each score by its configured weight, and sums
them into a composite risk score.

Rule design principles:
  - Each rule checks ONE signal (single responsibility)
  - Scores are normalised to [0.0, 1.0]
  - Rules query the DB directly for behavioural context
  - Rules are stateless — all state lives in Postgres/Redis
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, Transfer

logger = logging.getLogger("sentinelclear.fraud.rules")


@dataclass
class RuleResult:
    rule_name: str
    triggered: bool
    score: float        # 0.0 to 1.0
    reason: str


# ═══════════════════════════════════════════════════════════════════
# RULE 1: Amount Threshold
# ═══════════════════════════════════════════════════════════════════

async def check_amount_threshold(
    amount: float,
    threshold: float,
    **kwargs,
) -> RuleResult:
    """Flag transactions exceeding the configured amount threshold.

    Scores scale linearly: at threshold → 0.5, at 2× threshold → 1.0.
    """
    amount = float(amount)
    threshold = float(threshold)
    if amount <= threshold:
        ratio = amount / threshold if threshold > 0 else 0.0
        return RuleResult(
            rule_name="amount_threshold",
            triggered=False,
            score=round(ratio * 0.3, 4),  # sub-threshold still contributes minor score
            reason=f"Amount ₹{amount:,.2f} within threshold ₹{threshold:,.2f}",
        )

    # Scale: threshold → 0.9, 2×threshold → 1.0 (Aggressive for exceeding limit)
    overshoot = min(amount / threshold, 2.0)
    score = round(0.9 + (overshoot - 1.0) * 0.1, 4)

    return RuleResult(
        rule_name="amount_threshold",
        triggered=True,
        score=min(score, 1.0),
        reason=f"Amount ₹{amount:,.2f} exceeds threshold ₹{threshold:,.2f}",
    )


# ═══════════════════════════════════════════════════════════════════
# RULE 2: Velocity — too many transfers in a short window
# ═══════════════════════════════════════════════════════════════════

async def check_velocity(
    db: AsyncSession,
    sender_account_id: str,
    max_transfers: int,
    window_seconds: int,
    **kwargs,
) -> RuleResult:
    """Flag accounts making too many transfers in a sliding window."""
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=window_seconds)

    result = await db.execute(
        select(func.count(Transfer.id))
        .where(
            and_(
                Transfer.sender_account_id == sender_account_id,
                Transfer.created_at >= cutoff,
                Transfer.status.in_(["COMPLETED", "FLAGGED"]),
            )
        )
    )
    count = result.scalar() or 0

    if count < max_transfers:
        return RuleResult(
            rule_name="velocity",
            triggered=False,
            score=round(count / max_transfers * 0.3, 4),
            reason=f"{count}/{max_transfers} transfers in {window_seconds}s window",
        )

    # Score scales with how far over the limit, starting at 0.85
    overshoot = min(count / max_transfers, 3.0)
    score = round(0.85 + (overshoot - 1.0) * 0.075, 4)

    return RuleResult(
        rule_name="velocity",
        triggered=True,
        score=min(score, 1.0),
        reason=f"{count} transfers in {window_seconds}s exceeds limit of {max_transfers}",
    )


# ═══════════════════════════════════════════════════════════════════
# RULE 2.1: Burst Velocity — rapid fire transfers in < 60s
# ═══════════════════════════════════════════════════════════════════

async def check_burst_velocity(
    db: AsyncSession,
    sender_account_id: str,
    max_burst: int = 3,
    **kwargs,
) -> RuleResult:
    """Flag accounts making 3+ transfers in 60 seconds."""
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=60)

    result = await db.execute(
        select(func.count(Transfer.id))
        .where(
            and_(
                Transfer.sender_account_id == sender_account_id,
                Transfer.created_at >= cutoff,
                Transfer.status.in_(["COMPLETED", "FLAGGED"]),
            )
        )
    )
    count = result.scalar() or 0

    if count < max_burst:
        return RuleResult(
            rule_name="burst_velocity",
            triggered=False,
            score=0.1 if count > 1 else 0.0,
            reason=f"{count}/{max_burst} transfers in 60s",
        )

    return RuleResult(
        rule_name="burst_velocity",
        triggered=True,
        score=0.95,  # Extreme risk for instant bursts
        reason=f"DETECTED BURST: {count} transfers in 60s (threshold: {max_burst})",
    )




# ═══════════════════════════════════════════════════════════════════
# RULE 4: New Account Risk — young account making large transfers
# ═══════════════════════════════════════════════════════════════════

async def check_new_account(
    db: AsyncSession,
    sender_account_id: str,
    amount: float,
    max_age_hours: int,
    amount_threshold: float,
    **kwargs,
) -> RuleResult:
    """Flag brand-new accounts making large transfers."""
    amount = float(amount)
    amount_threshold = float(amount_threshold)
    result = await db.execute(
        select(Account.created_at).where(Account.id == sender_account_id)
    )
    created_at = result.scalar_one_or_none()

    if created_at is None:
        return RuleResult(
            rule_name="new_account",
            triggered=False,
            score=0.0,
            reason="Account not found",
        )

    age = datetime.now(timezone.utc).replace(tzinfo=None) - created_at
    age_hours = age.total_seconds() / 3600

    if age_hours >= max_age_hours or amount <= amount_threshold:
        return RuleResult(
            rule_name="new_account",
            triggered=False,
            score=0.0,
            reason=f"Account age {age_hours:.1f}h, amount ₹{amount:,.2f}",
        )

    # Newer account + higher amount = higher score (starting at 0.8)
    age_factor = 1.0 - (age_hours / max_age_hours)
    amount_factor = min(amount / amount_threshold, 2.0) / 2.0
    score = round(0.8 + (age_factor * amount_factor * 0.2), 4)

    return RuleResult(
        rule_name="new_account",
        triggered=True,
        score=min(score, 1.0),
        reason=f"Account {age_hours:.1f}h old making ₹{amount:,.2f} transfer (threshold: {max_age_hours}h, ₹{amount_threshold:,.2f})",
    )


# ═══════════════════════════════════════════════════════════════════
# RULE 5: Time-of-Day — transfers at unusual hours
# ═══════════════════════════════════════════════════════════════════

async def check_time_of_day(
    night_start: int,
    night_end: int,
    **kwargs,
) -> RuleResult:
    """Flag transfers made during unusual hours (default: 1 AM – 5 AM)."""
    current_hour = datetime.now(ZoneInfo("Asia/Kolkata")).hour

    if not (night_start <= current_hour < night_end):
        return RuleResult(
            rule_name="time_of_day",
            triggered=False,
            score=0.0,
            reason=f"Transfer at {current_hour}:00 — normal hours",
        )

    return RuleResult(
        rule_name="time_of_day",
        triggered=True,
        score=0.75,
        reason=f"Transfer at {current_hour}:00 — unusual hours ({night_start}:00–{night_end}:00)",
    )




# ═══════════════════════════════════════════════════════════════════
# RULE 7: Impossible Travel — Geolocation velocity anomaly
# ═══════════════════════════════════════════════════════════════════

async def check_impossible_travel_rule(
    db: AsyncSession,
    sender_account_id: str,
    current_city: str,
    speed_threshold: float = 800.0,
) -> RuleResult:
    """Flag transfers from physically impossible geographic locations."""
    if not current_city:
        return RuleResult(rule_name="impossible_travel", triggered=False, score=0.0, reason="No current city data")

    from app.services.geo import check_impossible_travel
    from datetime import datetime

    # Get the last successful transfer from this user
    result = await db.execute(
        select(Transfer)
        .where(Transfer.sender_account_id == sender_account_id)
        .where(Transfer.source_city.isnot(None))
        .order_by(Transfer.created_at.desc())
        .limit(1)
    )
    last_transfer = result.scalar_one_or_none()

    if not last_transfer or not last_transfer.source_city:
        return RuleResult(rule_name="impossible_travel", triggered=False, score=0.0, reason="No previous location history")

    time_delta = (datetime.now(timezone.utc).replace(tzinfo=None) - last_transfer.created_at).total_seconds()
    
    geo_res = check_impossible_travel(
        current_city=current_city,
        previous_city=last_transfer.source_city,
        time_delta_seconds=time_delta,
        speed_threshold=speed_threshold
    )

    if not geo_res["is_impossible"]:
        return RuleResult(
            rule_name="impossible_travel",
            triggered=False,
            score=0.0,
            reason=f"Plausible travel: {geo_res['distance_km']}km in {geo_res['time_gap_minutes']} mins (req: {geo_res['required_speed_kmh']} km/h, max: {speed_threshold} km/h)",
        )

    return RuleResult(
        rule_name="impossible_travel",
        triggered=True,
        score=0.99,  # High confidence critical block
        reason=f"Impossible Travel: {last_transfer.source_city} → {current_city} in {geo_res['time_gap_minutes']} mins (req: {geo_res['required_speed_kmh']} km/h, max: {speed_threshold} km/h)",
    )
