"""add audit log account ids

Revision ID: 014
Revises: 013
Create Date: 2026-05-20 07:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '014'
down_revision: Union[str, None] = '013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to audit_logs
    op.add_column('audit_logs', sa.Column('sender_account_id', sa.String(length=36), sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True))
    op.add_column('audit_logs', sa.Column('receiver_account_id', sa.String(length=36), sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True))
    
    # Create indexes
    op.create_index(op.f('ix_audit_logs_sender_account_id'), 'audit_logs', ['sender_account_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_receiver_account_id'), 'audit_logs', ['receiver_account_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_logs_receiver_account_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_sender_account_id'), table_name='audit_logs')
    op.drop_column('audit_logs', 'receiver_account_id')
    op.drop_column('audit_logs', 'sender_account_id')
