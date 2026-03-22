"""003 — add ledger_entries, idempotency_keys, balance_snapshots tables.

Revision ID: 003_add_ledger_idempotency_snapshots
Revises: 002_add_risk_score
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Ledger Entries ──
    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("transfer_id", sa.String(36), sa.ForeignKey("transfers.id"), nullable=False),
        sa.Column("account_id", sa.String(36), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column(
            "entry_type",
            sa.Enum("DEBIT", "CREDIT", name="ledger_entry_type"),
            nullable=False,
        ),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("balance_after", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_ledger_entries_transfer_id", "ledger_entries", ["transfer_id"])
    op.create_index("ix_ledger_entries_account_id", "ledger_entries", ["account_id"])
    op.create_index("ix_ledger_account_created", "ledger_entries", ["account_id", "created_at"])

    # ── Idempotency Keys ──
    op.create_table(
        "idempotency_keys",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "DONE", name="idempotency_status"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("response_code", sa.Integer(), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_idempotency_keys_user_id", "idempotency_keys", ["user_id"])

    # ── Balance Snapshots ──
    op.create_table(
        "balance_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.String(36), sa.ForeignKey("accounts.id"), nullable=False, unique=True),
        sa.Column("balance", sa.Float(), nullable=False),
        sa.Column("snapshot_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_balance_snapshots_account_id", "balance_snapshots", ["account_id"])


def downgrade() -> None:
    op.drop_table("balance_snapshots")
    op.drop_table("idempotency_keys")
    op.drop_table("ledger_entries")
    op.execute("DROP TYPE IF EXISTS ledger_entry_type")
    op.execute("DROP TYPE IF EXISTS idempotency_status")
