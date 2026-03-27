"""Pydantic request / response schemas for SentinelClear."""

from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, Field


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
    balance: float
    created_at: datetime

    class Config:
        from_attributes = True


class BalanceOut(BaseModel):
    account_id: str
    balance: float


class DepositRequest(BaseModel):
    amount: float = Field(..., gt=0)


# ────────────────────────────── Transfer ──────────────────────────────


class TransferRequest(BaseModel):
    sender_account_id: str
    receiver_account_id: str
    amount: float = Field(..., gt=0)


class TransferOut(BaseModel):
    id: str
    sender_account_id: str
    receiver_account_id: str
    amount: float
    status: str
    risk_score: Optional[float] = None
    fraud_rules_triggered: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


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
    amount: float
    balance_after: float
    created_at: datetime

    class Config:
        from_attributes = True


class LedgerVerifyResponse(BaseModel):
    balanced: bool
    total_debits: float
    total_credits: float
    difference: float
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
    threshold_value: Optional[float] = None
    description: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class FraudRuleConfigUpdate(BaseModel):
    weight: Optional[float] = Field(None, ge=0.0, le=5.0)
    enabled: Optional[bool] = None
    threshold_value: Optional[float] = None


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
    total_sent: float
    total_received: float
    transfer_count: int
    flagged_count: int

    class Config:
        from_attributes = True


class AnalyticsSummary(BaseModel):
    account_id: str
    period_days: int
    total_sent: float
    total_received: float
    net_flow: float
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
