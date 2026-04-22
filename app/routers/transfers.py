"""Transfers router — atomic money transfers with rule-based fraud scoring,
idempotency, double-entry ledger, balance snapshots, rate limiting,
and UPI safety rules (transaction pause, vulnerable group, kill switch, annual limit)."""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_user_or_api_key
from app.models import Account, BalanceSnapshot, Notification, Transfer, User, WhitelistedContact
from app.schemas import TransferOut, TransferRequest, FraudBlockedResponse
from app.services.fraud_service import evaluate_transfer_risk
from app.services.audit import create_audit_entry
from app.services.rabbitmq import publish_transfer_event
from app.services.ledger import create_double_entry
from app.services.idempotency import check_or_create_key, mark_done
from app.services import cache as redis_cache
from app.services.rate_limit import transfer_limiter
from app.services.webhook_service import dispatch_webhook
from app.services.upi_safety import (
    check_kill_switch,
    check_annual_receiving_limit,
    check_transaction_pause,
    check_vulnerable_group,
    update_annual_received,
)
from app.config import settings

router = APIRouter(prefix="/transfers", tags=["Transfers"])


async def _upsert_snapshot(db: AsyncSession, account_id: str, balance: float) -> None:
    """Upsert a balance snapshot for fast reads."""
    result = await db.execute(
        select(BalanceSnapshot).where(BalanceSnapshot.account_id == account_id)
    )
    snap = result.scalar_one_or_none()
    if snap:
        snap.balance = balance
        snap.snapshot_at = datetime.now(timezone.utc).replace(tzinfo=None)
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
    user: User = Depends(get_user_or_api_key),
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
    # STEP 0: SENDER RESOLUTION & IDEMPOTENCY
    # ══════════════════════════════════════════════════════════════
    # Pre-emptively bind attributes that might be detached later by commits
    u_id = user.id
    trusted_person_id = user.trusted_person_id
 
    # Always resolve sender account for balance access by fraud engine
    if not body.sender_account_id:
        result = await db.execute(
            select(Account)
            .where(Account.owner_id == user.id)
            .order_by(Account.created_at.asc())
        )
        sender_acct = result.scalars().first()
        if not sender_acct:
             raise HTTPException(status_code=404, detail="No source account found for user")
        body.sender_account_id = sender_acct.id
    else:
        result = await db.execute(
            select(Account).where(Account.id == body.sender_account_id)
        )
        sender_acct = result.scalar_one_or_none()
        if not sender_acct:
            raise HTTPException(status_code=404, detail="Sender account not found")

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

    client_ip = body.ip_override or (request.client.host if request.client else None)

    # ══════════════════════════════════════════════════════════════
    # STEP 1A: UPI SAFETY — Kill Switch (instant block)
    # ══════════════════════════════════════════════════════════════
    kill_result = await check_kill_switch(user)
    if kill_result["blocked"]:
        raise HTTPException(
            status_code=403,
            detail=kill_result["detail"],
            headers={"X-Block-Reason": "EMERGENCY_KILL_SWITCH"},
        )

    # ══════════════════════════════════════════════════════════════
    # STEP 1B: UPI SAFETY — Annual Receiving Limit
    # ══════════════════════════════════════════════════════════════
    receiver_acct_result = await db.execute(
        select(Account).where(Account.id == body.receiver_account_id)
    )
    receiver_acct_for_limit = receiver_acct_result.scalar_one_or_none()
    if not receiver_acct_for_limit:
        raise HTTPException(status_code=404, detail="Receiver account not found")

    annual_result = await check_annual_receiving_limit(db, receiver_acct_for_limit, body.amount)
    if annual_result["blocked"]:
        await db.commit()  # Persist the frozen state
        raise HTTPException(
            status_code=403,
            detail=annual_result["detail"],
            headers={"X-Block-Reason": annual_result["reason"]},
        )

    # ══════════════════════════════════════════════════════════════
    # STEP 1: RBI/NPCI FRAUD SCORING — Multi-Layered Risk Engine
    # ══════════════════════════════════════════════════════════════
    fraud_result = await evaluate_transfer_risk(
        db=db,
        user=user,
        sender_account_id=body.sender_account_id,
        receiver_account_id=body.receiver_account_id,
        amount=body.amount,
        route=body.route,
        sender_balance=sender_acct.balance,
        client_ip=client_ip
    )
    
    # ── LAYER 1: Hard Regulatory Blocks ──
    if fraud_result["is_blocked"]:
        layer1_content = {
            "detail": fraud_result["block_reason"],
            "risk_score": fraud_result.get("risk_score", 1.0),
            "transfer_id": transfer_id,
            "rules_triggered": fraud_result.get("rules_triggered", []),
            "decision": "BLOCK",
        }
        if idempotency_key:
            await mark_done(db, idempotency_key, 403, layer1_content)
            await db.commit()
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=layer1_content,
        )

    risk_score = fraud_result["risk_score"]
    ml_risk_score = fraud_result.get("ml_risk_score", 0.0)
    rules_triggered = fraud_result["rules_triggered"]
    rules_json = json.dumps(rules_triggered) if rules_triggered else None

    # Resolve IP locally for database columns
    from app.services.geo import ip_to_city
    source_city = ip_to_city(client_ip) if client_ip else None

    # ── Check Whitelist to override ML heuristics ──
    wl_result = await db.execute(
        select(WhitelistedContact).where(
            WhitelistedContact.user_id == user.id,
            WhitelistedContact.contact_account_id == body.receiver_account_id,
        )
    )
    is_whitelisted = wl_result.scalar_one_or_none() is not None

    if is_whitelisted and risk_score >= settings.FRAUD_REVIEW_THRESHOLD:
        import logging
        logger = logging.getLogger("transfers")
        logger.info(f"Predictive risk score {risk_score} overridden to 0.1 for whitelisted contact {body.receiver_account_id}")
        risk_score = 0.1
        ml_risk_score = 0.0

    # ── LAYER 2: Predictive Risk Quarantine (FLAGGED footprint) ──
    if risk_score >= settings.FRAUD_BLOCK_THRESHOLD and body.amount < settings.MAKER_CHECKER_THRESHOLD:
        # ── Fraud BLOCKED → FLAGGED (no balance change) ──
        transfer = Transfer(
            id=transfer_id,
            sender_account_id=body.sender_account_id,
            receiver_account_id=body.receiver_account_id,
            amount=body.amount,
            status="FLAGGED",
            risk_score=risk_score,
            ml_risk_score=ml_risk_score,
            fraud_rules_triggered=rules_json,
            source_ip=client_ip,
            source_city=source_city,
            reference=body.reference,
        )
        db.add(transfer)
        await db.commit()
        await db.refresh(transfer)

        await create_audit_entry(db, transfer_id, "TRANSFER_FLAGGED", {
            "sender": body.sender_account_id,
            "receiver": body.receiver_account_id,
            "amount": body.amount,
            "risk_score": risk_score,
            "decision": "BLOCK",
            "rules_triggered": rules_triggered,
            "rule_details": [],
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
            "detail": "Transaction quarantined by Predictive Risk Engine",
            "risk_score": risk_score,
            "transfer_id": transfer_id,
            "rules_triggered": rules_triggered,
            "decision": "BLOCK",
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
        # Lock and fetch accounts deterministically
        ordered_ids = sorted([body.sender_account_id, body.receiver_account_id])
        
        # We must lock in order to prevent deadlocks, but we also need reference to sender/receiver
        accts = {}
        for acct_id in ordered_ids:
            result = await db.execute(
                select(Account).where(Account.id == acct_id).with_for_update()
            )
            acct = result.scalar_one_or_none()
            if acct is None:
                raise HTTPException(status_code=404, detail=f"Account {acct_id} not found")
            accts[acct_id] = acct

        sender = accts[body.sender_account_id]
        receiver = accts[body.receiver_account_id]

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
                ml_risk_score=ml_risk_score,
                fraud_rules_triggered=rules_json,
                source_ip=client_ip,
                source_city=source_city,
                reference=body.reference,
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

        # ══════════════════════════════════════════════════════════════
        # STEP 3: PERSIST TRANSFER & CHECK FOR DEFERRALS
        # ══════════════════════════════════════════════════════════════
        needs_approval = body.amount >= settings.MAKER_CHECKER_THRESHOLD
        needs_step_up = not needs_approval and risk_score >= settings.FRAUD_REVIEW_THRESHOLD

        # ── UPI Safety: Vulnerable Group Protection (Rule 2) ──
        vulnerable_result = await check_vulnerable_group(user, body.amount)
        needs_guardian = vulnerable_result.get("guardian_required", False)
        if needs_guardian and vulnerable_result.get("blocked"):
            # No guardian configured — hard block
            raise HTTPException(status_code=403, detail=vulnerable_result["detail"])

        # ── UPI Safety: Transaction Pause (Rule 1) ──
        pause_result = await check_transaction_pause(db, user, body.receiver_account_id, body.amount)
        needs_pause = pause_result.get("pause", False)

        status_val = "COMPLETED"
        if needs_approval:
            status_val = "PENDING_APPROVAL"
        elif needs_guardian:
            status_val = "PENDING_GUARDIAN"
        elif needs_pause:
            status_val = "PAUSED"
        elif needs_step_up:
            status_val = "PENDING_AUTH"

        auth_challenge_id = str(uuid.uuid4()) if needs_step_up else None

        transfer = Transfer(
            id=transfer_id,
            sender_account_id=body.sender_account_id,
            receiver_account_id=body.receiver_account_id,
            amount=body.amount,
            status=status_val,
            risk_score=risk_score,
            ml_risk_score=ml_risk_score,
            fraud_rules_triggered=rules_json,
            source_ip=client_ip,
            source_city=source_city,
            reference=body.reference,
            auth_challenge_id=auth_challenge_id,
        )
        db.add(transfer)

        if needs_approval:
            # High-value transfer Requires explicit Admin approval
            # Defer balance updates and immediately return success payload indicating pending
            await db.commit()
            await db.refresh(transfer)
            return JSONResponse(
                status_code=202,
                content={
                    "id": transfer.id,  # Compatibility with test script
                    "status": "PENDING_APPROVAL",
                    "transfer_id": transfer.id,
                    "amount": transfer.amount,
                    "detail": "High-value transfer requires administrative approval (Maker-Checker).",
                },
            )

        if needs_guardian:
            # UPI Safety Rule 2: Defer until trusted person approves
            await db.commit()
            await db.refresh(transfer)

            # Send notification to trusted person
            try:
                guardian_notif = Notification(
                    user_id=trusted_person_id,
                    title="Guardian Approval Required",
                    message=(
                        f"A transaction of ₹{body.amount:,.2f} by a vulnerable account holder "
                        f"requires your approval. Transfer ID: {transfer.id}"
                    ),
                    notification_type="GUARDIAN_APPROVAL",
                    reference_id=transfer.id,
                )
                db.add(guardian_notif)
                await db.commit()
            except Exception:
                pass

            return JSONResponse(
                status_code=202,
                content={
                    "detail": "Transaction requires approval from your trusted person.",
                    "transfer_id": transfer.id,
                    "status": "PENDING_GUARDIAN",
                    "message": "Your trusted person has been notified and must approve this transaction.",
                },
            )

        if needs_pause:
            # UPI Safety Rule 1: Pause for user confirmation
            await db.commit()
            await db.refresh(transfer)
            return JSONResponse(
                status_code=202,
                content={
                    "detail": pause_result["detail"],
                    "transfer_id": transfer.id,
                    "status": "PAUSED",
                    "cooldown_seconds": pause_result["cooldown_seconds"],
                    "message": "Confirm or cancel this transaction within the cooldown period.",
                },
            )

        if needs_step_up:
            # DO NOT adjust balances yet. Defer until Step-Up Auth is complete.
            await db.commit()
            raise HTTPException(
                status_code=401,
                detail="Step-Up Authentication Required",
                headers={"X-Auth-Challenge-Id": auth_challenge_id}
            )

        # If not deferred, execute balances synchronously
        sender.balance -= body.amount
        receiver.balance += body.amount

        # ── UPI Safety: Update annual receiving tally ──
        await update_annual_received(receiver, body.amount)

        # ══════════════════════════════════════════════════════════════
        # STEP 4: DOUBLE-ENTRY LEDGER — DEBIT sender, CREDIT receiver
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
        # STEP 5: BALANCE SNAPSHOTS
        # ══════════════════════════════════════════════════════════════
        await _upsert_snapshot(db, body.sender_account_id, sender.balance)
        await _upsert_snapshot(db, body.receiver_account_id, receiver.balance)

        await db.commit()
        await db.refresh(transfer)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"CRITICAL: Transfer {transfer_id} failed with exception: {exc}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(exc)}")

    # ══════════════════════════════════════════════════════════════
    # STEP 5: POST-TRANSFER — cache, audit, event, idempotency
    # Best-effort: the atomic transfer already committed. Side-effect
    # failures must never return a 500 for an already-committed transfer.
    # ══════════════════════════════════════════════════════════════

    try:
        await redis_cache.invalidate_balance(body.sender_account_id)
        await redis_cache.invalidate_balance(body.receiver_account_id)
    except Exception:
        pass  # Redis failure is non-critical

    try:
        await create_audit_entry(db, transfer_id, "TRANSFER_COMPLETED", {
            "sender": body.sender_account_id,
            "receiver": body.receiver_account_id,
            "amount": body.amount,
            "risk_score": risk_score,
            "rules_triggered": rules_triggered,
        })
        await db.commit()
    except Exception:
        pass  # Audit failure is non-critical post-commit

    try:
        await publish_transfer_event({
            "transfer_id": transfer_id,
            "sender_account_id": body.sender_account_id,
            "receiver_account_id": body.receiver_account_id,
            "amount": body.amount,
            "status": "COMPLETED",
            "risk_score": risk_score,
            "rules_triggered": rules_triggered,
        })
    except Exception:
        pass  # RabbitMQ failure is non-critical

    # Dispatch webhooks asynchronously
    try:
        webhook_payload = {
            "event": "transfer.completed",
            "transfer_id": transfer_id,
            "sender_account_id": body.sender_account_id,
            "receiver_account_id": body.receiver_account_id,
            "amount": body.amount,
            "status": "COMPLETED",
            "created_at": transfer.created_at.isoformat() if transfer.created_at else datetime.now(timezone.utc).isoformat()
        }
        await dispatch_webhook(u_id, webhook_payload)
    except Exception:
        pass  # Webhook failure is non-critical

    if idempotency_key:
        try:
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
        except Exception:
            pass

    return transfer


# ════════════════════════════════════════════════════════════════════════
# STEP-UP AUTHENTICATION — Deferred Ledger Execution via Secure PIN
# ════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel as PydBase, Field as PydField
from passlib.context import CryptContext as PinCryptContext

_pin_ctx = PinCryptContext(schemes=["bcrypt"], deprecated="auto")


class VerifyAuthRequest(PydBase):
    pin: str = PydField(..., min_length=4, max_length=6,
                        description="4 or 6-digit transaction PIN")


@router.post("/{transfer_id}/verify-auth", response_model=TransferOut)
async def verify_step_up_auth(
    transfer_id: str,
    body: VerifyAuthRequest,
    user: User = Depends(get_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Verify the user's transaction PIN to complete a deferred transfer.

    Workflow:
    1. Validate the transfer exists and is in PENDING_AUTH state.
    2. Verify the submitted PIN against the user's bcrypt hash.
    3. Execute the deferred double-entry ledger (balance transfer).
    4. Mark the transfer as COMPLETED and commit.
    """
    # 1. Load deferred transfer
    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()

    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if transfer.status != "PENDING_AUTH":
        raise HTTPException(
            status_code=400,
            detail=f"Transfer is in '{transfer.status}' state. Step-Up Auth only applies to PENDING_AUTH transfers."
        )

    # Verify user owns the sender account
    acct_result = await db.execute(select(Account.id).where(Account.owner_id == user.id))
    user_acct_ids = [row[0] for row in acct_result.fetchall()]
    if transfer.sender_account_id not in user_acct_ids:
        raise HTTPException(status_code=403, detail="You are not the sender of this transfer")

    # 2. Verify PIN against bcrypt hash
    if not user.transaction_pin_hash:
        raise HTTPException(
            status_code=400,
            detail="No transaction PIN configured. Please set one via /auth/transaction-pin first."
        )

    if not _pin_ctx.verify(body.pin, user.transaction_pin_hash):
        raise HTTPException(status_code=403, detail="Incorrect transaction PIN. Funds remain on hold.")

    # 3. Execute the deferred double-entry ledger
    try:
        sender_result = await db.execute(
            select(Account).where(Account.id == transfer.sender_account_id).with_for_update()
        )
        sender = sender_result.scalar_one_or_none()

        receiver_result = await db.execute(
            select(Account).where(Account.id == transfer.receiver_account_id).with_for_update()
        )
        receiver = receiver_result.scalar_one_or_none()

        if not sender or not receiver:
            raise HTTPException(status_code=404, detail="One or both accounts no longer exist")

        if sender.balance < transfer.amount:
            transfer.status = "FAILED"
            await db.commit()
            raise HTTPException(status_code=400, detail="Insufficient balance (balance changed since deferral)")

        sender.balance -= transfer.amount
        receiver.balance += transfer.amount

        transfer.status = "COMPLETED"
        transfer.auth_challenge_id = None

        await create_double_entry(
            db,
            transfer_id=transfer.id,
            sender_account_id=transfer.sender_account_id,
            receiver_account_id=transfer.receiver_account_id,
            amount=transfer.amount,
            sender_balance_after=sender.balance,
            receiver_balance_after=receiver.balance,
        )

        await _upsert_snapshot(db, transfer.sender_account_id, sender.balance)
        await _upsert_snapshot(db, transfer.receiver_account_id, receiver.balance)

        await db.commit()
        await db.refresh(transfer)

    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Verification settlement failed: {str(exc)}")

    # 4. Post-settlement side-effects
    try:
        await redis_cache.invalidate_balance(transfer.sender_account_id)
        await redis_cache.invalidate_balance(transfer.receiver_account_id)
    except Exception:
        pass

    try:
        await create_audit_entry(db, transfer.id, "STEP_UP_AUTH_VERIFIED", {
            "sender": transfer.sender_account_id,
            "receiver": transfer.receiver_account_id,
            "amount": transfer.amount,
            "risk_score": transfer.risk_score,
        })
        await db.commit()
    except Exception:
        pass

    try:
        await publish_transfer_event({
            "transfer_id": transfer.id,
            "sender_account_id": transfer.sender_account_id,
            "receiver_account_id": transfer.receiver_account_id,
            "amount": transfer.amount,
            "status": "COMPLETED",
            "event_type": "step_up_verified",
        })
    except Exception:
        pass

    return transfer


@router.get("/{transfer_id}", response_model=TransferOut)
async def get_transfer(
    transfer_id: str,
    user: User = Depends(get_user_or_api_key),
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
    limit: int = 50,
    user: User = Depends(get_user_or_api_key),
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
        .limit(limit)
    )
    return result.scalars().all()


# ════════════════════════════════════════════════════════════════════════
# UPI SAFETY: TRANSACTION PAUSE CONFIRMATION / CANCELLATION
# ════════════════════════════════════════════════════════════════════════


async def _execute_deferred_transfer(db: AsyncSession, transfer: Transfer) -> Transfer:
    """Shared helper — execute balance transfer + ledger for a deferred transaction."""
    sender_res = await db.execute(
        select(Account).where(Account.id == transfer.sender_account_id).with_for_update()
    )
    sender = sender_res.scalar_one_or_none()

    receiver_res = await db.execute(
        select(Account).where(Account.id == transfer.receiver_account_id).with_for_update()
    )
    receiver = receiver_res.scalar_one_or_none()

    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="One or both accounts no longer exist")

    if sender.balance < transfer.amount:
        transfer.status = "FAILED"
        await db.commit()
        raise HTTPException(status_code=400, detail="Insufficient balance (balance changed since deferral)")

    sender.balance -= transfer.amount
    receiver.balance += transfer.amount

    # Update annual receiving tally
    await update_annual_received(receiver, transfer.amount)

    transfer.status = "COMPLETED"

    await create_double_entry(
        db,
        transfer_id=transfer.id,
        sender_account_id=transfer.sender_account_id,
        receiver_account_id=transfer.receiver_account_id,
        amount=transfer.amount,
        sender_balance_after=sender.balance,
        receiver_balance_after=receiver.balance,
    )

    await _upsert_snapshot(db, transfer.sender_account_id, sender.balance)
    await _upsert_snapshot(db, transfer.receiver_account_id, receiver.balance)

    await db.commit()
    await db.refresh(transfer)

    # Post-settlement side-effects
    try:
        await redis_cache.invalidate_balance(transfer.sender_account_id)
        await redis_cache.invalidate_balance(transfer.receiver_account_id)
    except Exception:
        pass

    return transfer


@router.post("/{transfer_id}/confirm-pause", response_model=TransferOut)
async def confirm_paused_transfer(
    transfer_id: str,
    user: User = Depends(get_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a PAUSED transfer to execute it.

    UPI Safety Rule 1: After the ₹10K pause, the user explicitly
    confirms they want to proceed with the transaction.
    """
    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()

    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != "PAUSED":
        raise HTTPException(status_code=400, detail=f"Transfer is '{transfer.status}', not PAUSED")

    # Verify sender ownership
    acct_result = await db.execute(select(Account.id).where(Account.owner_id == user.id))
    user_acct_ids = [row[0] for row in acct_result.fetchall()]
    if transfer.sender_account_id not in user_acct_ids:
        raise HTTPException(status_code=403, detail="You are not the sender of this transfer")

    try:
        transfer = await _execute_deferred_transfer(db, transfer)
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Confirmation settlement failed: {str(exc)}")

    try:
        await create_audit_entry(db, transfer.id, "PAUSE_CONFIRMED", {
            "sender": transfer.sender_account_id,
            "receiver": transfer.receiver_account_id,
            "amount": transfer.amount,
        })
        await db.commit()
    except Exception:
        pass

    return transfer


@router.post("/{transfer_id}/cancel-pause", response_model=TransferOut)
async def cancel_paused_transfer(
    transfer_id: str,
    user: User = Depends(get_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a PAUSED transfer — no funds are moved.

    UPI Safety Rule 1: The user decides the transaction is not legitimate.
    """
    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()

    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != "PAUSED":
        raise HTTPException(status_code=400, detail=f"Transfer is '{transfer.status}', not PAUSED")

    acct_result = await db.execute(select(Account.id).where(Account.owner_id == user.id))
    user_acct_ids = [row[0] for row in acct_result.fetchall()]
    if transfer.sender_account_id not in user_acct_ids:
        raise HTTPException(status_code=403, detail="You are not the sender of this transfer")

    transfer.status = "FAILED"
    await db.commit()
    await db.refresh(transfer)

    try:
        await create_audit_entry(db, transfer.id, "PAUSE_CANCELLED", {
            "sender": transfer.sender_account_id,
            "amount": transfer.amount,
        })
        await db.commit()
    except Exception:
        pass

    return transfer


# ════════════════════════════════════════════════════════════════════════
# UPI SAFETY: GUARDIAN APPROVAL / REJECTION
# ════════════════════════════════════════════════════════════════════════


@router.post("/{transfer_id}/guardian-approve", response_model=TransferOut)
async def guardian_approve_transfer(
    transfer_id: str,
    user: User = Depends(get_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Trusted person approves a PENDING_GUARDIAN transfer.

    UPI Safety Rule 2: For vulnerable users (age ≥70 or disabled),
    high-value transactions require their guardian's approval.
    """
    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()

    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != "PENDING_GUARDIAN":
        raise HTTPException(status_code=400, detail=f"Transfer is '{transfer.status}', not PENDING_GUARDIAN")

    # Verify the approver IS the trusted person of the sender
    sender_acct_result = await db.execute(
        select(Account).where(Account.id == transfer.sender_account_id)
    )
    sender_acct = sender_acct_result.scalar_one_or_none()
    if not sender_acct:
        raise HTTPException(status_code=404, detail="Sender account not found")

    sender_user_result = await db.execute(
        select(User).where(User.id == sender_acct.owner_id)
    )
    sender_user = sender_user_result.scalar_one_or_none()
    if not sender_user or sender_user.trusted_person_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the designated trusted person can approve this transaction."
        )

    try:
        transfer = await _execute_deferred_transfer(db, transfer)
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Guardian approval settlement failed: {str(exc)}")

    try:
        await create_audit_entry(db, transfer.id, "GUARDIAN_APPROVED", {
            "guardian_id": user.id,
            "amount": transfer.amount,
        })
        await db.commit()
    except Exception:
        pass

    return transfer


@router.post("/{transfer_id}/guardian-reject", response_model=TransferOut)
async def guardian_reject_transfer(
    transfer_id: str,
    user: User = Depends(get_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Trusted person rejects a PENDING_GUARDIAN transfer."""
    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()

    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != "PENDING_GUARDIAN":
        raise HTTPException(status_code=400, detail=f"Transfer is '{transfer.status}', not PENDING_GUARDIAN")

    sender_acct_result = await db.execute(
        select(Account).where(Account.id == transfer.sender_account_id)
    )
    sender_acct = sender_acct_result.scalar_one_or_none()
    sender_user_result = await db.execute(
        select(User).where(User.id == sender_acct.owner_id)
    )
    sender_user = sender_user_result.scalar_one_or_none()
    if not sender_user or sender_user.trusted_person_id != user.id:
        raise HTTPException(status_code=403, detail="Only the designated trusted person can reject this transaction.")

    transfer.status = "FAILED"
    await db.commit()
    await db.refresh(transfer)

    try:
        await create_audit_entry(db, transfer.id, "GUARDIAN_REJECTED", {
            "guardian_id": user.id,
            "amount": transfer.amount,
        })
        await db.commit()
    except Exception:
        pass

    return transfer


# ════════════════════════════════════════════════════════════════════════
# MAKER-CHECKER (Four Eyes Principle) & ADMIN ENDPOINTS
# ════════════════════════════════════════════════════════════════════════

@router.get("/admin/pending", response_model=list[TransferOut])
async def get_pending_transfers(
    user: User = Depends(get_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: fetch all high-value corporate transfers awaiting Maker/Checker approval."""
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role required for Maker/Checker Ops.")
    
    result = await db.execute(
        select(Transfer)
        .where(Transfer.status == "PENDING_APPROVAL")
        .order_by(Transfer.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{transfer_id}/approve", response_model=TransferOut)
async def approve_transfer(
    transfer_id: str,
    user: User = Depends(get_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Approve a PENDING_APPROVAL transfer and execute double-entry."""
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role required")

    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()

    if not transfer or transfer.status != "PENDING_APPROVAL":
        raise HTTPException(status_code=404, detail="Pending transfer not found")

    # Cryptographic Separation of Duties (Four Eyes)
    acct_res = await db.execute(select(Account.owner_id).where(Account.id == transfer.sender_account_id))
    owner_id = acct_res.scalar_one_or_none()

    if owner_id == user.id:
        raise HTTPException(
            status_code=403,
            detail="Four Eyes Principle Violated: The Maker (Initiator) cannot be the Checker (Approver)."
        )

    try:
        transfer = await _execute_deferred_transfer(db, transfer)
        transfer.checker_id = user.id
        await db.commit()
        await db.refresh(transfer)
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Approval execution failed: {str(exc)}")

    try:
        await create_audit_entry(db, transfer.id, "MAKER_CHECKER_APPROVED", {"checker_id": user.id})
        await db.commit()
    except Exception as exc:
        import logging
        logging.getLogger("transfers").error("Audit entry failed for MAKER_CHECKER_APPROVED on %s: %s", transfer.id, exc)

    return transfer


@router.post("/{transfer_id}/reject", response_model=TransferOut)
async def reject_transfer(
    transfer_id: str,
    user: User = Depends(get_user_or_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Reject a PENDING_APPROVAL transfer (hard fail)."""
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role required")

    result = await db.execute(select(Transfer).where(Transfer.id == transfer_id))
    transfer = result.scalar_one_or_none()

    if not transfer or transfer.status != "PENDING_APPROVAL":
        raise HTTPException(status_code=404, detail="Pending transfer not found")

    transfer.status = "FAILED"
    transfer.checker_id = user.id
    
    await db.commit()
    await db.refresh(transfer)

    try:
        await create_audit_entry(db, transfer.id, "MAKER_CHECKER_REJECTED", {"checker_id": user.id})
        await db.commit()
    except Exception as exc:
        import logging
        logging.getLogger("transfers").error("Audit entry failed for MAKER_CHECKER_REJECTED on %s: %s", transfer.id, exc)

    return transfer
