"""add email search vector

Revision ID: 5078c4a664f8
Revises: 1827cc2c6d88
Create Date: 2026-03-05 09:14:36.203770
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5078c4a664f8'
down_revision: Union[str, None] = '1827cc2c6d88'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add tsvector column
    op.execute("ALTER TABLE emails ADD COLUMN search_vector tsvector;")

    # 2. Create trigger function (weighted: subject A, sender B, snippet C)
    op.execute("""
        CREATE OR REPLACE FUNCTION emails_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.from_name, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(NEW.from_email, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(NEW.snippet, '')), 'C');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 3. Create trigger
    op.execute("""
        CREATE TRIGGER emails_search_vector_trigger
        BEFORE INSERT OR UPDATE OF subject, snippet, from_name, from_email
        ON emails
        FOR EACH ROW
        EXECUTE FUNCTION emails_search_vector_update();
    """)

    # 4. Backfill existing rows
    op.execute("""
        UPDATE emails SET search_vector =
            setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(from_name, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(from_email, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(snippet, '')), 'C');
    """)

    # 5. Create GIN index
    op.execute("""
        CREATE INDEX ix_emails_search_vector
        ON emails USING GIN (search_vector);
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS emails_search_vector_trigger ON emails;")
    op.execute("DROP FUNCTION IF EXISTS emails_search_vector_update;")
    op.execute("DROP INDEX IF EXISTS ix_emails_search_vector;")
    op.execute("ALTER TABLE emails DROP COLUMN IF EXISTS search_vector;")
