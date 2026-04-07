"""Lending Engine Service — Double-Entry Compliant.

Enforces:
  - Deterministic lock ordering (ascending UUID) to prevent deadlocks
  - SHA-256 hash-chained audit trail for every disbursement and repayment
  - Atomic double-entry ledger entries for all fund movements
"""

import uuid
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Loan, LoanRepayment, Account
from app.services.ledger import create_double_entry
from app.services.audit import create_audit_entry
from app.services import cache as redis_cache

TREASURY_ACCOUNT_ID = "00000000-0000-0000-0000-000000000000"


async def _ensure_treasury(db: AsyncSession) -> Account:
    """Ensure the treasury account exists. Creates it on first access."""
    result = await db.execute(select(Account).where(Account.id == TREASURY_ACCOUNT_ID))
    treasury = result.scalar_one_or_none()
    if not treasury:
        treasury = Account(
            id=TREASURY_ACCOUNT_ID,
            owner_id=1,
            account_type="treasury",
            balance=1_000_000_000.0,
        )
        db.add(treasury)
        await db.flush()
    return treasury


def _lock_order(*account_ids: str) -> list[str]:
    """Return account IDs sorted in ascending UUID order for deterministic locking."""
    return sorted(set(account_ids))


async def _acquire_locks_in_order(db: AsyncSession, account_ids: list[str]) -> dict[str, Account]:
    """Acquire SELECT FOR UPDATE locks in ascending UUID order to prevent deadlocks."""
    locked = {}
    for aid in _lock_order(*account_ids):
        result = await db.execute(
            select(Account).where(Account.id == aid).with_for_update()
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail=f"Account {aid} not found")
        locked[aid] = account
    return locked


async def apply_for_loan(
    db: AsyncSession,
    user_id: int,
    principal: float,
    interest_rate: float,
    duration_months: int = 12,
) -> Loan:
    """Create a new loan application in PENDING status."""
    loan_id = str(uuid.uuid4())
    outstanding = principal + (principal * interest_rate / 100)

    loan = Loan(
        id=loan_id,
        user_id=user_id,
        principal_amount=principal,
        outstanding_balance=outstanding,
        interest_rate=interest_rate,
        duration_months=duration_months,
        status="PENDING",
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


async def approve_loan(db: AsyncSession, loan_id: str) -> Loan:
    """Admin approves a loan — disburse funds via atomic double-entry from Treasury.

    Lock order: ascending UUID of (treasury_account, user_account).
    Treasury UUID is all-zeros so it always comes first.
    """
    # Step 1: Lock the loan row
    result = await db.execute(select(Loan).where(Loan.id == loan_id).with_for_update())
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot approve loan in status: {loan.status}")

    # Step 2: Resolve user's primary account ID (without lock yet)
    acct_result = await db.execute(
        select(Account.id)
        .where(Account.owner_id == loan.user_id)
        .order_by(Account.created_at.asc())
    )
    user_account_id = acct_result.scalar()
    if not user_account_id:
        raise HTTPException(status_code=400, detail="User has no account for disbursement")

    # Step 3: Ensure treasury exists
    await _ensure_treasury(db)

    # Step 4: Acquire locks in ASCENDING UUID ORDER (AGENTS.md rule)
    locked = await _acquire_locks_in_order(db, [TREASURY_ACCOUNT_ID, user_account_id])
    treasury_account = locked[TREASURY_ACCOUNT_ID]
    user_account = locked[user_account_id]

    # Step 5: Move funds atomically
    treasury_account.balance -= loan.principal_amount
    user_account.balance += loan.principal_amount

    # Step 6: Double-entry ledger (DEBIT treasury, CREDIT user)
    transfer_id = str(uuid.uuid4())
    await create_double_entry(
        db,
        transfer_id=transfer_id,
        sender_account_id=treasury_account.id,
        receiver_account_id=user_account.id,
        amount=loan.principal_amount,
        sender_balance_after=treasury_account.balance,
        receiver_balance_after=user_account.balance,
    )

    # Step 7: Update loan status and link to account
    loan.status = "ACTIVE"
    loan.account_id = user_account.id

    # Step 8: SHA-256 hash-chained audit trail
    await create_audit_entry(
        db,
        transfer_id=transfer_id,
        action="LOAN_DISBURSED",
        details_dict={
            "loan_id": loan.id,
            "user_id": loan.user_id,
            "account_id": user_account.id,
            "principal": loan.principal_amount,
            "interest_rate": loan.interest_rate,
            "duration_months": loan.duration_months,
            "treasury_balance_after": treasury_account.balance,
            "user_balance_after": user_account.balance,
        },
    )

    await db.refresh(loan)
    await redis_cache.invalidate_balance(user_account.id)

    return loan


async def process_repayment(
    db: AsyncSession, user_id: int, loan_id: str, amount: float
) -> LoanRepayment:
    """Process an EMI repayment — reverse double-entry from user to Treasury.

    Lock order: ascending UUID of (treasury_account, user_account).
    """
    # Step 1: Lock the loan row
    result = await db.execute(select(Loan).where(Loan.id == loan_id).with_for_update())
    loan = result.scalar_one_or_none()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your loan")
    if loan.status != "ACTIVE":
        raise HTTPException(status_code=400, detail=f"Cannot repay loan in status: {loan.status}")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # Step 2: Resolve user's primary account ID
    acct_result = await db.execute(
        select(Account.id)
        .where(Account.owner_id == user_id)
        .order_by(Account.created_at.asc())
    )
    user_account_id = acct_result.scalar()
    if not user_account_id:
        raise HTTPException(status_code=400, detail="User account not found")

    # Step 3: Ensure treasury exists
    await _ensure_treasury(db)

    # Step 4: Acquire locks in ASCENDING UUID ORDER (AGENTS.md rule)
    locked = await _acquire_locks_in_order(db, [TREASURY_ACCOUNT_ID, user_account_id])
    treasury_account = locked[TREASURY_ACCOUNT_ID]
    user_account = locked[user_account_id]

    # Step 5: Validate sufficient balance
    if user_account.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance for EMI")

    # Step 6: Move funds atomically (user → treasury)
    user_account.balance -= amount
    treasury_account.balance += amount

    # Step 7: Update loan outstanding
    loan.outstanding_balance = max(0, loan.outstanding_balance - amount)
    if loan.outstanding_balance == 0:
        loan.status = "CLOSED"

    # Step 8: Double-entry ledger (DEBIT user, CREDIT treasury)
    transfer_id = str(uuid.uuid4())
    await create_double_entry(
        db,
        transfer_id=transfer_id,
        sender_account_id=user_account.id,
        receiver_account_id=treasury_account.id,
        amount=amount,
        sender_balance_after=user_account.balance,
        receiver_balance_after=treasury_account.balance,
    )

    # Step 9: Record repayment
    repayment = LoanRepayment(loan_id=loan.id, amount=amount)
    db.add(repayment)

    # Step 10: SHA-256 hash-chained audit trail
    await create_audit_entry(
        db,
        transfer_id=transfer_id,
        action="LOAN_REPAYMENT",
        details_dict={
            "loan_id": loan.id,
            "repayment_amount": amount,
            "outstanding_after": loan.outstanding_balance,
            "loan_status": loan.status,
            "user_balance_after": user_account.balance,
            "treasury_balance_after": treasury_account.balance,
        },
    )

    await db.commit()
    await db.refresh(repayment)
    await redis_cache.invalidate_balance(user_account.id)

    return repayment
