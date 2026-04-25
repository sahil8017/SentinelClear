"""Pydantic request / response schemas for SentinelClear."""

from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_serializer


# ────────────────────────────── Auth ──────────────────────────────


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=120)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str = "USER"
    full_name: Optional[str] = None
    occupation: Optional[str] = None
    profile_complete: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# ────────────────────────────── Account ──────────────────────────────


class AccountCreate(BaseModel):
    account_type: str = Field(default="savings", max_length=20)


class AccountOut(BaseModel):
    id: str
    owner_id: int
    account_type: str
    balance: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class BalanceOut(BaseModel):
    account_id: str
    balance: Decimal


class DirectoryOut(BaseModel):
    username: str
    account_id: str
    account_type: str


class DepositRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)


# ────────────────────────────── Transfer ──────────────────────────────


class TransferRequest(BaseModel):
    sender_account_id: Optional[str] = None
    receiver_account_id: str
    amount: Decimal = Field(..., gt=0)
    currency: Optional[str] = "INR"
    reference: Optional[str] = None
    route: Optional[str] = Field(default="IMPS", description="Routing method: IMPS, NEFT, or RTGS")
    ip_override: Optional[str] = Field(default=None, description="Test hook for geo-velocity")


class TransferOut(BaseModel):
    id: str
    sender_account_id: str
    receiver_account_id: str
    amount: Decimal
    status: str
    risk_score: Optional[float] = None
    ml_risk_score: Optional[float] = None
    fraud_rules_triggered: Optional[str] = None
    source_ip: Optional[str] = None
    source_city: Optional[str] = None
    reference: Optional[str] = None
    auth_challenge_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("created_at")
    def serialize_dt(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")


class FraudBlockedResponse(BaseModel):
    detail: str
    risk_score: float
    transfer_id: str
    rules_triggered: list[str] = []
    decision: str  # REVIEW or BLOCK


# ────────────────────────────── Audit ──────────────────────────────


class AuditVerifyResponse(BaseModel):
    intact: bool
    total_entries: int
    entries_checked: int
    first_tampered_at: Optional[int] = None
    message: str


# ────────────────────────────── Health ──────────────────────────────


class HealthResponse(BaseModel):
    status: str
    database: str
    rabbitmq: str
    redis: str = "unknown"


# ────────────────────────────── Ledger ──────────────────────────────


class LedgerEntryOut(BaseModel):
    id: int
    transfer_id: str
    account_id: str
    entry_type: str
    amount: Decimal
    balance_after: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class LedgerVerifyResponse(BaseModel):
    balanced: bool
    total_debits: Decimal
    total_credits: Decimal
    difference: Decimal
    total_entries: int
    message: str


# ────────────────────────────── Fraud Dashboard ──────────────────────────────


class FraudDashboardResponse(BaseModel):
    total_transfers: int
    completed: int
    flagged: int
    failed: int
    flagged_rate: float
    top_rules_triggered: list[dict]      # [{rule: str, count: int}]
    recent_flagged: list[TransferOut]
    risk_distribution: dict              # {low: int, medium: int, high: int, critical: int}


class FraudRuleConfigOut(BaseModel):
    rule_name: str
    weight: float
    enabled: bool
    threshold_value: Optional[Decimal] = None
    description: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class FraudRuleConfigUpdate(BaseModel):
    weight: Optional[float] = Field(None, ge=0.0, le=5.0)
    enabled: Optional[bool] = None
    threshold_value: Optional[Decimal] = None


# ────────────────────────────── Notifications ──────────────────────────────


class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    reference_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationMarkRead(BaseModel):
    notification_ids: list[int]


# ────────────────────────────── Analytics ──────────────────────────────


class DailyStatOut(BaseModel):
    account_id: str
    stat_date: date
    total_sent: Decimal
    total_received: Decimal
    transfer_count: int
    flagged_count: int

    class Config:
        from_attributes = True


class AnalyticsSummary(BaseModel):
    account_id: str
    period_days: int
    total_sent: Decimal
    total_received: Decimal
    net_flow: Decimal
    total_transfers: int
    total_flagged: int
    daily_stats: list[DailyStatOut]


# ────────────────────────────── Statement ──────────────────────────────


class StatementRequest(BaseModel):
    days: int = Field(default=30, ge=1, le=365, description="Number of days to include")


# ────────────────────────────── Reconciliation ──────────────────────────────


class ReconciliationOut(BaseModel):
    id: int
    run_at: datetime
    total_accounts: int
    accounts_checked: int
    discrepancies_found: int
    discrepancy_details: Optional[str] = None
    status: str
    duration_ms: Optional[int] = None

    class Config:
        from_attributes = True


# ────────────────────────────── Developer Platform (BaaS) ──────────────────────────────


class ApiKeyOut(BaseModel):
    prefix: str
    created_at: datetime

    class Config:
        from_attributes = True


class ApiKeyResponse(BaseModel):
    raw_key: str
    prefix: str


class WebhookCreate(BaseModel):
    target_url: str = Field(..., max_length=500)


class WebhookOut(BaseModel):
    id: int
    target_url: str
    created_at: datetime

    class Config:
        from_attributes = True


# ────────────────────────────── Credit & Lending ──────────────────────────────


class LoanCreate(BaseModel):
    principal_amount: Decimal = Field(..., gt=0)
    duration_months: int = Field(default=12, gt=0)


class LoanOut(BaseModel):
    id: str
    user_id: int
    principal_amount: Decimal
    outstanding_balance: Decimal
    interest_rate: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class LoanRepaymentOut(BaseModel):
    id: int
    loan_id: str
    amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class LoanRepaymentRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)


# ────────────────────────────── Credit Profile & Scoring ──────────────────────────────


class CreditProfileCreate(BaseModel):
    """User-provided financial indicators for credit assessment."""
    monthly_income: Decimal = Field(..., gt=0, description="Gross monthly income in INR")
    existing_liabilities: Decimal = Field(default=0.0, ge=0, description="Existing monthly EMI/debt obligations")
    total_assets: Decimal = Field(default=0.0, ge=0, description="Total value of savings, investments, property")
    employment_type: str = Field(default="salaried", description="salaried, self_employed, freelancer, unemployed")
    employment_years: float = Field(default=0.0, ge=0, description="Years of employment / business tenure")
    age: int = Field(default=25, ge=18, le=80, description="Age of the applicant")
    dependents: int = Field(default=0, ge=0, le=15, description="Number of financial dependents")
    residence_type: str = Field(default="rented", description="owned, rented, parental")


class CreditProfileOut(BaseModel):
    """Full credit profile returned by the API."""
    user_id: int
    monthly_income: Decimal
    existing_liabilities: Decimal
    total_assets: Decimal
    employment_type: str
    employment_years: float
    age: int
    dependents: int
    residence_type: str
    repayment_history_score: float
    account_age_months: int
    avg_monthly_balance: Decimal
    num_previous_loans: int
    num_defaults: int
    transaction_regularity: float
    credit_score: int
    foir: float
    debt_to_income: float
    ml_eligibility_score: Optional[float] = None
    ml_risk_category: Optional[str] = None
    last_assessed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CreditAssessmentOut(BaseModel):
    """Result of running the ML credit assessment pipeline."""
    credit_score: int
    credit_rating: str                  # e.g., "EXCELLENT", "GOOD", "FAIR", "POOR"
    foir: float
    debt_to_income: float
    ml_eligibility_score: float         # Probability of loan eligibility
    ml_risk_category: str               # LOW, MEDIUM, HIGH, VERY_HIGH
    eligible: bool
    max_eligible_amount: Decimal          # Maximum loan principal based on risk
    recommended_interest_rate: float    # Risk-adjusted interest rate
    explanation: list[dict]             # XAI breakdown
    rbi_remarks: list[str]              # Regulatory observations


class LoanEligibilityOut(BaseModel):
    """Pre-approval check response — used before formal application."""
    eligible: bool
    credit_score: int
    max_loan_amount: Decimal
    recommended_tenure_months: int
    interest_rate: float
    monthly_emi: Decimal
    risk_category: str
    reasons: list[str]


class WhitelistAdd(BaseModel):
    contact_account_id: str = Field(..., description="Account ID to whitelist")
    nickname: Optional[str] = Field(None, max_length=100, description="Optional friendly name")


class WhitelistedContactOut(BaseModel):
    id: str
    contact_account_id: str
    nickname: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class KillSwitchToggle(BaseModel):
    pin: Optional[str] = Field(None, min_length=4, max_length=6,
                               description="Transaction PIN required to deactivate")


class KillSwitchResponse(BaseModel):
    active: bool
    activated_at: Optional[datetime] = None
    message: str


class ProfileUpdate(BaseModel):
    date_of_birth: Optional[date] = None
    is_disabled: Optional[bool] = None


class ProfileOut(BaseModel):
    id: int
    username: str
    email: str
    role: str = "USER"
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    occupation: Optional[str] = None
    profile_complete: bool = False
    is_disabled: bool = False
    trusted_person_username: Optional[str] = None
    kill_switch_active: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TrustedPersonSet(BaseModel):
    username: str = Field(..., description="Username of the trusted person to designate as guardian")


class TrustedPersonResponse(BaseModel):
    trusted_person_id: Optional[int] = None
    trusted_person_username: Optional[str] = None
    message: str


class TransferPausedResponse(BaseModel):
    detail: str
    transfer_id: str
    status: str = "PAUSED"
    cooldown_seconds: int
    message: str = "Confirm or cancel this transaction within the cooldown period."


class GuardianPendingResponse(BaseModel):
    detail: str
    transfer_id: str
    status: str = "PENDING_GUARDIAN"
    guardian_username: Optional[str] = None
    message: str = "Your trusted person must approve this transaction."


class AnnualLimitStatus(BaseModel):
    account_id: str
    annual_received: Decimal
    annual_limit: Decimal
    fiscal_year: Optional[str] = None
    is_frozen: bool
    remaining: Decimal
