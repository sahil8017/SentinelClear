"""Add risk_score column to transfers table.

Revision ID: 002
Revises: 001
Create Date: 2026-03-09
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transfers",
        sa.Column("risk_score", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("transfers", "risk_score")
