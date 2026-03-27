"""Fraud detection orchestrator — runs all enabled rules, computes composite score.

Replaces the previous zero-padded ML model with a self-contained,
database-driven rule engine that uses data we actually capture.

The orchestrator:
  1. Loads rule configs from DB (with defaults from Settings)
  2. Runs each enabled rule in parallel
  3. Multiplies each rule's score by its configured weight
  4. Normalises to [0.0, 1.0] composite score
  5. Returns ALLOW / REVIEW / BLOCK decision
"""

import json
import logging
from dataclasses import asdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import FraudRuleConfig
from app.services.fraud_rules import (
    RuleResult,
    check_amount_threshold,
    check_velocity,
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


async def _load_rule_configs(db: AsyncSession) -> dict[str, FraudRuleConfig]:
    """Load all rule configs from DB, keyed by rule_name."""
    result = await db.execute(select(FraudRuleConfig))
    configs = result.scalars().all()
    return {c.rule_name: c for c in configs}


async def score_transaction(
    db: AsyncSession,
    sender_account_id: str,
    receiver_account_id: str,
    amount: float,
) -> dict:
    """Run all enabled fraud rules and return composite decision.

    Returns:
        {
            "decision": "ALLOW" | "REVIEW" | "BLOCK",
            "risk_score": float,          # [0.0, 1.0]
            "is_fraud": bool,             # True if BLOCK
            "rules_triggered": [str],     # names of rules that fired
            "rule_details": [...]         # full RuleResult for each rule
        }
    """
    configs = await _load_rule_configs(db)

    # If no configs loaded (fresh DB), use defaults
    if not configs:
        await seed_rule_configs(db)
        configs = await _load_rule_configs(db)

    rule_results: list[RuleResult] = []

    # ── Run each rule ──────────────────────────────────────────

    cfg = configs.get("amount_threshold")
    if cfg and cfg.enabled:
        threshold = cfg.threshold_value or settings.FRAUD_AMOUNT_THRESHOLD
        result = await check_amount_threshold(amount=amount, threshold=threshold)
        rule_results.append(result)

    cfg = configs.get("velocity")
    if cfg and cfg.enabled:
        result = await check_velocity(
            db=db,
            sender_account_id=sender_account_id,
            max_transfers=settings.FRAUD_VELOCITY_MAX,
            window_seconds=settings.FRAUD_VELOCITY_WINDOW,
        )
        rule_results.append(result)

    cfg = configs.get("daily_volume")
    if cfg and cfg.enabled:
        result = await check_daily_volume(
            db=db,
            sender_account_id=sender_account_id,
            amount=amount,
            daily_limit=cfg.threshold_value or settings.FRAUD_DAILY_VOLUME_LIMIT,
        )
        rule_results.append(result)

    cfg = configs.get("new_account")
    if cfg and cfg.enabled:
        result = await check_new_account(
            db=db,
            sender_account_id=sender_account_id,
            amount=amount,
            max_age_hours=settings.FRAUD_NEW_ACCOUNT_HOURS,
            amount_threshold=cfg.threshold_value or settings.FRAUD_NEW_ACCOUNT_AMOUNT,
        )
        rule_results.append(result)

    cfg = configs.get("time_of_day")
    if cfg and cfg.enabled:
        result = await check_time_of_day(
            night_start=settings.FRAUD_NIGHT_START,
            night_end=settings.FRAUD_NIGHT_END,
        )
        rule_results.append(result)

    cfg = configs.get("recipient_concentration")
    if cfg and cfg.enabled:
        result = await check_recipient_concentration(
            db=db,
            sender_account_id=sender_account_id,
            receiver_account_id=receiver_account_id,
            max_transfers=settings.FRAUD_RECIPIENT_MAX,
            window_seconds=settings.FRAUD_RECIPIENT_WINDOW,
        )
        rule_results.append(result)

    # ── Compute weighted composite score ───────────────────────

    weighted_sum = 0.0
    total_weight = 0.0
    rules_triggered = []

    for rr in rule_results:
        cfg = configs.get(rr.rule_name)
        weight = cfg.weight if cfg else 1.0
        weighted_sum += rr.score * weight
        total_weight += weight
        if rr.triggered:
            rules_triggered.append(rr.rule_name)

    # normalise to [0.0, 1.0]
    risk_score = round(weighted_sum / total_weight, 6) if total_weight > 0 else 0.0
    risk_score = min(risk_score, 1.0)

    # ── Decision ──────────────────────────────────────────────

    if risk_score >= settings.FRAUD_BLOCK_THRESHOLD:
        decision = "BLOCK"
    elif risk_score >= settings.FRAUD_REVIEW_THRESHOLD:
        decision = "REVIEW"
    else:
        decision = "ALLOW"

    is_fraud = decision == "BLOCK"

    if rules_triggered:
        logger.info(
            "Fraud scored: amount=%.2f score=%.4f decision=%s rules=%s",
            amount, risk_score, decision, rules_triggered,
        )

    return {
        "decision": decision,
        "risk_score": risk_score,
        "is_fraud": is_fraud,
        "rules_triggered": rules_triggered,
        "rule_details": [asdict(rr) for rr in rule_results],
    }
