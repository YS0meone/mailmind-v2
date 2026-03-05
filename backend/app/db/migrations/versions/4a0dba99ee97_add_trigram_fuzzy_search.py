"""add trigram fuzzy search

Revision ID: 4a0dba99ee97
Revises: 5078c4a664f8
Create Date: 2026-03-05 09:27:48.646550
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '4a0dba99ee97'
down_revision: Union[str, None] = '5078c4a664f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable pg_trgm extension
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    # 2. Add search_text column (plain text for trigram matching)
    op.execute("ALTER TABLE emails ADD COLUMN search_text text;")

    # 3. Update trigger to also populate search_text
    op.execute("""
        CREATE OR REPLACE FUNCTION emails_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.from_name, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(NEW.from_email, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(NEW.snippet, '')), 'C');
            NEW.search_text :=
                coalesce(NEW.subject, '') || ' ' ||
                coalesce(NEW.from_name, '') || ' ' ||
                coalesce(NEW.from_email, '') || ' ' ||
                coalesce(NEW.snippet, '');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 4. Update trigger to also fire on search_text source columns
    op.execute("DROP TRIGGER IF EXISTS emails_search_vector_trigger ON emails;")
    op.execute("""
        CREATE TRIGGER emails_search_vector_trigger
        BEFORE INSERT OR UPDATE OF subject, snippet, from_name, from_email
        ON emails
        FOR EACH ROW
        EXECUTE FUNCTION emails_search_vector_update();
    """)

    # 5. Backfill search_text for existing rows
    op.execute("""
        UPDATE emails SET search_text =
            coalesce(subject, '') || ' ' ||
            coalesce(from_name, '') || ' ' ||
            coalesce(from_email, '') || ' ' ||
            coalesce(snippet, '');
    """)

    # 6. Create GIN trigram index on search_text
    op.execute("""
        CREATE INDEX ix_emails_search_text_trgm
        ON emails USING GIN (search_text gin_trgm_ops);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_emails_search_text_trgm;")
    op.execute("ALTER TABLE emails DROP COLUMN IF EXISTS search_text;")
    # Restore original trigger without search_text
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
