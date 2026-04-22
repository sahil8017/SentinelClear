import logging
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import FraudRuleConfig, Transfer, Beneficiary, User, Account
from app.services.fraud import score_transaction  # Unified scoring engine

logger = logging.getLogger("sentinelclear.fraud")

class RiskReport(TypedDict):
    is_blocked: bool
    block_reason: str
    risk_score: float
    ml_risk_score: float
    rules_triggered: list[str]



async def evaluate_transfer_risk(
    db: AsyncSession,
    user: User,
    sender_account_id: str,
    receiver_account_id: str,
    amount: float,
    route: str,
    sender_balance: float,
    client_ip: str | None = None,
) -> RiskReport:
    """Multi-layered predictive risk engine and regulatory orchestrator."""

    rules_triggered = []

    # ══════════════════════════════════════════════════════════════
    # LAYER 1: STRICT INDIAN REGULATORY LIMITS (HARD BLOCKS)
    # ══════════════════════════════════════════════════════════════

    # 1. RTGS Minimum Floor
    if route and route.upper() == "RTGS" and amount < 200000:
        return {
            "is_blocked": True,
            "block_reason": "RTGS transfers require a minimum payload of ₹2,00,000.",
            "risk_score": 1.0,
            "rules_triggered": ["RTGS_MINIMUM_FLOOR"]
        }

    # 2. PAN Mandate (Section 114B)
    if amount >= 50000 and user.kyc_status != "PAN_VERIFIED":
        return {
            "is_blocked": True,
            "block_reason": "PAN mapping is required for transactions of ₹50,000 or greater (Section 114B).",
            "risk_score": 1.0,
            "ml_risk_score": 0.0,
            "rules_triggered": ["PAN_MANDATE"]
        }

    # Query 24-hour transfers for Velocity and Volume
    twenty_four_hours_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
    
    recent_transfers_stmt = select(
        func.sum(Transfer.amount),
        func.count(Transfer.id)
    ).where(
        and_(
            Transfer.sender_account_id == sender_account_id,
            Transfer.sender_account_id != Transfer.receiver_account_id,
            Transfer.status == "COMPLETED",
            Transfer.created_at >= twenty_four_hours_ago
        )
    )
    result = await db.execute(recent_transfers_stmt)
    row = result.first()
    rolling_vol = 0.0
    rolling_vel = 0
    if row:
        row_vol, row_vel = row
        rolling_vol = row_vol or 0.0
        rolling_vel = row_vel or 0

    # 3. UPI Daily Volume Limit (₹1,00,000)
    if (rolling_vol + amount) > 100000:
        logger.warning(
            "Transfer blocked by NPCI Velocity Rule [DAILY_VOLUME_NPCI]: Account %s, amount=₹%.2f, rolling_vol=₹%.2f",
            sender_account_id, amount, rolling_vol
        )
        return {
            "is_blocked": True,
            "block_reason": f"Transfer Blocked: You have exceeded the NPCI daily limit of ₹1,00,000. (Current rolling volume: ₹{rolling_vol:,.2f})",
            "risk_score": 1.0,
            "rules_triggered": ["DAILY_VOLUME_NPCI"]
        }

    # 4. UPI Daily Velocity Limit (20 txns)
    if rolling_vel >= 20:
        logger.warning(
            "Transfer blocked by NPCI Velocity Rule [DAILY_VELOCITY_NPCI]: Account %s, rolling_vel=%d",
            sender_account_id, rolling_vel
        )
        return {
            "is_blocked": True,
            "block_reason": "Transfer Blocked: You have exceeded the NPCI daily velocity limit of 20 outbound transfers.",
            "risk_score": 1.0,
            "rules_triggered": ["DAILY_VELOCITY_NPCI"]
        }

    # 5. New Beneficiary Cooling-Off (Auto-insert if not exists for testability)
    ben_stmt = select(Beneficiary).where(
        and_(
            Beneficiary.user_id == user.id,
            Beneficiary.recipient_account_id == receiver_account_id
        )
    )
    ben_result = await db.execute(ben_stmt)
    beneficiary = ben_result.scalar_one_or_none()

    is_new_beneficiary = False
    if not beneficiary:
        is_new_beneficiary = True
        if amount > 50000:
            return {
                "is_blocked": True,
                "block_reason": "Transfers to new/unsaved beneficiaries are capped at ₹50,000 during the first 24 hours.",
                "risk_score": 1.0,
                "rules_triggered": ["NEW_BENEFICIARY_COOLING_OFF"]
            }
        # Simulate explicitly adding the payee so future transfers check created_at
        new_ben = Beneficiary(
            user_id=user.id,
            recipient_account_id=receiver_account_id,
            status="ACTIVE"
        )
        db.add(new_ben)
        # Flush to ensure it's available, but don't commit until the whole transfer is complete
        await db.flush()
    else:
        # It exists, check if it's less than 24h old
        if beneficiary.created_at >= twenty_four_hours_ago:
            is_new_beneficiary = True
            if amount > 50000:
                return {
                    "is_blocked": True,
                    "block_reason": "Cooling-Off Period Active: Transfers to beneficiaries added within 24 hours are capped at ₹50,000.",
                    "risk_score": 1.0,
                    "rules_triggered": ["NEW_BENEFICIARY_COOLING_OFF"]
                }

    # ══════════════════════════════════════════════════════════════
    # LAYER 2: UNIFIED PREDICTIVE RISK ENGINE
    # ══════════════════════════════════════════════════════════════
    
    # Resolve IP to City for Geo-Velocity checks
    current_city = None
    if client_ip:
        from app.services.geo import ip_to_city
        current_city = ip_to_city(client_ip)

    # Note: ML scoring is done inside score_transaction where it evaluates the 58% baseline calibration wrapper
    engine_result = await score_transaction(
        db=db,
        sender_account_id=sender_account_id,
        receiver_account_id=receiver_account_id,
        amount=amount,
        current_city=current_city,
    )
    
    risk_score = engine_result["risk_score"]
    rules_triggered.extend(engine_result["rules_triggered"])

    # ══════════════════════════════════════════════════════════════
    # LAYER 3: DOMAIN-SPECIFIC ANOMALIES
    # ══════════════════════════════════════════════════════════════
    
    # 1. Split-Structuring Detection (Smurfing)
    # 3 rapid transfers of ≈19k+ within 10 minutes to same recipient
    ten_mins_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=10)
    rapid_transfers_stmt = select(func.count(Transfer.id)).where(
        and_(
            Transfer.sender_account_id == sender_account_id,
            Transfer.receiver_account_id == receiver_account_id,
            Transfer.status == "COMPLETED",
            Transfer.amount >= 19000,
            Transfer.created_at >= ten_mins_ago
        )
    )
    rapid_res = await db.execute(rapid_transfers_stmt)
    rapid_count = rapid_res.scalar() or 0
    
    if amount >= 19000 and rapid_count >= 2:
        # Active Smurfing - Multiplier to existing risk
        risk_score = min(1.0, risk_score + 0.5)
        rules_triggered.append("SMURFING_SPLIT_STRUCTURING")

    # 3. Account Drain Prediction
    # > 95% of available balance to a NEW beneficiary
    if sender_balance > 0 and amount > (0.95 * sender_balance) and is_new_beneficiary:
        # Extreme risk for drainage
        risk_score = 1.0
        rules_triggered.append("ACCOUNT_DRAIN_PREDICTION")

    risk_score = round(min(risk_score, 1.0), 4)

    return {
        "is_blocked": False,
        "block_reason": "",
        "risk_score": risk_score,
        "rules_triggered": rules_triggered
    }
