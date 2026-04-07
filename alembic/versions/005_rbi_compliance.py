"""005 — RBI/NPCI Compliance Updates (Beneficiary and KYC)

Revision ID: 005
Revises: 004
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Users: add kyc_status ──
    op.add_column("users", sa.Column("kyc_status", sa.String(20), server_default="UNVERIFIED", nullable=False))

    # ── Beneficiaries ──
    op.create_table(
        "beneficiaries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("recipient_account_id", sa.String(36), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="ACTIVE", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_beneficiaries_user_id", "beneficiaries", ["user_id"])
    op.create_index("ix_beneficiaries_recipient", "beneficiaries", ["recipient_account_id"])
    op.create_index(
        "ix_beneficiaries_user_recipient", 
        "beneficiaries", 
        ["user_id", "recipient_account_id"], 
        unique=True
    )

def downgrade() -> None:
    op.drop_table("beneficiaries")
    op.drop_column("users", "kyc_status")
