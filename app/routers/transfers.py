"""Transfers router — atomic money transfers with rule-based fraud scoring,
idempotency, double-entry ledger, balance snapshots, and rate limiting."""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Account, BalanceSnapshot, Transfer, User
from app.schemas import TransferOut, TransferRequest, FraudBlockedResponse
from app.services.fraud import score_transaction
from app.services.audit import create_audit_entry
from app.services.rabbitmq import publish_transfer_event
from app.services.ledger import create_double_entry
from app.services.idempotency import check_or_create_key, mark_done
from app.services import cache as redis_cache
from app.services.rate_limit import transfer_limiter

router = APIRouter(prefix="/transfers", tags=["Transfers"])


async def _upsert_snapshot(db: AsyncSession, account_id: str, balance: float) -> None:
    """Upsert a balance snapshot for fast reads."""
    result = await db.execute(
        select(BalanceSnapshot).where(BalanceSnapshot.account_id == account_id)
    )
    snap = result.scalar_one_or_none()
    if snap:
        snap.balance = balance
        snap.snapshot_at = datetime.utcnow()
    else:
        snap = BalanceSnapshot(account_id=account_id, balance=balance)
        db.add(snap)


@router.post(
    "",
    response_model=TransferOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        403: {"model": FraudBlockedResponse, "description": "Transfer blocked by fraud detection"},
    },
)
async def create_transfer(
    body: TransferRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _rate: None = Depends(transfer_limiter),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """Execute an atomic transfer between two accounts.

    Processing pipeline:
    1. Idempotency check (if header present)
    2. Input validation (same-account check)
    3. Rule-based fraud scoring — velocity, amount, daily volume, account age, time, recipient
    4. If BLOCK → record FLAGGED transfer + audit entry, return 403
    5. Atomic balance transfer with SELECT ... FOR UPDATE (race-safe)
    6. Double-entry ledger entries (DEBIT + CREDIT)
    7. Balance snapshots updated
    8. Redis cache invalidated
    9. Post-transfer: audit log + async RabbitMQ event
    """

    # ══════════════════════════════════════════════════════════════
    # STEP 0: IDEMPOTENCY CHECK
    # ══════════════════════════════════════════════════════════════
    if idempotency_key:
        idem_result = await check_or_create_key(db, idempotency_key, user.id)
        if idem_result["action"] == "replay":
            return JSONResponse(
                status_code=idem_result["response_code"],
                content=json.loads(idem_result["response_body"]),
            )
        if idem_result["action"] == "conflict":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Request with this idempotency key is already being processed",
            )

    if body.sender_account_id == body.receiver_account_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")

    transfer_id = str(uuid.uuid4())

    # ══════════════════════════════════════════════════════════════
    # STEP 1: FRAUD SCORING — multi-signal rule engine
    # ══════════════════════════════════════════════════════════════
    fraud_result = await score_transaction(
        db=db,
        sender_account_id=body.sender_account_id,
        receiver_account_id=body.receiver_account_id,
        amount=body.amount,
    )
    risk_score = fraud_result["risk_score"]
    rules_triggered = fraud_result["rules_triggered"]
    rules_json = json.dumps(rules_triggered) if rules_triggered else None

    if fraud_result["is_fraud"]:
        # ── Fraud BLOCKED → FLAGGED (no balance change) ──
        transfer = Transfer(
            id=transfer_id,
            sender_account_id=body.sender_account_id,
            receiver_account_id=body.receiver_account_id,
            amount=body.amount,
            status="FLAGGED",
            risk_score=risk_score,
            fraud_rules_triggered=rules_json,
        )
        db.add(transfer)
        await db.commit()
        await db.refresh(transfer)

        await create_audit_entry(db, transfer_id, "TRANSFER_FLAGGED", {
            "sender": body.sender_account_id,
            "receiver": body.receiver_account_id,
            "amount": body.amount,
            "risk_score": risk_score,
            "decision": fraud_result["decision"],
            "rules_triggered": rules_triggered,
            "rule_details": fraud_result["rule_details"],
        })

        await publish_transfer_event({
            "transfer_id": transfer_id,
            "sender_account_id": body.sender_account_id,
            "receiver_account_id": body.receiver_account_id,
            "amount": body.amount,
            "status": "FLAGGED",
            "risk_score": risk_score,
            "rules_triggered": rules_triggered,
        })

        response_content = {
            "detail": "Transaction blocked — flagged by fraud detection",
            "risk_score": risk_score,
            "transfer_id": transfer_id,
            "rules_triggered": rules_triggered,
            "decision": fraud_result["decision"],
        }

        if idempotency_key:
            await mark_done(db, idempotency_key, 403, response_content)
            await db.commit()

        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=response_content,
        )

    # ══════════════════════════════════════════════════════════════
    # STEP 2: ATOMIC TRANSFER with row-level locking
    # ══════════════════════════════════════════════════════════════
    try:
        ordered_ids = sorted([body.sender_account_id, body.receiver_account_id])
        for acct_id in ordered_ids:
            result = await db.execute(
                select(Account)
                .where(Account.id == acct_id)
                .with_for_update()
            )
            acct = result.scalar_one_or_none()
            if acct is None:
                raise HTTPException(status_code=404, detail=f"Account {acct_id} not found")

        sender_result = await db.execute(
            select(Account).where(Account.id == body.sender_account_id).with_for_update()
        )
        sender = sender_result.scalar_one()

        receiver_result = await db.execute(
            select(Account).where(Account.id == body.receiver_account_id).with_for_update()
        )
        receiver = receiver_result.scalar_one()

        if sender.owner_id != user.id:
            raise HTTPException(status_code=403, detail="You do not own the sender account")

        if sender.balance < body.amount:
            transfer = Transfer(
                id=transfer_id,
                sender_account_id=body.sender_account_id,
                receiver_account_id=body.receiver_account_id,
                amount=body.amount,
                status="FAILED",
                risk_score=risk_score,
                fraud_rules_triggered=rules_json,
            )
            db.add(transfer)
            await db.commit()

            await create_audit_entry(db, transfer_id, "TRANSFER_FAILED", {
                "sender": body.sender_account_id,
                "receiver": body.receiver_account_id,
                "amount": body.amount,
                "risk_score": risk_score,
                "reason": "Insufficient balance",
            })

            raise HTTPException(status_code=400, detail="Insufficient balance")

        sender.balance -= body.amount
        receiver.balance += body.amount

        transfer = Transfer(
            id=transfer_id,
            sender_account_id=body.sender_account_id,
            receiver_account_id=body.receiver_account_id,
            amount=body.amount,
            status="COMPLETED",
            risk_score=risk_score,
            fraud_rules_triggered=rules_json,
        )
        db.add(transfer)

        # ══════════════════════════════════════════════════════════════
        # STEP 3: DOUBLE-ENTRY LEDGER — DEBIT sender, CREDIT receiver
        # ══════════════════════════════════════════════════════════════
        await create_double_entry(
            db,
            transfer_id=transfer_id,
            sender_account_id=body.sender_account_id,
            receiver_account_id=body.receiver_account_id,
            amount=body.amount,
            sender_balance_after=sender.balance,
            receiver_balance_after=receiver.balance,
        )

        # ══════════════════════════════════════════════════════════════
        # STEP 4: BALANCE SNAPSHOTS
        # ══════════════════════════════════════════════════════════════
        await _upsert_snapshot(db, body.sender_account_id, sender.balance)
        await _upsert_snapshot(db, body.receiver_account_id, receiver.balance)

        await db.commit()
        await db.refresh(transfer)

    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(exc)}")

    # ══════════════════════════════════════════════════════════════
    # STEP 5: POST-TRANSFER — cache, audit, event, idempotency
    # ══════════════════════════════════════════════════════════════

    await redis_cache.invalidate_balance(body.sender_account_id)
    await redis_cache.invalidate_balance(body.receiver_account_id)

    await create_audit_entry(db, transfer_id, "TRANSFER_COMPLETED", {
        "sender": body.sender_account_id,
        "receiver": body.receiver_account_id,
        "amount": body.amount,
        "risk_score": risk_score,
        "rules_triggered": rules_triggered,
    })

    await publish_transfer_event({
        "transfer_id": transfer_id,
        "sender_account_id": body.sender_account_id,
        "receiver_account_id": body.receiver_account_id,
        "amount": body.amount,
        "status": "COMPLETED",
        "risk_score": risk_score,
        "rules_triggered": rules_triggered,
    })

    if idempotency_key:
        response_body = {
            "id": transfer.id,
            "sender_account_id": transfer.sender_account_id,
            "receiver_account_id": transfer.receiver_account_id,
            "amount": transfer.amount,
            "status": transfer.status,
            "risk_score": transfer.risk_score,
            "fraud_rules_triggered": transfer.fraud_rules_triggered,
            "created_at": transfer.created_at.isoformat(),
        }
        await mark_done(db, idempotency_key, 201, response_body)
        await db.commit()

    return transfer


@router.get("/{transfer_id}", response_model=TransferOut)
async def get_transfer(
    transfer_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a single transfer the user is party to."""
    acct_result = await db.execute(select(Account.id).where(Account.owner_id == user.id))
    user_account_ids = [row[0] for row in acct_result.fetchall()]

    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if (
        transfer.sender_account_id not in user_account_ids
        and transfer.receiver_account_id not in user_account_ids
    ):
        raise HTTPException(status_code=403, detail="You are not a party to this transfer")

    return transfer


@router.get("/history/all", response_model=list[TransferOut])
async def get_transfer_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all transfers where the user is sender or receiver."""
    acct_result = await db.execute(select(Account.id).where(Account.owner_id == user.id))
    user_account_ids = [row[0] for row in acct_result.fetchall()]

    if not user_account_ids:
        return []

    result = await db.execute(
        select(Transfer)
        .where(
            or_(
                Transfer.sender_account_id.in_(user_account_ids),
                Transfer.receiver_account_id.in_(user_account_ids),
            )
        )
        .order_by(Transfer.created_at.desc())
    )
    return result.scalars().all()
