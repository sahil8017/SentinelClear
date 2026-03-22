"""Pydantic request / response schemas for SentinelClear."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


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
    created_at: datetime

    class Config:
        from_attributes = True


class FraudBlockedResponse(BaseModel):
    """Returned when a transfer is blocked by fraud detection."""
    detail: str
    risk_score: float
    transfer_id: str


# ────────────────────────────── Audit ──────────────────────────────


class AuditVerifyResponse(BaseModel):
    intact: bool
    message: str
    total_entries: int
    tamper_position: Optional[int] = None


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


# ────────────────────────────── Sarvam AI ──────────────────────────────


class TranslateRequest(BaseModel):
    text: str = Field(..., max_length=2000)
    source_language: str = Field(default="en-IN")
    target_language: str = Field(..., description="e.g. hi-IN, ta-IN, bn-IN")


class TranslateResponse(BaseModel):
    original_text: str
    translated_text: str
    source_language: str
    target_language: str


class InsightsRequest(BaseModel):
    question: Optional[str] = Field(default=None, description="Optional specific question about spending")


class InsightsResponse(BaseModel):
    insights: str
    transaction_count: int
    total_spent: float
    total_received: float


class FraudExplainResponse(BaseModel):
    transfer_id: str
    risk_score: float
    explanation: str
    recommendation: str

