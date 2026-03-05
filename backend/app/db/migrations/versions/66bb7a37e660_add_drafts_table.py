"""add drafts table

Revision ID: 66bb7a37e660
Revises: 4a0dba99ee97
Create Date: 2026-03-05 11:18:41.674619
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '66bb7a37e660'
down_revision: Union[str, None] = '4a0dba99ee97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('drafts',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('account_id', sa.UUID(), nullable=False),
    sa.Column('subject', sa.Text(), nullable=True),
    sa.Column('body', sa.Text(), nullable=True),
    sa.Column('to_list', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('cc_list', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('bcc_list', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('mode', sa.String(length=20), nullable=False),
    sa.Column('reply_to_message_id', sa.UUID(), nullable=True),
    sa.Column('thread_id', sa.UUID(), nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['email_accounts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['reply_to_message_id'], ['emails.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['thread_id'], ['threads.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        'ix_drafts_account_updated',
        'drafts',
        ['account_id', sa.literal_column('updated_at DESC')],
    )


def downgrade() -> None:
    op.drop_index('ix_drafts_account_updated', table_name='drafts')
    op.drop_table('drafts')
