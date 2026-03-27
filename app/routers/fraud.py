"""Fraud router — dashboard stats + runtime rule configuration."""

import json
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import FraudRuleConfig, Transfer, User
from app.schemas import (
    FraudDashboardResponse,
    FraudRuleConfigOut,
    FraudRuleConfigUpdate,
    TransferOut,
)

router = APIRouter(prefix="/fraud", tags=["Fraud Detection"])


@router.get("/dashboard", response_model=FraudDashboardResponse)
async def fraud_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Real-time fraud detection statistics and analytics.

    Returns transfer counts by status, top triggered rules, recent
    flagged transfers, and risk score distribution.
    """
    # ── Transfer counts by status ──
    total_result = await db.execute(select(func.count(Transfer.id)))
    total = total_result.scalar() or 0

    completed_result = await db.execute(
        select(func.count(Transfer.id)).where(Transfer.status == "COMPLETED")
    )
    completed = completed_result.scalar() or 0

    flagged_result = await db.execute(
        select(func.count(Transfer.id)).where(Transfer.status == "FLAGGED")
    )
    flagged = flagged_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count(Transfer.id)).where(Transfer.status == "FAILED")
    )
    failed = failed_result.scalar() or 0

    flagged_rate = round(flagged / total, 4) if total > 0 else 0.0

    # ── Top rules triggered ──
    rule_result = await db.execute(
        select(Transfer.fraud_rules_triggered)
        .where(Transfer.fraud_rules_triggered.isnot(None))
    )
    all_rules: list[str] = []
    for row in rule_result.fetchall():
        try:
            rules = json.loads(row[0])
            all_rules.extend(rules)
        except (json.JSONDecodeError, TypeError):
            pass

    rule_counts = Counter(all_rules)
    top_rules = [
        {"rule": rule, "count": count}
        for rule, count in rule_counts.most_common(10)
    ]

    # ── Recent flagged transfers ──
    recent_result = await db.execute(
        select(Transfer)
        .where(Transfer.status == "FLAGGED")
        .order_by(Transfer.created_at.desc())
        .limit(10)
    )
    recent_flagged = recent_result.scalars().all()

    # ── Risk distribution ──
    distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    dist_result = await db.execute(
        select(Transfer.risk_score).where(Transfer.risk_score.isnot(None))
    )
    for row in dist_result.fetchall():
        score = row[0]
        if score < 0.25:
            distribution["low"] += 1
        elif score < 0.5:
            distribution["medium"] += 1
        elif score < 0.75:
            distribution["high"] += 1
        else:
            distribution["critical"] += 1

    return FraudDashboardResponse(
        total_transfers=total,
        completed=completed,
        flagged=flagged,
        failed=failed,
        flagged_rate=flagged_rate,
        top_rules_triggered=top_rules,
        recent_flagged=recent_flagged,
        risk_distribution=distribution,
    )


# ── Rule Configuration CRUD ─────────────────────────────────────


@router.get("/rules", response_model=list[FraudRuleConfigOut])
async def list_fraud_rules(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all fraud detection rules with their current weights and status."""
    result = await db.execute(
        select(FraudRuleConfig).order_by(FraudRuleConfig.rule_name)
    )
    return result.scalars().all()


@router.put("/rules/{rule_name}", response_model=FraudRuleConfigOut)
async def update_fraud_rule(
    rule_name: str,
    body: FraudRuleConfigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a fraud rule's weight, enabled status, or threshold.

    This enables the detect → review → tune → re-detect feedback loop
    without redeployment. Changes take effect on the next transaction.
    """
    result = await db.execute(
        select(FraudRuleConfig).where(FraudRuleConfig.rule_name == rule_name)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_name}' not found")

    if body.weight is not None:
        config.weight = body.weight
    if body.enabled is not None:
        config.enabled = body.enabled
    if body.threshold_value is not None:
        config.threshold_value = body.threshold_value

    await db.commit()
    await db.refresh(config)
    return config
