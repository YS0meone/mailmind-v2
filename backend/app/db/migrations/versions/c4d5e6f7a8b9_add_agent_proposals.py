"""add agent_proposals

Revision ID: c4d5e6f7a8b9
Revises: b3c7f1a2d8e9
Create Date: 2026-03-06 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3c7f1a2d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('agent_proposals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), nullable=False),
        sa.Column('thread_id', sa.UUID(), nullable=True),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20),
                  server_default='pending', nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()),
                  server_default='{}', nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True),
                  nullable=False),
        sa.ForeignKeyConstraint(
            ['account_id'], ['email_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(
            ['thread_id'], ['threads.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_agent_proposals_account_status_created',
        'agent_proposals',
        ['account_id', 'status', sa.text('created_at DESC')],
    )


def downgrade() -> None:
    op.drop_index(
        'ix_agent_proposals_account_status_created',
        table_name='agent_proposals',
    )
    op.drop_table('agent_proposals')
