from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.email_account import EmailAccount
from app.models.user import User
from app.schemas.email import Participant

router = APIRouter(prefix="/contacts", tags=["contacts"])

AUTOCOMPLETE_SQL = text("""
WITH account_ids AS (
    SELECT id FROM email_accounts WHERE user_id = :user_id
),
contacts AS (
    -- from_email / from_name
    SELECT from_email AS email, from_name AS name, received_at
    FROM emails
    WHERE account_id IN (SELECT id FROM account_ids) AND from_email IS NOT NULL

    UNION ALL

    -- to_list entries
    SELECT
        elem->>'email' AS email,
        elem->>'name' AS name,
        received_at
    FROM emails, jsonb_array_elements(to_list) AS elem
    WHERE account_id IN (SELECT id FROM account_ids) AND to_list IS NOT NULL

    UNION ALL

    -- cc_list entries
    SELECT
        elem->>'email' AS email,
        elem->>'name' AS name,
        received_at
    FROM emails, jsonb_array_elements(cc_list) AS elem
    WHERE account_id IN (SELECT id FROM account_ids) AND cc_list IS NOT NULL
)
SELECT DISTINCT ON (LOWER(email)) email, name
FROM contacts
WHERE email IS NOT NULL
  AND email != ''
  AND (LOWER(email) LIKE :q OR LOWER(COALESCE(name, '')) LIKE :q)
ORDER BY LOWER(email), received_at DESC NULLS LAST
LIMIT :lim
""")


@router.get("/autocomplete", response_model=list[Participant])
async def autocomplete_contacts(
    q: str = Query("", max_length=200),
    limit: int = Query(10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not q.strip():
        return []

    pattern = f"%{q.strip().lower()}%"
    result = await db.execute(
        AUTOCOMPLETE_SQL,
        {"user_id": str(user.id), "q": pattern, "lim": limit},
    )
    return [Participant(email=row.email, name=row.name or None) for row in result]
