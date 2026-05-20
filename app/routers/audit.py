"""Audit router — verify the tamper-evident SHA-256 hash chain."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, get_read_db
from app.dependencies import require_admin
from app.models import User, AuditLog
from app.schemas import AuditVerifyResponse
from app.services.audit import verify_chain
from sqlalchemy import select

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/verify", response_model=AuditVerifyResponse)
async def verify_global_audit_chain(
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    sender_result = await db.execute(select(AuditLog.sender_account_id).distinct())
    receiver_result = await db.execute(select(AuditLog.receiver_account_id).distinct())
    
    senders = {row for row in sender_result.scalars() if row}
    receivers = {row for row in receiver_result.scalars() if row}
    all_accounts = senders.union(receivers)
    
    total_checked = 0
    total_entries_count = 0
    for account_id in all_accounts:
        result = await verify_chain(db, account_id, 1, 1000000)
        if not result["intact"]:
            return AuditVerifyResponse(**result)
        total_checked += result["entries_checked"]
        total_entries_count += result["total_entries"]
        
    return AuditVerifyResponse(
        intact=True,
        total_entries=total_entries_count,
        entries_checked=total_checked,
        first_tampered_at=None,
        message=f"Global chain intact - {total_checked} entries verified across {len(all_accounts)} accounts."
    )


@router.get("/verify/{account_id}", response_model=AuditVerifyResponse)
async def verify_audit_chain(
    account_id: str,
    page: int = 1,
    page_size: int = 1000,
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await verify_chain(db, account_id, page, page_size)
    return AuditVerifyResponse(**result)
