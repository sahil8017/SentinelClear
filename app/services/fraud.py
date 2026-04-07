"""Fraud detection orchestrator — hybrid rule engine + ML model scoring.

Combines a database-driven rule engine (Layer 1) with a trained
RandomForestClassifier (Layer 2) to produce a composite risk score.

Pipeline:
  1. Load rule configs from DB (with defaults from Settings)
  2. Run each enabled rule in parallel → weighted rule score
  3. Run ML inference → P(fraud) probability
  4. Compute composite: max(rule_score, ml_score * ops_multiplier)
  5. Return ALLOW / REVIEW / BLOCK decision
"""

import logging
from dataclasses import asdict

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
from app.services.ml_service import predict_risk_score, is_model_loaded

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
        "threshold_value": 3,
        "description": "Flag accounts making 3+ transfers in 60 seconds",
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


async def _compute_ml_features(
    db: AsyncSession,
    sender_account_id: str,
    receiver_account_id: str,
    amount: float,
) -> dict:
    """Extract features required by the ML model from current transaction context."""
    sender_account = await db.scalar(select(Account).where(Account.id == sender_account_id))
    receiver_account = await db.scalar(select(Account).where(Account.id == receiver_account_id))
    
    return {
        "amount": amount,
        "oldbalanceOrg": float(sender_account.balance) if sender_account else 0.0,
        "oldbalanceDest": float(receiver_account.balance) if receiver_account else 0.0,
        "is_transfer": True, # Assume everything routed through fraud engine is transferring funds currently
    }


async def score_transaction(
    db: AsyncSession,
    sender_account_id: str,
    receiver_account_id: str,
    amount: float,
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

    cfg = configs.get("burst_velocity")
    if cfg and cfg.enabled:
        result = await check_burst_velocity(
            db=db,
            sender_account_id=sender_account_id,
            max_burst=int(cfg.threshold_value or 3),
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

    # ── Compute weighted rule-engine score ─────────────────────

    rules_triggered = [rr.rule_name for rr in rule_results if rr.triggered]
    if rules_triggered:
        # Aggressive: Use the highest single risk score
        rule_score = max(rr.score for rr in rule_results if rr.triggered)
    else:
        # Non-Triggered Aggregation (Fuzzy OR)
        # Prevents risk dilution via averaging
        risk_product = 1.0
        for rr in rule_results:
            risk_product *= (1.0 - rr.score)
        rule_score = 1.0 - risk_product

    rule_score = round(min(rule_score, 1.0), 4)

    # ══════════════════════════════════════════════════════════════
    # LAYER 2: ML MODEL INFERENCE
    # ══════════════════════════════════════════════════════════════

    ml_risk_score = 0.0

    if is_model_loaded():
        ml_features = await _compute_ml_features(
            db, sender_account_id, receiver_account_id, amount
        )
        ml_risk_score = predict_risk_score(**ml_features)

        # Compute ops_multiplier: average weight of all enabled rules
        # This lets admin slider positions influence the ML threshold
        enabled_weights = [
            c.weight for c in configs.values() if c.enabled
        ]
        ops_multiplier = (
            sum(enabled_weights) / len(enabled_weights)
            if enabled_weights
            else 1.0
        )

        ml_adjusted = ml_risk_score * ops_multiplier

        # Hybrid composite: take the more severe signal
        risk_score = round(min(max(rule_score, ml_adjusted), 1.0), 4)

        logger.info(
            "Hybrid scoring: rule=%.4f  ml_raw=%.4f  ops_mult=%.2f  ml_adj=%.4f  composite=%.4f",
            rule_score, ml_risk_score, ops_multiplier, ml_adjusted, risk_score,
        )
    else:
        # Fallback: rule-engine only
        risk_score = rule_score

    # ── Decision ──────────────────────────────────────────────

    if risk_score >= settings.FRAUD_BLOCK_THRESHOLD:
        decision = "BLOCK"
    elif risk_score >= settings.FRAUD_REVIEW_THRESHOLD:
        decision = "REVIEW"
    else:
        decision = "ALLOW"

    is_fraud = decision == "BLOCK"

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
