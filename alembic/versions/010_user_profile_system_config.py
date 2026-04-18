"""010 — Profile Fields and System Config

Revision ID: 010
Revises: 009
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── User Profile Onboarding fields ──
    op.add_column("users", sa.Column("full_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("occupation", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("profile_complete", sa.Boolean(), server_default="false", nullable=False))

    # ── SystemConfig table ──
    op.create_table(
        "system_config",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("value_type", sa.String(20), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_system_config_key", "system_config", ["key"], unique=True)


def downgrade() -> None:
    op.drop_table("system_config")
    
    op.drop_column("users", "profile_complete")
    op.drop_column("users", "occupation")
    op.drop_column("users", "full_name")
