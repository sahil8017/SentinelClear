"""Account router — create, deposit, balance (with Redis cache + snapshot fallback)."""

from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, get_read_db
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
            account = Account(owner_id=user.id, account_type="savings", balance=Decimal("0.00"))
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


TREASURY_ACCOUNT_ID = "00000000-0000-0000-0000-000000000000"


@router.get("/directory", response_model=list[DirectoryOut])
async def get_account_directory(
    query: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List other bank accounts with optional username/ID filtering.

    Security filters applied:
      1. Excludes the currently authenticated user (prevents self-transfers).
      2. Excludes ADMIN role users.
      3. Excludes the System/Treasury account (prevents transfers to internal ledger).
    """
    stmt = (
        select(User.username, Account.id, Account.account_type)
        .join(Account, User.id == Account.owner_id)
        .where(User.id != user.id)
        .where(User.role != 'ADMIN')
        .where(Account.id != TREASURY_ACCOUNT_ID)
    )
    
    if query:
        # Escape SQL LIKE wildcards to prevent enumeration via % or _ injection
        safe_query = query.replace("%", r"\%").replace("_", r"\_")
        # Case-insensitive search on username or exact match on ID
        stmt = stmt.where(
            (User.username.ilike(f"%{safe_query}%", escape="\\")) | (Account.id == query)
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
    """Deposit money into an account (supports 'me' shortcut).

    Creates a formal ledger CREDIT entry and audit trail so that
    deposits are visible in reconciliation and PDF statements.
    """
    import uuid as _uuid
    from app.models import Transfer, LedgerEntry
    from app.services.audit import create_audit_entry

    account = await resolve_account(account_id, user, db)
    # Update balances: DEBIT Treasury (-), CREDIT User (+)
    TREASURY_ACCOUNT_ID = "00000000-0000-0000-0000-000000000000"
    account.balance += body.amount
    
    # Update Treasury account if it exists, otherwise create it
    res_treasury = await db.execute(select(Account).where(Account.id == TREASURY_ACCOUNT_ID))
    treasury = res_treasury.scalar_one_or_none()
    
    if not treasury:
        # We need a system owner for the treasury account. Let's find or create a system user.
        res_system_user = await db.execute(select(User).where(User.username == "system"))
        system_user = res_system_user.scalar_one_or_none()
        if not system_user:
            system_user = User(
                username="system",
                email="system@sentinelclear.local",
                hashed_password="not_a_real_password",
                role="ADMIN"
            )
            db.add(system_user)
            await db.flush()
            
        treasury = Account(
            id=TREASURY_ACCOUNT_ID,
            owner_id=system_user.id,
            account_type="treasury",
            balance=Decimal("0.00")
        )
        db.add(treasury)
        await db.flush()

    treasury.balance -= body.amount
    treasury_balance_after = treasury.balance

    # Create synthetic Transfer record
    deposit_transfer_id = str(_uuid.uuid4())
    deposit_transfer = Transfer(
        id=deposit_transfer_id,
        sender_account_id=TREASURY_ACCOUNT_ID,
        receiver_account_id=account.id,
        amount=body.amount,
        status="COMPLETED",
        risk_score=0.0,
        reference="Deposit",
    )
    db.add(deposit_transfer)
    await db.flush()

    # ── Double-Entry: DEBIT Treasury, CREDIT User ──
    debit_entry = LedgerEntry(
        transfer_id=deposit_transfer_id,
        account_id=TREASURY_ACCOUNT_ID,
        entry_type="DEBIT",
        amount=body.amount,
        balance_after=treasury_balance_after,
    )
    credit_entry = LedgerEntry(
        transfer_id=deposit_transfer_id,
        account_id=account.id,
        entry_type="CREDIT",
        amount=body.amount,
        balance_after=account.balance,
    )
    db.add_all([debit_entry, credit_entry])

    # SHA-256 hash-chained audit trail
    try:
        await create_audit_entry(db, deposit_transfer_id, "MANUAL_DEPOSIT", {
            "account_id": account.id,
            "user_id": user.id,
            "amount": body.amount,
            "balance_after": account.balance,
        })
    except Exception:
        pass  # Audit is best-effort — don't block the deposit

    await db.commit()
    await db.refresh(account)

    # Invalidate cache
    await redis_cache.invalidate_balance(account.id)

    return account


# ════════════════════════════════════════════════════════════════════════
# UPI SAFETY: EMERGENCY KILL SWITCH
# ════════════════════════════════════════════════════════════════════════

from passlib.context import CryptContext as _KSCrypt
from app.schemas import KillSwitchToggle, KillSwitchResponse, AnnualLimitStatus
from app.config import settings as _ks_settings
from datetime import datetime as _ks_dt, timezone as _ks_tz

_ks_ctx = _KSCrypt(schemes=["bcrypt"], deprecated="auto")


@router.post("/kill-switch/activate", response_model=KillSwitchResponse)
async def activate_kill_switch(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate the Emergency Kill Switch — instantly freeze ALL outgoing UPI payments.

    UPI Safety Rule 3: This is a panic button for users who suspect their
    phone is hacked or are in an emergency situation. No PIN required to activate.
    """
    user.kill_switch_active = True
    user.kill_switch_activated_at = _ks_dt.now(_ks_tz.utc)
    await db.commit()

    return KillSwitchResponse(
        active=True,
        activated_at=user.kill_switch_activated_at,
        message="🚨 EMERGENCY KILL SWITCH ACTIVATED — All outgoing payments are now suspended.",
    )


@router.post("/kill-switch/deactivate", response_model=KillSwitchResponse)
async def deactivate_kill_switch(
    body: KillSwitchToggle,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate the Emergency Kill Switch — resume outgoing payments.

    Requires transaction PIN verification to prevent an attacker
    from re-enabling payments on a compromised device.
    """
    if not user.kill_switch_active:
        return KillSwitchResponse(
            active=False,
            message="Kill switch is not active.",
        )

    # Require PIN to deactivate
    if not body.pin:
        raise HTTPException(
            status_code=400,
            detail="Transaction PIN required to deactivate the kill switch.",
        )

    if not user.transaction_pin_hash:
        raise HTTPException(
            status_code=400,
            detail="No transaction PIN configured. Please set one via /auth/transaction-pin first.",
        )

    if not _ks_ctx.verify(body.pin, user.transaction_pin_hash):
        raise HTTPException(
            status_code=403,
            detail="Incorrect transaction PIN. Kill switch remains active.",
        )

    user.kill_switch_active = False
    user.kill_switch_activated_at = None
    await db.commit()

    return KillSwitchResponse(
        active=False,
        message="Kill switch deactivated. Outgoing payments are now resumed.",
    )


@router.get("/kill-switch/status", response_model=KillSwitchResponse)
async def get_kill_switch_status(
    user: User = Depends(get_current_user),
):
    """Check the current state of the user's Emergency Kill Switch."""
    return KillSwitchResponse(
        active=user.kill_switch_active,
        activated_at=user.kill_switch_activated_at if user.kill_switch_active else None,
        message="Kill switch is ACTIVE." if user.kill_switch_active else "Kill switch is inactive.",
    )


@router.get("/annual-limit/status", response_model=AnnualLimitStatus)
async def get_annual_limit_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the annual receiving limit usage for the user's primary account."""
    result = await db.execute(
        select(Account)
        .where(Account.owner_id == user.id)
        .order_by(Account.created_at.asc())
    )
    account = result.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="No account found")

    limit = _ks_settings.UPI_ANNUAL_RECEIVING_LIMIT
    remaining = max(0.0, limit - account.annual_received)

    return AnnualLimitStatus(
        account_id=account.id,
        annual_received=account.annual_received,
        annual_limit=limit,
        fiscal_year=account.annual_received_fy,
        is_frozen=account.is_frozen,
        remaining=remaining,
    )
