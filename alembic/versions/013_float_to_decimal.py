"""float_to_decimal

Revision ID: 013
Revises: e34a218d71d2
Create Date: 2026-04-24 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "013"
down_revision = "012_add_credit_profiles"
branch_labels = None
depends_on = None

columns_to_alter = {
    "accounts": ["balance", "annual_received"],
    "transfers": ["amount"],
    "ledger_entries": ["amount", "balance_after"],
    "balance_snapshots": ["balance"],
    "account_daily_stats": ["total_sent", "total_received"],
    "fraud_rule_configs": ["weight", "threshold_value"],
    "loans": ["principal_amount", "outstanding_balance", "interest_rate"],
    "loan_repayments": ["amount"],
    "credit_profiles": ["monthly_income", "existing_liabilities", "total_assets", "employment_years", "repayment_history_score", "avg_monthly_balance", "transaction_regularity", "foir", "debt_to_income", "ml_eligibility_score"]
}

def upgrade() -> None:
    for table, columns in columns_to_alter.items():
        for col in columns:
            op.execute(f"ALTER TABLE {table} ALTER COLUMN {col} TYPE NUMERIC(18, 2) USING {col}::numeric(18,2)")

def downgrade() -> None:
    for table, columns in columns_to_alter.items():
        for col in columns:
            op.execute(f"ALTER TABLE {table} ALTER COLUMN {col} TYPE FLOAT USING {col}::double precision")

