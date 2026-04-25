"""Loans router — credit profiles, eligibility checks, loan applications, EMI repayments.

Integrates the ML-powered credit scoring engine with RBI-aligned lending rules.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import json
from datetime import datetime, timezone

from app.database import get_db, get_read_db
from app.dependencies import get_current_user, require_admin
from app.models import User, Loan, LoanRepayment, CreditProfile, Account
from app.schemas import (
    LoanCreate, LoanOut, LoanRepaymentOut, LoanRepaymentRequest,
    CreditProfileCreate, CreditProfileOut, CreditAssessmentOut,
    LoanEligibilityOut,
)
from app.services.loan_service import apply_for_loan, approve_loan, process_repayment
from app.services.ml_loan_service import predict_loan_eligibility, compute_credit_score

router = APIRouter(prefix="/loans", tags=["Loans & Credit"])


# ────────────────────────────── Credit Profile ──────────────────────────────


@router.post("/credit-profile", response_model=CreditProfileOut, status_code=status.HTTP_201_CREATED)
async def create_or_update_credit_profile(
    body: CreditProfileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update the user's financial profile for credit assessment.

    This is the KYC-adjacent financial data collection step required
    before any loan application. Inspired by CIBIL data requirements.
    """
    # Validate employment type
    valid_emp = {"salaried", "self_employed", "freelancer", "unemployed"}
    if body.employment_type not in valid_emp:
        raise HTTPException(status_code=400, detail=f"Invalid employment_type. Use: {valid_emp}")

    valid_res = {"owned", "rented", "parental"}
    if body.residence_type not in valid_res:
        raise HTTPException(status_code=400, detail=f"Invalid residence_type. Use: {valid_res}")

    result = await db.execute(
        select(CreditProfile).where(CreditProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    # Derive behavioural metrics from on-platform data
    acct_result = await db.execute(
        select(Account).where(Account.owner_id == user.id).order_by(Account.created_at.asc())
    )
    accounts = acct_result.scalars().all()
    account_age_months = 0
    avg_balance = 0.0
    if accounts:
        oldest = accounts[0]
        delta = datetime.now(timezone.utc).replace(tzinfo=None) - oldest.created_at
        account_age_months = max(int(delta.days / 30), 1)
        avg_balance = sum(a.balance for a in accounts) / len(accounts)

    # Count previous loans and defaults
    loan_result = await db.execute(select(Loan).where(Loan.user_id == user.id))
    user_loans = loan_result.scalars().all()
    num_previous = len(user_loans)
    num_defaults = sum(1 for l in user_loans if l.status == "REJECTED")

    # Transaction regularity (simplified: based on whether user has accounts)
    txn_regularity = min(0.5 + (len(accounts) * 0.1) + (num_previous * 0.05), 1.0)

    # Repayment score from completed loans
    closed_loans = [l for l in user_loans if l.status == "CLOSED"]
    if num_previous > 0:
        repayment_score = min(len(closed_loans) / max(num_previous, 1) * 0.8 + 0.2, 1.0)
    else:
        repayment_score = 0.5  # Neutral for new users

    # FOIR & DTI
    foir = body.existing_liabilities / body.monthly_income if body.monthly_income > 0 else 1.0
    dti = (body.existing_liabilities * 12) / (body.monthly_income * 12) if body.monthly_income > 0 else 1.0

    # Credit score
    credit_score = compute_credit_score(
        repayment_score, num_defaults, account_age_months,
        dti, body.employment_years, foir, avg_balance, body.monthly_income,
    )

    if profile:
        # Update
        profile.monthly_income = body.monthly_income
        profile.existing_liabilities = body.existing_liabilities
        profile.total_assets = body.total_assets
        profile.employment_type = body.employment_type
        profile.employment_years = body.employment_years
        profile.age = body.age
        profile.dependents = body.dependents
        profile.residence_type = body.residence_type
        profile.repayment_history_score = repayment_score
        profile.account_age_months = account_age_months
        profile.avg_monthly_balance = avg_balance
        profile.num_previous_loans = num_previous
        profile.num_defaults = num_defaults
        profile.transaction_regularity = txn_regularity
        profile.credit_score = credit_score
        profile.foir = round(foir, 4)
        profile.debt_to_income = round(dti, 4)
    else:
        profile = CreditProfile(
            user_id=user.id,
            monthly_income=body.monthly_income,
            existing_liabilities=body.existing_liabilities,
            total_assets=body.total_assets,
            employment_type=body.employment_type,
            employment_years=body.employment_years,
            age=body.age,
            dependents=body.dependents,
            residence_type=body.residence_type,
            repayment_history_score=repayment_score,
            account_age_months=account_age_months,
            avg_monthly_balance=avg_balance,
            num_previous_loans=num_previous,
            num_defaults=num_defaults,
            transaction_regularity=txn_regularity,
            credit_score=credit_score,
            foir=round(foir, 4),
            debt_to_income=round(dti, 4),
        )
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/credit-profile", response_model=CreditProfileOut)
async def get_my_credit_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the current user's credit profile and score."""
    result = await db.execute(
        select(CreditProfile).where(CreditProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Credit profile not found. Submit your financial details first via POST /loans/credit-profile."
        )
    return profile


# ────────────────────────────── Eligibility Check ──────────────────────────────


@router.post("/check-eligibility", response_model=CreditAssessmentOut)
async def check_loan_eligibility(
    body: LoanCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run full ML-powered credit assessment for a loan request.

    Prerequisites: User must have a credit profile (POST /loans/credit-profile).
    Returns explainable AI reasoning, CIBIL score, RBI remarks, and eligibility verdict.
    """
    # Fetch credit profile
    result = await db.execute(
        select(CreditProfile).where(CreditProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="Credit profile required. Submit financial details via POST /loans/credit-profile first."
        )

    # RBI validation
    MAX_LOAN_AMOUNT = 500000.0
    MAX_TENURE_MONTHS = 60

    if body.principal_amount > MAX_LOAN_AMOUNT:
        raise HTTPException(
            status_code=400,
            detail=f"Loan principal exceeds regulatory limit of ₹{MAX_LOAN_AMOUNT:,.2f}"
        )
    if body.duration_months > MAX_TENURE_MONTHS:
        raise HTTPException(
            status_code=400,
            detail=f"Loan tenure exceeds maximum of {MAX_TENURE_MONTHS} months."
        )
    if body.principal_amount < 1000:
        raise HTTPException(status_code=400, detail="Minimum loan amount is ₹1,000.")
    if body.duration_months < 3:
        raise HTTPException(status_code=400, detail="Minimum tenure is 3 months.")

    # Build profile data dict
    profile_data = {
        "monthly_income": profile.monthly_income,
        "existing_liabilities": profile.existing_liabilities,
        "total_assets": profile.total_assets,
        "employment_type": profile.employment_type,
        "employment_years": profile.employment_years,
        "age": profile.age,
        "dependents": profile.dependents,
        "residence_type": profile.residence_type,
        "repayment_history_score": profile.repayment_history_score,
        "account_age_months": profile.account_age_months,
        "avg_monthly_balance": profile.avg_monthly_balance,
        "num_previous_loans": profile.num_previous_loans,
        "num_defaults": profile.num_defaults,
        "transaction_regularity": profile.transaction_regularity,
    }

    # Run ML assessment
    assessment = predict_loan_eligibility(
        profile_data, body.principal_amount, body.duration_months,
    )

    # Update profile with latest scores
    profile.credit_score = assessment["credit_score"]
    profile.foir = assessment["foir"]
    profile.debt_to_income = assessment["debt_to_income"]
    profile.ml_eligibility_score = assessment["ml_eligibility_score"]
    profile.ml_risk_category = assessment["ml_risk_category"]
    profile.ml_explanation = json.dumps(assessment["explanation"])
    profile.last_assessed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()

    return CreditAssessmentOut(
        credit_score=assessment["credit_score"],
        credit_rating=assessment["credit_rating"],
        foir=assessment["foir"],
        debt_to_income=assessment["debt_to_income"],
        ml_eligibility_score=assessment["ml_eligibility_score"],
        ml_risk_category=assessment["ml_risk_category"],
        eligible=assessment["eligible"],
        max_eligible_amount=assessment["max_eligible_amount"],
        recommended_interest_rate=assessment["recommended_interest_rate"],
        explanation=assessment["explanation"],
        rbi_remarks=assessment["rbi_remarks"],
    )


# ────────────────────────────── Loan Application ──────────────────────────────


@router.post("/apply", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
async def create_loan_application(
    body: LoanCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply for a new loan. Requires credit profile and eligibility check.

    The system runs an ML assessment during application and may auto-reject
    very high-risk applications per RBI responsible lending norms.
    """
    # Check for existing active/pending loans
    existing = await db.execute(
        select(Loan).where((Loan.user_id == user.id) & (Loan.status.in_(["PENDING", "ACTIVE"])))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have an active or pending loan.")

    # RBI constraints
    MAX_LOAN_AMOUNT = 500000.0
    MAX_TENURE_MONTHS = 60

    if body.principal_amount > MAX_LOAN_AMOUNT:
        raise HTTPException(
            status_code=400,
            detail=f"Loan principal exceeds regulatory limit of ₹{MAX_LOAN_AMOUNT:,.2f}"
        )
    if body.duration_months > MAX_TENURE_MONTHS:
        raise HTTPException(
            status_code=400,
            detail=f"Loan tenure exceeds maximum of {MAX_TENURE_MONTHS} months."
        )
    if body.principal_amount < 1000:
        raise HTTPException(status_code=400, detail="Minimum loan amount is ₹1,000.")
    if body.duration_months < 3:
        raise HTTPException(status_code=400, detail="Minimum tenure is 3 months.")

    # Fetch credit profile (required)
    result = await db.execute(
        select(CreditProfile).where(CreditProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="Complete your credit profile before applying for a loan."
        )

    # Run ML eligibility
    profile_data = {
        "monthly_income": profile.monthly_income,
        "existing_liabilities": profile.existing_liabilities,
        "total_assets": profile.total_assets,
        "employment_type": profile.employment_type,
        "employment_years": profile.employment_years,
        "age": profile.age,
        "dependents": profile.dependents,
        "residence_type": profile.residence_type,
        "repayment_history_score": profile.repayment_history_score,
        "account_age_months": profile.account_age_months,
        "avg_monthly_balance": profile.avg_monthly_balance,
        "num_previous_loans": profile.num_previous_loans,
        "num_defaults": profile.num_defaults,
        "transaction_regularity": profile.transaction_regularity,
    }

    assessment = predict_loan_eligibility(
        profile_data, body.principal_amount, body.duration_months,
    )

    # Update profile
    profile.credit_score = assessment["credit_score"]
    profile.ml_eligibility_score = assessment["ml_eligibility_score"]
    profile.ml_risk_category = assessment["ml_risk_category"]
    profile.ml_explanation = json.dumps(assessment["explanation"])
    profile.last_assessed_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Auto-reject VERY_HIGH risk (credit score < 450 or FOIR > 70%)
    if assessment["ml_risk_category"] == "VERY_HIGH":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Loan application rejected — credit risk too high. "
                f"Credit Score: {assessment['credit_score']}, "
                f"Risk Category: {assessment['ml_risk_category']}. "
                f"Reason: {assessment['rbi_remarks'][0] if assessment['rbi_remarks'] else 'Insufficient creditworthiness.'}"
            ),
        )

    # Apply with risk-adjusted interest rate
    interest_rate = assessment["recommended_interest_rate"]
    loan = await apply_for_loan(
        db, user.id, body.principal_amount, interest_rate, body.duration_months,
    )

    await db.commit()
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
