"""SQLAlchemy ORM models for SentinelClear."""

import uuid
from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
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
    created_at = Column(DateTime, default=datetime.utcnow)

    accounts = relationship("Account", back_populates="owner", lazy="selectin")


# ────────────────────────────── Account ──────────────────────────────


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    account_type = Column(String(20), default="savings")
    balance = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="accounts")


# ────────────────────────────── Transfer ──────────────────────────────


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    receiver_account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(
        SAEnum("COMPLETED", "FLAGGED", "FAILED", name="transfer_status"),
        default="COMPLETED",
        nullable=False,
    )
    risk_score = Column(Float, nullable=True, default=None)
    fraud_rules_triggered = Column(Text, nullable=True)  # JSON list of triggered rule names
    created_at = Column(DateTime, default=datetime.utcnow)

    sender_account = relationship("Account", foreign_keys=[sender_account_id])
    receiver_account = relationship("Account", foreign_keys=[receiver_account_id])

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
    amount = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
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
    balance = Column(Float, nullable=False)
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
    total_sent = Column(Float, default=0.0, nullable=False)
    total_received = Column(Float, default=0.0, nullable=False)
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
    weight = Column(Float, nullable=False, default=1.0)
    enabled = Column(Boolean, default=True, nullable=False)
    threshold_value = Column(Float, nullable=True)  # rule-specific threshold
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
