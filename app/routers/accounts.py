"""Account router — create, deposit, balance (with Redis cache + snapshot fallback)."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Account, BalanceSnapshot, User
from app.schemas import AccountCreate, AccountOut, BalanceOut, DepositRequest, DirectoryOut
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


async def resolve_account(account_id: str, user: User, db: AsyncSession) -> Account:
    """Helper to resolve a specific account ID or the 'me' shortcut."""
    if account_id == "me":
        # Resolve 'me' to primary account, auto-creating if needed
        result = await db.execute(
            select(Account)
            .where(Account.owner_id == user.id)
            .order_by(Account.created_at.asc())
        )
        account = result.scalars().first()
        if not account:
            account = Account(owner_id=user.id, account_type="savings", balance=0.0)
            db.add(account)
            await db.commit()
            await db.refresh(account)
        return account

    # Standard UUID lookup - ADMINs can resolve any account, USERs only their own
    stmt = select(Account).where(Account.id == account_id)
    if user.role != "ADMIN":
        stmt = stmt.where(Account.owner_id == user.id)
    
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found or not yours")
    return account


@router.get("/me", response_model=AccountOut)
async def get_my_primary_account(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the primary/first account of the authenticated user to bootstrap the dashboard."""
    return await resolve_account("me", user, db)


@router.get("/directory", response_model=list[DirectoryOut])
async def get_account_directory(
    query: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List other bank accounts with optional username/ID filtering."""
    stmt = (
        select(User.username, Account.id, Account.account_type)
        .join(Account, User.id == Account.owner_id)
        .where(User.id != user.id)
        .where(User.role != 'ADMIN')
    )
    
    if query:
        # Case-insensitive search on username or exact match on ID
        stmt = stmt.where(
            (User.username.ilike(f"%{query}%")) | (Account.id == query)
        )
        
    result = await db.execute(stmt.limit(10))
    rows = result.fetchall()
    return [{"username": row[0], "account_id": row[1], "account_type": row[2]} for row in rows]


@router.get("/{account_id}/balance", response_model=BalanceOut)
async def get_balance(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the balance of an account (supports 'me' shortcut)."""
    account = await resolve_account(account_id, user, db)

    # Layer 1: Redis cache
    cached = await redis_cache.get_cached_balance(account.id)
    if cached is not None:
        return BalanceOut(account_id=account.id, balance=cached)

    # Layer 2: BalanceSnapshot
    snap_result = await db.execute(
        select(BalanceSnapshot).where(BalanceSnapshot.account_id == account.id)
    )
    snapshot = snap_result.scalar_one_or_none()
    if snapshot:
        await redis_cache.set_cached_balance(account.id, snapshot.balance)
        return BalanceOut(account_id=account.id, balance=snapshot.balance)

    # Layer 3: DB value
    await redis_cache.set_cached_balance(account.id, account.balance)
    return BalanceOut(account_id=account.id, balance=account.balance)


@router.post("/{account_id}/deposit", response_model=AccountOut)
async def deposit(
    account_id: str,
    body: DepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deposit money into an account (supports 'me' shortcut)."""
    account = await resolve_account(account_id, user, db)

    account.balance += body.amount
    await db.commit()
    await db.refresh(account)

    # Invalidate cache
    await redis_cache.invalidate_balance(account.id)

    return account
