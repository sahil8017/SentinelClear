"""AI router — Sarvam AI integration for translation, insights, and fraud analysis."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Account, Transfer, User
from app.schemas import (
    FraudExplainResponse,
    InsightsRequest,
    InsightsResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.services.sarvam import explain_fraud, generate_insights, translate_text

router = APIRouter(prefix="/ai", tags=["AI (Sarvam)"])


@router.post("/translate-statement", response_model=TranslateResponse)
async def translate_statement(
    body: TranslateRequest,
    user: User = Depends(get_current_user),
):
    """Translate a transaction narration or statement text to an Indian language."""
    result = await translate_text(
        text=body.text,
        source_language=body.source_language,
        target_language=body.target_language,
    )

    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])

    return TranslateResponse(
        original_text=body.text,
        translated_text=result["translated_text"],
        source_language=body.source_language,
        target_language=body.target_language,
    )


@router.post("/insights", response_model=InsightsResponse)
async def get_spending_insights(
    body: InsightsRequest = InsightsRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI-powered spending insights from the user's transaction history."""
    acct_result = await db.execute(
        select(Account.id).where(Account.owner_id == user.id)
    )
    user_account_ids = [row[0] for row in acct_result.fetchall()]

    if not user_account_ids:
        raise HTTPException(status_code=404, detail="No accounts found")

    result = await db.execute(
        select(Transfer)
        .where(
            or_(
                Transfer.sender_account_id.in_(user_account_ids),
                Transfer.receiver_account_id.in_(user_account_ids),
            )
        )
        .order_by(Transfer.created_at.desc())
        .limit(100)
    )
    transfers = result.scalars().all()

    if not transfers:
        raise HTTPException(status_code=404, detail="No transaction history found")

    txn_dicts = [
        {
            "amount": t.amount,
            "status": t.status,
            "risk_score": t.risk_score,
            "sender_account_id": t.sender_account_id,
            "receiver_account_id": t.receiver_account_id,
        }
        for t in transfers
    ]

    # Compute totals
    total_spent = sum(t.amount for t in transfers if t.sender_account_id in user_account_ids and t.status == "COMPLETED")
    total_received = sum(t.amount for t in transfers if t.receiver_account_id in user_account_ids and t.status == "COMPLETED")

    insights_text = await generate_insights(txn_dicts, body.question)

    return InsightsResponse(
        insights=insights_text,
        transaction_count=len(transfers),
        total_spent=round(total_spent, 2),
        total_received=round(total_received, 2),
    )


@router.post("/fraud-explain/{transfer_id}", response_model=FraudExplainResponse)
async def fraud_explain(
    transfer_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get an AI-generated explanation for a flagged or suspicious transfer."""
    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    # Verify user is a party to this transfer
    acct_result = await db.execute(
        select(Account.id).where(Account.owner_id == user.id)
    )
    user_account_ids = [row[0] for row in acct_result.fetchall()]
    if (
        transfer.sender_account_id not in user_account_ids
        and transfer.receiver_account_id not in user_account_ids
    ):
        raise HTTPException(status_code=403, detail="You are not a party to this transfer")

    ai_result = await explain_fraud(
        amount=transfer.amount,
        risk_score=transfer.risk_score or 0.0,
        sender_id=transfer.sender_account_id,
        receiver_id=transfer.receiver_account_id,
        status=transfer.status,
    )

    return FraudExplainResponse(
        transfer_id=transfer_id,
        risk_score=transfer.risk_score or 0.0,
        explanation=ai_result["explanation"],
        recommendation=ai_result["recommendation"],
    )
