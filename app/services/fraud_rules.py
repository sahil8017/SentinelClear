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
from datetime import datetime, timedelta

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
    if amount <= threshold:
        ratio = amount / threshold if threshold > 0 else 0.0
        return RuleResult(
            rule_name="amount_threshold",
            triggered=False,
            score=round(ratio * 0.3, 4),  # sub-threshold still contributes minor score
            reason=f"Amount ₹{amount:,.2f} within threshold ₹{threshold:,.2f}",
        )

    # Scale: threshold → 0.5, 2×threshold → 1.0
    overshoot = min(amount / threshold, 2.0)
    score = round(0.5 + (overshoot - 1.0) * 0.5, 4)

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
    cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)

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

    # Score scales with how far over the limit
    overshoot = min(count / max_transfers, 3.0)
    score = round(0.5 + (overshoot - 1.0) * 0.25, 4)

    return RuleResult(
        rule_name="velocity",
        triggered=True,
        score=min(score, 1.0),
        reason=f"{count} transfers in {window_seconds}s exceeds limit of {max_transfers}",
    )


# ═══════════════════════════════════════════════════════════════════
# RULE 3: Daily Volume — total outflow exceeds daily limit
# ═══════════════════════════════════════════════════════════════════

async def check_daily_volume(
    db: AsyncSession,
    sender_account_id: str,
    amount: float,
    daily_limit: float,
    **kwargs,
) -> RuleResult:
    """Flag when cumulative daily outflow exceeds configured limit."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(func.coalesce(func.sum(Transfer.amount), 0.0))
        .where(
            and_(
                Transfer.sender_account_id == sender_account_id,
                Transfer.created_at >= today_start,
                Transfer.status == "COMPLETED",
            )
        )
    )
    today_total = float(result.scalar()) + amount  # include current transfer

    if today_total <= daily_limit:
        return RuleResult(
            rule_name="daily_volume",
            triggered=False,
            score=round(today_total / daily_limit * 0.3, 4),
            reason=f"Daily volume ₹{today_total:,.2f} within limit ₹{daily_limit:,.2f}",
        )

    overshoot = min(today_total / daily_limit, 2.0)
    score = round(0.5 + (overshoot - 1.0) * 0.5, 4)

    return RuleResult(
        rule_name="daily_volume",
        triggered=True,
        score=min(score, 1.0),
        reason=f"Daily outflow ₹{today_total:,.2f} exceeds limit ₹{daily_limit:,.2f}",
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

    age = datetime.utcnow() - created_at
    age_hours = age.total_seconds() / 3600

    if age_hours >= max_age_hours or amount <= amount_threshold:
        return RuleResult(
            rule_name="new_account",
            triggered=False,
            score=0.0,
            reason=f"Account age {age_hours:.1f}h, amount ₹{amount:,.2f}",
        )

    # Newer account + higher amount = higher score
    age_factor = 1.0 - (age_hours / max_age_hours)
    amount_factor = min(amount / amount_threshold, 2.0) / 2.0
    score = round(0.5 + (age_factor * amount_factor * 0.5), 4)

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
    current_hour = datetime.utcnow().hour

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
        score=0.6,
        reason=f"Transfer at {current_hour}:00 — unusual hours ({night_start}:00–{night_end}:00)",
    )


# ═══════════════════════════════════════════════════════════════════
# RULE 6: Recipient Concentration — repeated transfers to same target
# ═══════════════════════════════════════════════════════════════════

async def check_recipient_concentration(
    db: AsyncSession,
    sender_account_id: str,
    receiver_account_id: str,
    max_transfers: int,
    window_seconds: int,
    **kwargs,
) -> RuleResult:
    """Flag repeated transfers to the same recipient — potential structuring."""
    cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)

    result = await db.execute(
        select(func.count(Transfer.id))
        .where(
            and_(
                Transfer.sender_account_id == sender_account_id,
                Transfer.receiver_account_id == receiver_account_id,
                Transfer.created_at >= cutoff,
                Transfer.status.in_(["COMPLETED", "FLAGGED"]),
            )
        )
    )
    count = result.scalar() or 0

    if count < max_transfers:
        return RuleResult(
            rule_name="recipient_concentration",
            triggered=False,
            score=round(count / max_transfers * 0.2, 4),
            reason=f"{count}/{max_transfers} transfers to same recipient in {window_seconds}s",
        )

    overshoot = min(count / max_transfers, 3.0)
    score = round(0.5 + (overshoot - 1.0) * 0.25, 4)

    return RuleResult(
        rule_name="recipient_concentration",
        triggered=True,
        score=min(score, 1.0),
        reason=f"{count} transfers to same recipient in {window_seconds}s exceeds limit of {max_transfers}",
    )
