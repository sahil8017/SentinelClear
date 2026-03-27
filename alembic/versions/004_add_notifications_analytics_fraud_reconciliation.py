"""004 — Add notifications, analytics, fraud config, reconciliation tables.

Also adds fraud_rules_triggered column and created_at index to transfers.

Revision ID: 004
Revises: 003
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Transfer: add fraud_rules_triggered column + index ──
    op.add_column("transfers", sa.Column("fraud_rules_triggered", sa.Text(), nullable=True))
    op.create_index("ix_transfers_created", "transfers", ["created_at"])

    # ── Notifications ──
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(50), nullable=False),
        sa.Column("reference_id", sa.String(36), nullable=True),
        sa.Column("is_read", sa.Boolean(), default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_read", "notifications", ["user_id", "is_read"])
    op.create_index("ix_notifications_created", "notifications", ["created_at"])

    # ── Account Daily Stats ──
    op.create_table(
        "account_daily_stats",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("account_id", sa.String(36), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("stat_date", sa.Date(), nullable=False),
        sa.Column("total_sent", sa.Float(), default=0.0, nullable=False),
        sa.Column("total_received", sa.Float(), default=0.0, nullable=False),
        sa.Column("transfer_count", sa.Integer(), default=0, nullable=False),
        sa.Column("flagged_count", sa.Integer(), default=0, nullable=False),
    )
    op.create_index("ix_daily_stats_account_date", "account_daily_stats",
                     ["account_id", "stat_date"], unique=True)

    # ── Fraud Rule Configs ──
    op.create_table(
        "fraud_rule_configs",
        sa.Column("rule_name", sa.String(50), primary_key=True),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("enabled", sa.Boolean(), default=True, nullable=False),
        sa.Column("threshold_value", sa.Float(), nullable=True),
        sa.Column("description", sa.String(200), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Reconciliation Logs ──
    op.create_table(
        "reconciliation_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("run_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("total_accounts", sa.Integer(), nullable=False),
        sa.Column("accounts_checked", sa.Integer(), nullable=False),
        sa.Column("discrepancies_found", sa.Integer(), default=0, nullable=False),
        sa.Column("discrepancy_details", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("PASSED", "FAILED", "ERROR", name="reconciliation_status"), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
    )
    op.create_index("ix_reconciliation_run", "reconciliation_logs", ["run_at"])


def downgrade() -> None:
    op.drop_table("reconciliation_logs")
    op.drop_table("fraud_rule_configs")
    op.drop_index("ix_daily_stats_account_date")
    op.drop_table("account_daily_stats")
    op.drop_index("ix_notifications_created")
    op.drop_index("ix_notifications_user_read")
    op.drop_table("notifications")
    op.drop_index("ix_transfers_created", "transfers")
    op.drop_column("transfers", "fraud_rules_triggered")
