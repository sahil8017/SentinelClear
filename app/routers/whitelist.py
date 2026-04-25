"""Whitelist router — manage whitelisted contacts for UPI Transaction Pause bypass."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, get_read_db
from app.dependencies import get_current_user
from app.models import Account, User, WhitelistedContact
from app.schemas import WhitelistAdd, WhitelistedContactOut

router = APIRouter(prefix="/whitelist", tags=["UPI Safety — Whitelist"])


@router.get("", response_model=list[WhitelistedContactOut])
async def list_whitelisted_contacts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all whitelisted contacts for the current user.

    Whitelisted contacts bypass the ₹10,000 transaction pause
    for faster transfers to trusted recipients like family members.
    """
    result = await db.execute(
        select(WhitelistedContact)
        .where(WhitelistedContact.user_id == user.id)
        .order_by(WhitelistedContact.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=WhitelistedContactOut, status_code=status.HTTP_201_CREATED)
async def add_whitelisted_contact(
    body: WhitelistAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a contact to the user's whitelist.

    Once whitelisted, transfers to this account exceeding ₹10,000
    will NOT be paused for confirmation.
    """
    # Verify the target account exists
    acct_result = await db.execute(
        select(Account).where(Account.id == body.contact_account_id)
    )
    target_acct = acct_result.scalar_one_or_none()
    if not target_acct:
        raise HTTPException(status_code=404, detail="Target account not found")

    # Prevent whitelisting own accounts
    user_acct_result = await db.execute(
        select(Account.id).where(Account.owner_id == user.id)
    )
    user_acct_ids = [row[0] for row in user_acct_result.fetchall()]
    if body.contact_account_id in user_acct_ids:
        raise HTTPException(status_code=400, detail="Cannot whitelist your own account")

    # Check if already whitelisted
    existing = await db.execute(
        select(WhitelistedContact).where(
            WhitelistedContact.user_id == user.id,
            WhitelistedContact.contact_account_id == body.contact_account_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Contact is already whitelisted")

    contact = WhitelistedContact(
        user_id=user.id,
        contact_account_id=body.contact_account_id,
        nickname=body.nickname,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_whitelisted_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a contact from the user's whitelist.

    Future transfers to this account exceeding ₹10,000 will be paused
    for confirmation again.
    """
    result = await db.execute(
        select(WhitelistedContact).where(
            WhitelistedContact.id == contact_id,
            WhitelistedContact.user_id == user.id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Whitelisted contact not found")

    await db.delete(contact)
    await db.commit()
