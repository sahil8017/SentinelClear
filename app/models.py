"""SQLAlchemy ORM models for SentinelClear."""

import uuid
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
    Numeric,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Shared declarative base for all models."""


# ────────────────────────────── User ──────────────────────────────


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    transaction_pin_hash = Column(String(255), nullable=True)  # Secure PIN for Step-Up Auth
    role = Column(String(20), default="USER", nullable=False)
    kyc_status = Column(String(20), default="UNVERIFIED", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # ── User Profile Onboarding ──
    full_name = Column(String(100), nullable=True)
    occupation = Column(String(100), nullable=True)
    profile_complete = Column(Boolean, default=False, nullable=False)

    # ── UPI Safety: Vulnerable Group Protection ──
    date_of_birth = Column(Date, nullable=True)            # Age ≥ 70 triggers guardian approval
    is_disabled = Column(Boolean, default=False, nullable=False)  # Accessibility flag
    trusted_person_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Guardian for approvals

    # ── UPI Safety: Emergency Kill Switch ──
    kill_switch_active = Column(Boolean, default=False, nullable=False)
    kill_switch_activated_at = Column(DateTime, nullable=True)

    accounts = relationship("Account", back_populates="owner", lazy="selectin", foreign_keys="Account.owner_id")
    beneficiaries = relationship("Beneficiary", back_populates="user", lazy="selectin")
    trusted_person = relationship("User", remote_side="User.id", foreign_keys=[trusted_person_id])


# ────────────────────────────── Beneficiary ──────────────────────────────


class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False, index=True)
    status = Column(String(20), default="ACTIVE", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="beneficiaries")
    recipient_account = relationship("Account", foreign_keys=[recipient_account_id])

    __table_args__ = (
        Index("ix_beneficiaries_user_recipient", "user_id", "recipient_account_id", unique=True),
    )


# ────────────────────────────── Account ──────────────────────────────


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    account_type = Column(String(20), default="savings")
    balance = Column(Numeric(precision=18, scale=2), default=Decimal("0.00"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # ── UPI Safety: Annual Receiving Limit ──
    annual_received = Column(Numeric(precision=18, scale=2), default=Decimal("0.00"), nullable=False)  # Running tally for current FY
    annual_received_fy = Column(String(7), nullable=True)         # e.g. "2025-26"
    is_frozen = Column(Boolean, default=False, nullable=False)    # Frozen when ₹25L limit breached

    owner = relationship("User", back_populates="accounts", foreign_keys=[owner_id])


# ────────────────────────────── Transfer ──────────────────────────────


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    receiver_account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    amount = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))
    status = Column(
        SAEnum("COMPLETED", "FLAGGED", "FAILED", "PENDING_AUTH", "PENDING_APPROVAL", "PAUSED", "PENDING_GUARDIAN", name="transfer_status"),
        default="COMPLETED",
        nullable=False,
    )
    risk_score = Column(Float, nullable=True, default=None)
    ml_risk_score = Column(Float, nullable=True, default=None)  # Raw ML model P(fraud)
    fraud_rules_triggered = Column(Text, nullable=True)  # JSON list of triggered rule names
    source_ip = Column(String(45), nullable=True)         # Client IP for geo-velocity
    source_city = Column(String(100), nullable=True)      # Resolved city from IP
    reference = Column(String(255), nullable=True)         # User-provided memo/reference
    
    # Compliance & Maker-Checker Attributes
    auth_challenge_id = Column(String(36), nullable=True) # Step-Up UUID
    checker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    sender_account = relationship("Account", foreign_keys=[sender_account_id])
    receiver_account = relationship("Account", foreign_keys=[receiver_account_id])
    checker = relationship("User", foreign_keys=[checker_id])

    __table_args__ = (
        Index("ix_transfers_sender", "sender_account_id"),
        Index("ix_transfers_receiver", "receiver_account_id"),
        Index("ix_transfers_created", "created_at"),
    )


# ────────────────────────────── Audit Log ──────────────────────────────


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transfer_id = Column(String(36), nullable=False)
    action = Column(String(50), nullable=False)
    details = Column(Text, nullable=True)
    previous_hash = Column(String(64), nullable=False)
    current_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    sender_account_id = Column(String(36), ForeignKey("accounts.id"), nullable=True, index=True)
    receiver_account_id = Column(String(36), ForeignKey("accounts.id"), nullable=True, index=True)


# ────────────────────────────── Ledger Entry ──────────────────────────────


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transfer_id = Column(String(36), ForeignKey("transfers.id"), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False, index=True)
    entry_type = Column(
        SAEnum("DEBIT", "CREDIT", name="ledger_entry_type"),
        nullable=False,
    )
    amount = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))
    balance_after = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))
    created_at = Column(DateTime, default=datetime.utcnow)

    transfer = relationship("Transfer", foreign_keys=[transfer_id])
    account = relationship("Account", foreign_keys=[account_id])

    __table_args__ = (
        Index("ix_ledger_account_created", "account_id", "created_at"),
    )


# ────────────────────────────── Idempotency Key ──────────────────────────────


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    key = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(
        SAEnum("PENDING", "DONE", name="idempotency_status"),
        default="PENDING",
        nullable=False,
    )
    response_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ────────────────────────────── Balance Snapshot ──────────────────────────────


class BalanceSnapshot(Base):
    __tablename__ = "balance_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False, unique=True, index=True)
    balance = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))
    snapshot_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("Account", foreign_keys=[account_id])


# ────────────────────────────── Notification ──────────────────────────────


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)  # TRANSFER_SENT, TRANSFER_RECEIVED, FRAUD_ALERT
    reference_id = Column(String(36), nullable=True)        # transfer_id or related entity
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
        Index("ix_notifications_created", "created_at"),
    )


# ────────────────────────────── Account Daily Stats ──────────────────────────────


class AccountDailyStat(Base):
    __tablename__ = "account_daily_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    stat_date = Column(Date, nullable=False)
    total_sent = Column(Numeric(precision=18, scale=2), default=Decimal("0.00"), nullable=False)
    total_received = Column(Numeric(precision=18, scale=2), default=Decimal("0.00"), nullable=False)
    transfer_count = Column(Integer, default=0, nullable=False)
    flagged_count = Column(Integer, default=0, nullable=False)

    account = relationship("Account", foreign_keys=[account_id])

    __table_args__ = (
        Index("ix_daily_stats_account_date", "account_id", "stat_date", unique=True),
    )


# ────────────────────────────── Fraud Rule Config ──────────────────────────────


class FraudRuleConfig(Base):
    """Runtime-configurable fraud rule weights and thresholds.

    Seeded at startup from Settings defaults. Admin can tune via API
    to close the detect → review → tune → re-detect feedback loop.
    """
    __tablename__ = "fraud_rule_configs"

    rule_name = Column(String(50), primary_key=True)
    weight = Column(Numeric(precision=18, scale=2), nullable=False, default=1.0)
    enabled = Column(Boolean, default=True, nullable=False)
    threshold_value = Column(Numeric(precision=18, scale=2), nullable=True)  # rule-specific threshold
    description = Column(String(200), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ────────────────────────────── Reconciliation Log ──────────────────────────────


class ReconciliationLog(Base):
    """Records from scheduled balance-vs-ledger integrity checks."""
    __tablename__ = "reconciliation_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_accounts = Column(Integer, nullable=False)
    accounts_checked = Column(Integer, nullable=False)
    discrepancies_found = Column(Integer, nullable=False, default=0)
    discrepancy_details = Column(Text, nullable=True)  # JSON list of {account_id, stored, computed, diff}
    status = Column(
        SAEnum("PASSED", "FAILED", "ERROR", name="reconciliation_status"),
        nullable=False,
    )
    duration_ms = Column(Integer, nullable=True)

    __table_args__ = (
        Index("ix_reconciliation_run", "run_at"),
    )


# ────────────────────────────── Developer Platform (BaaS) ──────────────────────────────


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    hashed_key = Column(String(255), nullable=False)
    prefix = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_url = Column(String(500), nullable=False)
    secret = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])


# ────────────────────────────── Credit & Lending ──────────────────────────────


class Loan(Base):
    __tablename__ = "loans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=True, index=True)
    principal_amount = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))
    outstanding_balance = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))
    interest_rate = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))
    duration_months = Column(Integer, nullable=False, default=12)
    status = Column(
        SAEnum("PENDING", "ACTIVE", "CLOSED", "REJECTED", name="loan_status"),
        default="PENDING",
        nullable=False,
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    account = relationship("Account", foreign_keys=[account_id])


class LoanRepayment(Base):
    __tablename__ = "loan_repayments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    loan_id = Column(String(36), ForeignKey("loans.id"), nullable=False, index=True)
    amount = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))
    created_at = Column(DateTime, default=datetime.utcnow)

    loan = relationship("Loan", foreign_keys=[loan_id])


# ────────────────────────────── Credit Profile (CIBIL-Like) ──────────────────────────────


class CreditProfile(Base):
    """Stores financial indicators and ML-computed credit score for each user.

    Inspired by CIBIL TransUnion scoring (300–900 range) and RBI
    responsible-lending norms.  Updated each time a user requests
    a credit assessment or applies for a loan.
    """
    __tablename__ = "credit_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    pan = Column(String(10), nullable=True)
    mobile_email = Column(String(120), nullable=True)
    area_pin = Column(String(6), nullable=True)

    # ── Financial Indicators ──
    monthly_income = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))
    existing_liabilities = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))      # Total existing EMI/debt per month
    total_assets = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))               # Savings, investments, property value
    employment_type = Column(String(30), nullable=False, default="salaried") # salaried, self_employed, freelancer, unemployed
    employment_years = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))           # Years of employment / business tenure
    age = Column(Integer, nullable=False, default=25)
    dependents = Column(Integer, nullable=False, default=0)
    residence_type = Column(String(20), nullable=False, default="rented")   # owned, rented, parental

    # ── Behavioural Scores (derived from transaction history) ──
    repayment_history_score = Column(Numeric(precision=18, scale=2), nullable=False, default=0.5)   # 0.0 (worst) to 1.0 (perfect)
    account_age_months = Column(Integer, nullable=False, default=0)         # Months since first account opening
    avg_monthly_balance = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))        # Average balance over last 6 months
    num_previous_loans = Column(Integer, nullable=False, default=0)
    num_defaults = Column(Integer, nullable=False, default=0)
    transaction_regularity = Column(Numeric(precision=18, scale=2), nullable=False, default=0.5)    # 0.0 to 1.0

    # ── Computed Scores ──
    credit_score = Column(Integer, nullable=False, default=650)            # CIBIL-like: 300–900
    foir = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))                      # Fixed Obligation to Income Ratio
    debt_to_income = Column(Numeric(precision=18, scale=2), nullable=False, default=Decimal("0.00"))            # Total debt / annual income

    # ── ML Prediction Results (cached from last assessment) ──
    ml_eligibility_score = Column(Numeric(precision=18, scale=2), nullable=True)                    # P(eligible) from ML model
    ml_risk_category = Column(String(20), nullable=True)                   # LOW, MEDIUM, HIGH, VERY_HIGH
    ml_explanation = Column(Text, nullable=True)                           # JSON XAI output
    last_assessed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_credit_profile_user", "user_id", unique=True),
    )


# ────────────────────────────── UPI Safety: Whitelisted Contact ──────────────────────────────


class WhitelistedContact(Base):
    """Contacts whitelisted by a user to bypass the ₹10K transaction pause.

    Users can add family members or frequent recipients so their
    transfers are not paused for verification.
    """
    __tablename__ = "whitelisted_contacts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    contact_account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False, index=True)
    nickname = Column(String(100), nullable=True)  # Optional friendly name
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    contact_account = relationship("Account", foreign_keys=[contact_account_id])

    __table_args__ = (
        Index("ix_whitelist_user_contact", "user_id", "contact_account_id", unique=True),
    )


# ────────────────────────────── Settings ──────────────────────────────


class SystemConfig(Base):
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value_type = Column(String(20), nullable=False) # 'int', 'float', 'bool', 'str'
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
