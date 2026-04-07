"""Add loan and loan_repayment tables + loan model extensions.

Revision ID: 007
Revises: 006_add_ml_risk_score
Create Date: 2025-01-15
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create loan_status enum safely
    from sqlalchemy.dialects import postgresql
    op.execute("DO $$ BEGIN CREATE TYPE loan_status AS ENUM ('PENDING', 'ACTIVE', 'CLOSED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    loan_status = postgresql.ENUM("PENDING", "ACTIVE", "CLOSED", "REJECTED", name="loan_status", create_type=False)

    op.create_table(
        "loans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("account_id", sa.String(36), sa.ForeignKey("accounts.id"), nullable=True, index=True),
        sa.Column("principal_amount", sa.Float, nullable=False),
        sa.Column("outstanding_balance", sa.Float, nullable=False),
        sa.Column("interest_rate", sa.Float, nullable=False),
        sa.Column("duration_months", sa.Integer, nullable=False, server_default="12"),
        sa.Column("status", loan_status, nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "loan_repayments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("loan_id", sa.String(36), sa.ForeignKey("loans.id"), nullable=False, index=True),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("loan_repayments")
    op.drop_table("loans")
    sa.Enum(name="loan_status").drop(op.get_bind(), checkfirst=True)
