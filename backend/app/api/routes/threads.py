import logging
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
from app.services import nylas_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/threads", tags=["threads"])


FOLDER_LABEL_MAP = {
    "inbox": "INBOX",
    "sent": "SENT",
    "drafts": "DRAFT",
    "trash": "TRASH",
}


@router.get("/", response_model=list[ThreadResponse])
async def list_threads(
    limit: int = Query(25, le=50),
    cursor: str | None = None,
    folder: str | None = None,
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

    if folder == "starred":
        query = query.where(Thread.is_starred == True)  # noqa: E712
    elif folder == "sent":
        # Gmail doesn't put SENT in folder_ids via Nylas; match by from_email
        account_emails = select(EmailAccount.email_address).where(
            EmailAccount.user_id == user.id
        )
        sent_thread_ids = (
            select(Email.thread_id)
            .where(Email.from_email.in_(account_emails))
            .distinct()
        )
        query = query.where(Thread.id.in_(sent_thread_ids))
    elif folder and folder in FOLDER_LABEL_MAP:
        label = FOLDER_LABEL_MAP[folder]
        query = query.where(Thread.folder_ids.contains([label]))

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


@router.patch("/{thread_id}/read")
async def mark_thread_read(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a thread and all its emails as read. Syncs to Nylas."""
    account_ids = select(EmailAccount.id).where(EmailAccount.user_id == user.id)
    result = await db.execute(
        select(Thread)
        .options(selectinload(Thread.emails))
        .where(Thread.id == thread_id, Thread.account_id.in_(account_ids))
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Get grant_id for Nylas sync
    account = await db.get(EmailAccount, thread.account_id)
    grant_id = account.nylas_grant_id if account else None

    # Mark all unread emails as read
    for email in thread.emails:
        if email.is_unread:
            email.is_unread = False
            if grant_id:
                try:
                    await nylas_service.update_message(
                        grant_id, email.nylas_message_id, {"unread": False}
                    )
                except Exception as e:
                    logger.warning("Failed to sync read status to Nylas for %s: %s", email.id, e)

    thread.is_unread = False
    await db.commit()
    return {"status": "ok"}


@router.patch("/{thread_id}/star")
async def toggle_thread_star(
    thread_id: uuid.UUID,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Star or unstar a thread and all its emails. Syncs to Nylas."""
    is_starred = body.get("is_starred")
    if is_starred is None:
        raise HTTPException(status_code=422, detail="is_starred is required")

    account_ids = select(EmailAccount.id).where(EmailAccount.user_id == user.id)
    result = await db.execute(
        select(Thread)
        .options(selectinload(Thread.emails))
        .where(Thread.id == thread_id, Thread.account_id.in_(account_ids))
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Get grant_id for Nylas sync
    account = await db.get(EmailAccount, thread.account_id)
    grant_id = account.nylas_grant_id if account else None

    # Update all emails
    for email in thread.emails:
        email.is_starred = is_starred
        if grant_id:
            try:
                await nylas_service.update_message(
                    grant_id, email.nylas_message_id, {"starred": is_starred}
                )
            except Exception as e:
                logger.warning("Failed to sync star status to Nylas for %s: %s", email.id, e)

    thread.is_starred = is_starred
    await db.commit()
    return {"status": "ok"}
