"""Ledger router — double-entry accounting views and verification."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Account, User
from app.schemas import LedgerEntryOut, LedgerVerifyResponse
from app.services.ledger import get_ledger_for_account, verify_ledger_balance

router = APIRouter(prefix="/ledger", tags=["Ledger"])


@router.get("/{account_id}", response_model=list[LedgerEntryOut])
async def get_account_ledger(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all ledger entries (statement) for an account owned by the current user."""
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.owner_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found or not yours")

    entries = await get_ledger_for_account(db, account_id)
    return entries


@router.get("/verify/integrity", response_model=LedgerVerifyResponse)
async def verify_ledger(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify global ledger integrity — total debits must equal total credits."""
    result = await verify_ledger_balance(db)
    return LedgerVerifyResponse(**result)
