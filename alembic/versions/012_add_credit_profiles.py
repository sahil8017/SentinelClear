"""012 — Add credit_profiles table for ML credit scoring

Revises: 011_add_transfer_reference
Create Date: 2026-04-17

Adds the credit_profiles table to store user financial indicators,
CIBIL-like credit scores, FOIR, and ML eligibility results.
"""

from alembic import op
import sqlalchemy as sa

revision = "012_add_credit_profiles"
down_revision = "e34a218d71d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "credit_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, unique=True),

        # Financial indicators
        sa.Column("monthly_income", sa.Float(), nullable=False, server_default="0"),
        sa.Column("existing_liabilities", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_assets", sa.Float(), nullable=False, server_default="0"),
        sa.Column("employment_type", sa.String(30), nullable=False, server_default="salaried"),
        sa.Column("employment_years", sa.Float(), nullable=False, server_default="0"),
        sa.Column("age", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("dependents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("residence_type", sa.String(20), nullable=False, server_default="rented"),

        # Behavioural scores
        sa.Column("repayment_history_score", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("account_age_months", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_monthly_balance", sa.Float(), nullable=False, server_default="0"),
        sa.Column("num_previous_loans", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("num_defaults", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transaction_regularity", sa.Float(), nullable=False, server_default="0.5"),

        # Computed scores
        sa.Column("credit_score", sa.Integer(), nullable=False, server_default="650"),
        sa.Column("foir", sa.Float(), nullable=False, server_default="0"),
        sa.Column("debt_to_income", sa.Float(), nullable=False, server_default="0"),

        # ML prediction cache
        sa.Column("ml_eligibility_score", sa.Float(), nullable=True),
        sa.Column("ml_risk_category", sa.String(20), nullable=True),
        sa.Column("ml_explanation", sa.Text(), nullable=True),
        sa.Column("last_assessed_at", sa.DateTime(), nullable=True),

        # Timestamps
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_credit_profile_user", "credit_profiles", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_credit_profile_user", table_name="credit_profiles")
    op.drop_table("credit_profiles")
