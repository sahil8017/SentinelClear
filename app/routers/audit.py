"""Audit router — verify the tamper-evident SHA-256 hash chain."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, get_read_db
from app.dependencies import require_admin
from app.models import User
from app.schemas import AuditVerifyResponse
from app.services.audit import verify_chain

router = APIRouter(prefix="/audit", tags=["Audit"])


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
