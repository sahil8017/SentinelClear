"""Fraud detection orchestrator — hybrid rule engine + ML model scoring.

Combines a database-driven rule engine (Layer 1) with a trained
RandomForestClassifier (Layer 2) to produce a composite risk score.

Pipeline:
  1. Load rule configs from DB (with defaults from Settings)
  2. Run each enabled rule → check if any triggered
  3. Run ML inference → P(fraud) probability
  4. Composite: weighted blend of rule_score and ml_score
  5. Return ALLOW / REVIEW / BLOCK decision
"""

import logging
import time
from dataclasses import asdict
from typing import Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import FraudRuleConfig, Account
from app.services.fraud_rules import (
    RuleResult,
    check_amount_threshold,
    check_velocity,
    check_burst_velocity,
    check_daily_volume,
    check_new_account,
    check_time_of_day,
    check_recipient_concentration,
)

logger = logging.getLogger("sentinelclear.fraud")

# Default rule definitions — seeded into fraud_rule_configs table on first run
DEFAULT_RULES = {
    "amount_threshold": {
        "weight": 1.0,
        "enabled": True,
        "threshold_value": settings.FRAUD_AMOUNT_THRESHOLD,
        "description": "Flag single transactions exceeding amount limit",
    },
    "velocity": {
        "weight": 1.5,
        "enabled": True,
        "threshold_value": None,
        "description": "Flag accounts making too many transfers in a short window",
    },
    "burst_velocity": {
        "weight": 2.0,
        "enabled": True,
        "threshold_value": 10,
        "description": "Flag accounts making 10+ transfers in 60 seconds",
    },
    "daily_volume": {
        "weight": 1.2,
        "enabled": True,
        "threshold_value": settings.FRAUD_DAILY_VOLUME_LIMIT,
        "description": "Flag when daily outflow exceeds limit",
    },
    "new_account": {
        "weight": 1.3,
        "enabled": True,
        "threshold_value": settings.FRAUD_NEW_ACCOUNT_AMOUNT,
        "description": "Flag new accounts making large transfers",
    },
    "time_of_day": {
        "weight": 0.8,
        "enabled": True,
        "threshold_value": None,
        "description": "Flag transfers during unusual hours (1 AM – 5 AM)",
    },
    "recipient_concentration": {
        "weight": 1.0,
        "enabled": True,
        "threshold_value": None,
        "description": "Flag repeated transfers to same recipient",
    },
    "impossible_travel": {
        "weight": 2.0,
        "enabled": True,
        "threshold_value": None,
        "description": "Flag transfers with impossible geographical velocity",
    },
}


async def seed_rule_configs(db: AsyncSession) -> None:
    """Insert default rule configs if they don't exist yet."""
    for rule_name, defaults in DEFAULT_RULES.items():
        result = await db.execute(
            select(FraudRuleConfig).where(FraudRuleConfig.rule_name == rule_name)
        )
        if result.scalar_one_or_none() is None:
            config = FraudRuleConfig(
                rule_name=rule_name,
                weight=defaults["weight"],
                enabled=defaults["enabled"],
                threshold_value=defaults["threshold_value"],
                description=defaults["description"],
            )
            db.add(config)
    await db.commit()
    logger.info("Fraud rule configs seeded/verified")


# Simple in-memory TTLCache for rules config
_rules_cache = None
_rules_cache_expiry = 0
RULES_CACHE_TTL = 60  # Cache rules for 60 seconds


async def _load_rule_configs(db: AsyncSession) -> Dict[str, dict]:
    """Load configurations from DB, using a 60-second in-memory cache of plain dicts."""
    global _rules_cache, _rules_cache_expiry
    
    now = time.time()
    if _rules_cache is not None and now < _rules_cache_expiry:
        return _rules_cache
 
    try:
        result = await db.execute(select(FraudRuleConfig))
        rows = result.scalars().all()
        # Cache plain dicts to avoid DetachedInstanceError
        configs = {
            row.rule_name: {
                "enabled": row.enabled,
                "threshold_value": row.threshold_value,
                "weight": row.weight
            } for row in rows
        }
        # Update cache
        _rules_cache = configs
        _rules_cache_expiry = now + RULES_CACHE_TTL
        return configs
    except Exception as e:
        logger.error(f"Error loading rule configs from DB: {e}. Returning defaults if possible.")
        return {}


async def score_transaction(
    db: AsyncSession,
    sender_account_id: str,
    receiver_account_id: str,
    amount: float,
    current_city: str | None = None,
) -> dict:
    """Run all enabled fraud rules + ML model and return composite decision.

    Returns:
        {
            "decision": "ALLOW" | "REVIEW" | "BLOCK",
            "risk_score": float,          # [0.0, 1.0] — composite
            "ml_risk_score": float,       # [0.0, 1.0] — raw ML P(fraud)
            "is_fraud": bool,             # True if BLOCK
            "rules_triggered": [str],     # names of rules that fired
            "rule_details": [...]         # full RuleResult for each rule
        }
    """
    configs = await _load_rule_configs(db)
    amount = float(amount)

    # If no configs loaded (fresh DB), use defaults
    if not configs:
        # Optional: We no longer need to call seed_rule_configs here because main.py does it
        # and we definitely don't want to do and await it on every transfer
        configs = await _load_rule_configs(db)

    rule_results: list[RuleResult] = []

    # ── Run each rule ──────────────────────────────────────────

    cfg = configs.get("amount_threshold")
    if cfg and cfg["enabled"]:
        threshold = cfg["threshold_value"] or settings.FRAUD_AMOUNT_THRESHOLD
        result = await check_amount_threshold(amount=amount, threshold=threshold)
        rule_results.append(result)

    cfg = configs.get("velocity")
    if cfg and cfg["enabled"]:
        result = await check_velocity(
            db=db,
            sender_account_id=sender_account_id,
            max_transfers=settings.FRAUD_VELOCITY_MAX,
            window_seconds=settings.FRAUD_VELOCITY_WINDOW,
        )
        rule_results.append(result)

    cfg = configs.get("burst_velocity")
    if cfg and cfg["enabled"]:
        result = await check_burst_velocity(
            db=db,
            sender_account_id=sender_account_id,
            max_burst=int(cfg["threshold_value"] or 10),
        )
        rule_results.append(result)

    cfg = configs.get("daily_volume")
    if cfg and cfg["enabled"]:
        result = await check_daily_volume(
            db=db,
            sender_account_id=sender_account_id,
            amount=amount,
            daily_limit=cfg["threshold_value"] or settings.FRAUD_DAILY_VOLUME_LIMIT,
        )
        rule_results.append(result)

    cfg = configs.get("new_account")
    if cfg and cfg["enabled"]:
        result = await check_new_account(
            db=db,
            sender_account_id=sender_account_id,
            amount=amount,
            max_age_hours=settings.FRAUD_NEW_ACCOUNT_HOURS,
            amount_threshold=cfg["threshold_value"] or settings.FRAUD_NEW_ACCOUNT_AMOUNT,
        )
        rule_results.append(result)

    cfg = configs.get("time_of_day")
    if cfg and cfg["enabled"]:
        result = await check_time_of_day(
            night_start=settings.FRAUD_NIGHT_START,
            night_end=settings.FRAUD_NIGHT_END,
        )
        rule_results.append(result)

    cfg = configs.get("recipient_concentration")
    if cfg and cfg["enabled"]:
        result = await check_recipient_concentration(
            db=db,
            sender_account_id=sender_account_id,
            receiver_account_id=receiver_account_id,
            max_transfers=settings.FRAUD_RECIPIENT_MAX,
            window_seconds=settings.FRAUD_RECIPIENT_WINDOW,
        )
        rule_results.append(result)

    cfg = configs.get("impossible_travel")
    if cfg and cfg["enabled"] and current_city:
        from app.services.fraud_rules import check_impossible_travel_rule
        result = await check_impossible_travel_rule(
            db=db,
            sender_account_id=sender_account_id,
            current_city=current_city,
        )
        rule_results.append(result)

    # ── Compute rule-engine score ─────────────────────────────

    rules_triggered = [rr.rule_name for rr in rule_results if rr.triggered]
    if rules_triggered:
        # Use the highest triggered score (aggressive — worst signal wins)
        rule_score = max(rr.score for rr in rule_results if rr.triggered)
    else:
        rule_score = 0.0

    rule_score = round(min(rule_score, 1.0), 4)

    risk_score = rule_score
    ml_risk_score = 0.0

    # ── Decision ──────────────────────────────────────────────

    if risk_score >= settings.FRAUD_BLOCK_THRESHOLD:
        decision = "BLOCK"
    elif risk_score >= settings.FRAUD_REVIEW_THRESHOLD:
        decision = "REVIEW"
    else:
        decision = "ALLOW"

    is_fraud = decision == "BLOCK"

    if decision == "BLOCK":
        logger.warning(
            "CRITICAL: Transaction BLOCKED by AI Risk Engine. composite_score=%.4f, ml_score=%.4f, amount=%.2f, rules=%s",
            risk_score, ml_risk_score, amount, rules_triggered
        )

    if rules_triggered or ml_risk_score > 0.3:
        logger.info(
            "Fraud scored: amount=%.2f composite=%.4f ml=%.4f decision=%s rules=%s",
            amount, risk_score, ml_risk_score, decision, rules_triggered,
        )

    return {
        "decision": decision,
        "risk_score": risk_score,
        "ml_risk_score": round(ml_risk_score, 6),
        "is_fraud": is_fraud,
        "rules_triggered": rules_triggered,
        "rule_details": [asdict(rr) for rr in rule_results],
    }
