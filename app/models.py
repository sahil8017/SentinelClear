"""SQLAlchemy ORM models for SentinelClear."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
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
    risk_score = Column(Float, nullable=True, default=None)  # ML fraud probability [0.0–1.0]
    created_at = Column(DateTime, default=datetime.utcnow)

    sender_account = relationship("Account", foreign_keys=[sender_account_id])
    receiver_account = relationship("Account", foreign_keys=[receiver_account_id])

    __table_args__ = (
        Index("ix_transfers_sender", "sender_account_id"),
        Index("ix_transfers_receiver", "receiver_account_id"),
    )


# ────────────────────────────── Audit Log ──────────────────────────────


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transfer_id = Column(String(36), nullable=False)
    action = Column(String(50), nullable=False)       # e.g. TRANSFER_COMPLETED, TRANSFER_FLAGGED
    details = Column(Text, nullable=True)              # JSON-serialised payload
    previous_hash = Column(String(64), nullable=False) # SHA-256 hex of previous entry
    current_hash = Column(String(64), nullable=False)  # SHA-256 hex of this entry
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
