"""Loans router — apply for loans, approve loans, process EMIs."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import User, Loan, LoanRepayment
from app.schemas import LoanCreate, LoanOut, LoanRepaymentOut, LoanRepaymentRequest
from app.services.loan_service import apply_for_loan, approve_loan, process_repayment

router = APIRouter(prefix="/loans", tags=["Loans"])


@router.post("/apply", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
async def create_loan_application(
    body: LoanCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply for a new loan. User must not have active loans."""
    # Check if user already has an active or pending loan
    existing = await db.execute(
        select(Loan).where((Loan.user_id == user.id) & (Loan.status.in_(["PENDING", "ACTIVE"])))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have an active or pending loan.")
        
    interest_rate = 12.0 # Fixed 12% for MVP
    loan = await apply_for_loan(db, user.id, body.principal_amount, interest_rate, body.duration_months)
    return loan


@router.get("", response_model=List[LoanOut])
async def list_my_loans(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List current user's loans."""
    result = await db.execute(select(Loan).where(Loan.user_id == user.id))
    return result.scalars().all()


@router.post("/{loan_id}/repay", response_model=LoanRepaymentOut)
async def repay_loan(
    loan_id: str,
    body: LoanRepaymentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Process an EMI repayment from user accounts into the Treasury."""
    return await process_repayment(db, user.id, loan_id, body.amount)


# ────────────────────────────── Admin Operations ──────────────────────────────

@router.get("/admin/all", response_model=List[LoanOut])
async def admin_list_loans(
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(require_admin),
):
    """List all loans for Admin processing."""
    result = await db.execute(select(Loan))
    return result.scalars().all()


@router.post("/admin/{loan_id}/approve", response_model=LoanOut)
async def admin_approve_loan(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(require_admin),
):
    """Admin approves a loan, sending funds via Double-Entry from Treasury."""
    return await approve_loan(db, loan_id)


@router.post("/admin/{loan_id}/reject", response_model=LoanOut)
async def admin_reject_loan(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    _token: str = Depends(require_admin),
):
    """Admin rejects a loan application."""
    result = await db.execute(select(Loan).where(Loan.id == loan_id).with_for_update())
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.status != "PENDING":
        raise HTTPException(status_code=400, detail="Only pending loans can be rejected")
        
    loan.status = "REJECTED"
    await db.commit()
    await db.refresh(loan)
    return loan
