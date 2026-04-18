"""Add reference column to transfers table

Revision ID: 011
Revises: 010
"""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transfers", sa.Column("reference", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("transfers", "reference")
