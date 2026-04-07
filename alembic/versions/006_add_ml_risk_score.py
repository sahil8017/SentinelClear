"""006 — Add ml_risk_score to transfers table

Revision ID: 006
Revises: 005
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transfers",
        sa.Column("ml_risk_score", sa.Float(), nullable=True, default=None),
    )


def downgrade() -> None:
    op.drop_column("transfers", "ml_risk_score")
