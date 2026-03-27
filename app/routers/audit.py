"""Audit router — verify the tamper-evident SHA-256 hash chain."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import AuditVerifyResponse
from app.services.audit import verify_chain

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/verify", response_model=AuditVerifyResponse)
async def verify_audit_chain(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Walk the entire audit log and verify every SHA-256 link in the chain.

    Returns a verification report with:
    - intact: whether the chain is fully valid
    - total_entries: number of entries in the log
    - entries_checked: number of entries that were verified
    - first_tampered_at: ID of first tampered entry (null if intact)

    Demo tip: manually UPDATE an audit_logs row in Postgres,
    then call this endpoint to watch it catch the tamper.
    """
    result = await verify_chain(db)
    return AuditVerifyResponse(**result)
