"""Account router — create, deposit, balance (with Redis cache + snapshot fallback)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Account, BalanceSnapshot, User
from app.schemas import AccountCreate, AccountOut, BalanceOut, DepositRequest
from app.services import cache as redis_cache

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(
    body: AccountCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new bank account for the authenticated user."""
    account = Account(owner_id=user.id, account_type=body.account_type)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}/balance", response_model=BalanceOut)
async def get_balance(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the balance of an account owned by the current user.

    Read path: Redis cache → BalanceSnapshot → DB query (read-through).
    """
    # Layer 1: Redis cache
    cached = await redis_cache.get_cached_balance(account_id)
    if cached is not None:
        # Still verify ownership before returning cached value
        result = await db.execute(
            select(Account.id).where(Account.id == account_id, Account.owner_id == user.id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Account not found or not yours")
        return BalanceOut(account_id=account_id, balance=cached)

    # Layer 2: BalanceSnapshot (faster than full account query with relationships)
    snap_result = await db.execute(
        select(BalanceSnapshot).where(BalanceSnapshot.account_id == account_id)
    )
    snapshot = snap_result.scalar_one_or_none()
    if snapshot:
        # Verify ownership
        result = await db.execute(
            select(Account.id).where(Account.id == account_id, Account.owner_id == user.id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Account not found or not yours")
        # Populate cache for next read
        await redis_cache.set_cached_balance(account_id, snapshot.balance)
        return BalanceOut(account_id=account_id, balance=snapshot.balance)

    # Layer 3: Full DB query (coldstart)
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.owner_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found or not yours")

    # Populate cache
    await redis_cache.set_cached_balance(account_id, account.balance)
    return BalanceOut(account_id=account.id, balance=account.balance)


@router.post("/{account_id}/deposit", response_model=AccountOut)
async def deposit(
    account_id: str,
    body: DepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deposit money into the authenticated user's account."""
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.owner_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found or not yours")

    account.balance += body.amount
    await db.commit()
    await db.refresh(account)

    # Invalidate cache since balance changed
    await redis_cache.invalidate_balance(account_id)

    return account
