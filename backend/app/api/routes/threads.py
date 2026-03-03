import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.email import Email
from app.models.email_account import EmailAccount
from app.models.thread import Thread
from app.models.user import User
from app.schemas.email import ThreadDetailResponse, ThreadResponse

router = APIRouter(prefix="/threads", tags=["threads"])


@router.get("/", response_model=list[ThreadResponse])
async def list_threads(
    limit: int = Query(25, le=50),
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List threads for the current user, sorted by most recent."""
    account_ids = (
        select(EmailAccount.id).where(EmailAccount.user_id == user.id)
    )
    query = (
        select(Thread)
        .where(Thread.account_id.in_(account_ids))
        .order_by(Thread.last_message_at.desc())
        .limit(limit)
    )
    if cursor:
        # cursor is a thread ID — skip past it
        cursor_thread = await db.get(Thread, uuid.UUID(cursor))
        if cursor_thread and cursor_thread.last_message_at:
            query = query.where(Thread.last_message_at < cursor_thread.last_message_at)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{thread_id}", response_model=ThreadDetailResponse)
async def get_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a thread with all its emails."""
    account_ids = (
        select(EmailAccount.id).where(EmailAccount.user_id == user.id)
    )
    result = await db.execute(
        select(Thread)
        .options(selectinload(Thread.emails))
        .where(Thread.id == thread_id, Thread.account_id.in_(account_ids))
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread
