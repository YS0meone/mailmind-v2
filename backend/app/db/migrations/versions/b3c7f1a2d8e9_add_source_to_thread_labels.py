"""add source to thread_labels

Revision ID: b3c7f1a2d8e9
Revises: a1b2c3d4e5f6
Create Date: 2026-03-05 21:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b3c7f1a2d8e9'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('thread_labels',
        sa.Column('source', sa.String(10), server_default='human', nullable=False))
    op.create_index('ix_thread_labels_label_source', 'thread_labels', ['label_id', 'source'])


def downgrade() -> None:
    op.drop_index('ix_thread_labels_label_source', table_name='thread_labels')
    op.drop_column('thread_labels', 'source')
