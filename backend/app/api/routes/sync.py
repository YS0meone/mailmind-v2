from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.email_account import EmailAccount
from app.models.user import User
from app.services.sync_service import sync_account

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/trigger")
async def trigger_sync(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a full sync for all of the user's active accounts."""
    result = await db.execute(
        select(EmailAccount).where(
            EmailAccount.user_id == user.id, EmailAccount.is_active == True
        )
    )
    accounts = result.scalars().all()

    results = []
    for account in accounts:
        count = await sync_account(db, account)
        results.append({"account": account.email_address, "messages_synced": count})

    return {"synced": results}
