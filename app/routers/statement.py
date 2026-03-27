"""Statement router — PDF account statement export."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Account, AuditLog, LedgerEntry, User
from app.services.pdf_statement import generate_statement_pdf

router = APIRouter(prefix="/accounts", tags=["Statements"])


@router.get("/{account_id}/statement")
async def download_statement(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365, description="Number of days to include"),
):
    """Generate and download a PDF account statement.

    Produces a professional bank statement with:
    - Account holder details
    - Transaction history with running balance
    - Summary totals (opening, credits, debits, closing)
    - Audit chain hash for tamper verification
    """
    # Verify ownership
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.owner_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found or not yours")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    # Fetch ledger entries for the period
    result = await db.execute(
        select(LedgerEntry)
        .where(
            LedgerEntry.account_id == account_id,
            LedgerEntry.created_at >= start_date,
        )
        .order_by(LedgerEntry.created_at.asc())
    )
    entries = result.scalars().all()

    # Compute opening balance (current balance minus net of period entries)
    net_period = sum(
        e.amount if e.entry_type == "CREDIT" else -e.amount
        for e in entries
    )
    opening_balance = account.balance - net_period

    # Build entry dicts for PDF
    ledger_dicts = [
        {
            "date": e.created_at,
            "transfer_id": e.transfer_id,
            "entry_type": e.entry_type,
            "amount": e.amount,
            "balance_after": e.balance_after,
        }
        for e in entries
    ]

    # Get latest audit hash for footer
    audit_result = await db.execute(
        select(AuditLog.current_hash)
        .order_by(AuditLog.id.desc())
        .limit(1)
    )
    audit_hash = audit_result.scalar_one_or_none()

    pdf_bytes = generate_statement_pdf(
        account_id=account_id,
        account_type=account.account_type,
        owner_name=user.username,
        owner_email=user.email,
        opening_balance=opening_balance,
        closing_balance=account.balance,
        ledger_entries=ledger_dicts,
        start_date=start_date,
        end_date=end_date,
        audit_hash=audit_hash,
    )

    filename = f"statement_{account_id[:8]}_{end_date.strftime('%Y%m%d')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
