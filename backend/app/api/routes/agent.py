"""Agent routes — manual triage trigger."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import async_session
from app.models.email_account import EmailAccount
from app.models.thread import Thread
from app.models.user import User
from app.services.triage_service import run_triage

router = APIRouter(tags=["agent"])


@router.post("/agent/triage/{thread_id}")
async def triage_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
):
    """Manually trigger triage on a thread. Returns assigned label IDs."""
    async with async_session() as db:
        # Verify thread belongs to user
        account_ids_subq = select(EmailAccount.id).where(EmailAccount.user_id == user.id)
        result = await db.execute(
            select(Thread).where(
                Thread.id == thread_id,
                Thread.account_id.in_(account_ids_subq),
            )
        )
        thread = result.scalar_one_or_none()
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

        assigned = await run_triage(thread_id, thread.account_id, db)

    return {"thread_id": str(thread_id), "assigned_label_ids": assigned}
