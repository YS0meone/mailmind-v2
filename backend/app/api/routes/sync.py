import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import async_session, get_db
from app.models.email_account import EmailAccount
from app.models.user import User
from app.services.sync_service import get_sync_status, sync_account

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sync", tags=["sync"])


async def _run_sync(account_id, grant_id: str, email_address: str):
    """Background task: opens its own DB session and syncs one account."""
    logger.info("Background sync starting for %s", email_address)
    async with async_session() as db:
        # Re-fetch the account inside the new session
        result = await db.execute(
            select(EmailAccount).where(EmailAccount.id == account_id)
        )
        account = result.scalar_one_or_none()
        if not account:
            logger.error("Account %s not found for background sync", account_id)
            return
        try:
            await sync_account(db, account)
        except Exception as e:
            logger.error("Background sync failed for %s: %s", email_address, e, exc_info=True)


@router.post("/trigger")
async def trigger_sync(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kick off sync in the background. Returns immediately."""
    result = await db.execute(
        select(EmailAccount).where(
            EmailAccount.user_id == user.id, EmailAccount.is_active == True
        )
    )
    accounts = result.scalars().all()

    if not accounts:
        raise HTTPException(status_code=400, detail="No active email accounts found")

    for account in accounts:
        logger.info("Starting background sync for %s", account.email_address)
        asyncio.create_task(
            _run_sync(account.id, account.nylas_grant_id, account.email_address)
        )

    return {"message": "Sync started", "accounts": len(accounts)}


@router.get("/status")
async def sync_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get sync status for all of the user's accounts."""
    result = await db.execute(
        select(EmailAccount).where(
            EmailAccount.user_id == user.id, EmailAccount.is_active == True
        )
    )
    accounts = result.scalars().all()

    statuses = []
    for account in accounts:
        status = get_sync_status(str(account.id))
        statuses.append({
            "account": account.email_address,
            **status,
        })

    return {"accounts": statuses}
