"""009 — UPI Safety Rules: Transaction Pause, Vulnerable Group Protection,
Emergency Kill Switch, Annual Receiving Limit

Revision ID: 009
Revises: 008
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend transfer_status enum with PAUSED and PENDING_GUARDIAN ──
    # PostgreSQL enums need explicit ALTER TYPE to add values
    op.execute("ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'PAUSED'")
    op.execute("ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'PENDING_GUARDIAN'")

    # ── User: Vulnerable Group Protection fields ──
    op.add_column("users", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("is_disabled", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("trusted_person_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))

    # ── User: Emergency Kill Switch fields ──
    op.add_column("users", sa.Column("kill_switch_active", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("kill_switch_activated_at", sa.DateTime(), nullable=True))

    # ── Account: Annual Receiving Limit fields ──
    op.add_column("accounts", sa.Column("annual_received", sa.Float(), server_default="0.0", nullable=False))
    op.add_column("accounts", sa.Column("annual_received_fy", sa.String(7), nullable=True))
    op.add_column("accounts", sa.Column("is_frozen", sa.Boolean(), server_default="false", nullable=False))

    # ── Whitelisted Contacts table ──
    op.create_table(
        "whitelisted_contacts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("contact_account_id", sa.String(36), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("nickname", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_whitelist_user_id", "whitelisted_contacts", ["user_id"])
    op.create_index("ix_whitelist_contact_id", "whitelisted_contacts", ["contact_account_id"])
    op.create_index(
        "ix_whitelist_user_contact",
        "whitelisted_contacts",
        ["user_id", "contact_account_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("whitelisted_contacts")

    op.drop_column("accounts", "is_frozen")
    op.drop_column("accounts", "annual_received_fy")
    op.drop_column("accounts", "annual_received")

    op.drop_column("users", "kill_switch_activated_at")
    op.drop_column("users", "kill_switch_active")
    op.drop_column("users", "trusted_person_id")
    op.drop_column("users", "is_disabled")
    op.drop_column("users", "date_of_birth")

    # Note: PostgreSQL does not support removing enum values in downgrade.
    # PAUSED and PENDING_GUARDIAN will remain in the enum type.
