"""Fraud router — dashboard stats + runtime rule configuration."""

import json
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, get_read_db
from app.dependencies import require_admin
from app.models import FraudRuleConfig, Transfer, User
from app.services.str_generator import generate_fiu_str_pdf
from fastapi.responses import Response
from app.schemas import (
    FraudDashboardResponse,
    FraudRuleConfigOut,
    FraudRuleConfigUpdate,
    TransferOut,
)

router = APIRouter(prefix="/fraud", tags=["Fraud Detection"])


@router.get("/metrics")
async def fraud_metrics(
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight metrics endpoint for polling — returns counts and avg score."""
    total_result = await db.execute(select(func.count(Transfer.id)))
    total = total_result.scalar() or 0

    flagged_result = await db.execute(
        select(func.count(Transfer.id)).where(Transfer.status == "FLAGGED")
    )
    flagged = flagged_result.scalar() or 0

    avg_score_result = await db.execute(
        select(func.avg(Transfer.risk_score)).where(Transfer.risk_score.isnot(None))
    )
    avg_score = float(avg_score_result.scalar() or 0.0)

    avg_ml_result = await db.execute(
        select(func.avg(Transfer.ml_risk_score)).where(Transfer.ml_risk_score.isnot(None))
    )
    avg_ml_score = float(avg_ml_result.scalar() or 0.0)

    return {
        "total": total,
        "flagged_count": flagged,
        "avg_score": round(avg_score, 6),
        "avg_ml_score": round(avg_ml_score, 6),
        "flagged_rate": round(flagged / total, 4) if total > 0 else 0.0,
    }


@router.get("/metrics/timeline")
async def fraud_metrics_timeline(
    limit: int = 60,
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return timestamped risk scores for the last N transfers (for live chart).

    Returns a JSON array like:
      [{"time": "18:01:34", "risk": 0.12, "amount": 50000, "status": "COMPLETED"}, ...]
    """
    from datetime import datetime as dt
    from zoneinfo import ZoneInfo
    IST = ZoneInfo("Asia/Kolkata")

    result = await db.execute(
        select(
            Transfer.created_at,
            Transfer.risk_score,
            Transfer.ml_risk_score,
            Transfer.amount,
            Transfer.status,
        )
        .where(Transfer.risk_score.isnot(None))
        .order_by(Transfer.created_at.desc())
        .limit(limit)
    )
    rows = result.fetchall()

    timeline = []
    for row in reversed(rows):
        created_utc = row[0]
        if created_utc.tzinfo is None:
            from datetime import timezone
            created_utc = created_utc.replace(tzinfo=timezone.utc)
        created_ist = created_utc.astimezone(IST)
        timeline.append({
            "time": created_ist.strftime("%H:%M:%S"),
            "risk": round(float(row[1] or 0), 4),
            "ml_risk": round(float(row[2] or 0), 4),
            "amount": float(row[3] or 0),
            "status": row[4],
        })

    return timeline


@router.get("/dashboard", response_model=FraudDashboardResponse)
async def fraud_dashboard(
    _: str = Depends(require_admin),
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
            for r in rules:
                if isinstance(r, str):
                    all_rules.append(r)
                elif isinstance(r, dict) and "xai_factor" in r:
                    all_rules.append("ML_ANOMALY_XAI")
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
    # Replaced N+1 loop with a single aggregate query
    distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    dist_query = """
        SELECT
            SUM(CASE WHEN risk_score < 0.25 THEN 1 ELSE 0 END) as low,
            SUM(CASE WHEN risk_score >= 0.25 AND risk_score < 0.5 THEN 1 ELSE 0 END) as medium,
            SUM(CASE WHEN risk_score >= 0.5 AND risk_score < 0.75 THEN 1 ELSE 0 END) as high,
            SUM(CASE WHEN risk_score >= 0.75 THEN 1 ELSE 0 END) as critical
        FROM transfers
        WHERE risk_score IS NOT NULL
    """
    from sqlalchemy import text
    dist_result = await db.execute(text(dist_query))
    row = dist_result.first()
    if row:
        distribution = {
            "low": int(row[0] or 0),
            "medium": int(row[1] or 0),
            "high": int(row[2] or 0),
            "critical": int(row[3] or 0)
        }

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
    _: str = Depends(require_admin),
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
    _: str = Depends(require_admin),
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


@router.get("/str/{transfer_id}")
async def generate_str_report(
    transfer_id: str,
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a dynamic Suspicious Transaction Report (STR) PDF for a specific flagged transfer.
    Used for RegTech compliance and FIU (Financial Intelligence Unit) reporting.
    """
    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    pdf_bytes = generate_fiu_str_pdf(transfer)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="STR_{transfer_id}.pdf"'
        }
    )
