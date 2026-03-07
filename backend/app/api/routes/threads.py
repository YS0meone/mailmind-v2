import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.email import Email
from app.models.email_account import EmailAccount
from app.models.label import ThreadLabel
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
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List threads for the current user, sorted by most recent."""
    account_ids = (
        select(EmailAccount.id).where(EmailAccount.user_id == user.id)
    )
    query = (
        select(Thread)
        .options(selectinload(Thread.labels))
        .where(Thread.account_id.in_(account_ids))
        .order_by(Thread.last_message_at.desc())
        .limit(limit)
    )

    # Full-text + fuzzy search: find threads containing matching emails
    if q and q.strip():
        q_stripped = q.strip()
        search_tsquery = func.websearch_to_tsquery(text("'english'"), q_stripped)
        ilike_pattern = f"%{q_stripped}%"
        matching_thread_ids = (
            select(Email.thread_id)
            .where(
                Email.account_id.in_(account_ids),
                Email.thread_id.is_not(None),
                or_(
                    Email.search_vector.op("@@")(search_tsquery),
                    Email.search_text.ilike(ilike_pattern),
                ),
            )
            .distinct()
        )
        query = query.where(Thread.id.in_(matching_thread_ids))

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
    elif folder and folder.startswith("label:"):
        label_id = folder[6:]
        labeled_thread_ids = (
            select(ThreadLabel.thread_id).where(ThreadLabel.label_id == uuid.UUID(label_id))
        )
        query = query.where(Thread.id.in_(labeled_thread_ids))

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
        .options(selectinload(Thread.emails), selectinload(Thread.labels))
        .where(Thread.id == thread_id, Thread.account_id.in_(account_ids))
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


async def trash_thread(thread_id: uuid.UUID, db: AsyncSession) -> None:
    """Move a thread to Trash via Nylas and update local DB.

    Raises HTTPException if thread or account is not found.
    """
    result = await db.execute(
        select(Thread)
        .options(selectinload(Thread.emails))
        .where(Thread.id == thread_id)
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    account = await db.get(EmailAccount, thread.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    grant_id = account.nylas_grant_id

    # Find the Trash folder ID from Nylas
    folders = await nylas_service.list_folders(grant_id)
    trash_folder = next(
        (f for f in folders if "\\Trash" in (f.get("attributes") or [])),
        None,
    )
    if not trash_folder:
        # Fallback: look by name
        trash_folder = next(
            (f for f in folders if (f.get("name") or "").upper() == "TRASH"),
            None,
        )
    if not trash_folder:
        raise HTTPException(status_code=500, detail="Trash folder not found")

    trash_id = trash_folder["id"]

    # Move each message to Trash via Nylas
    for email in thread.emails:
        try:
            await nylas_service.update_message(
                grant_id, email.nylas_message_id, {"folders": [trash_id]}
            )
        except Exception as e:
            logger.warning("Failed to trash message %s on Nylas: %s", email.id, e)

    # Update local DB
    thread.folder_ids = ["TRASH"]
    await db.commit()


@router.delete("/{thread_id}")
async def delete_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move a thread to Trash. Updates each message's folder via Nylas."""
    # Verify ownership
    account_ids = select(EmailAccount.id).where(EmailAccount.user_id == user.id)
    result = await db.execute(
        select(Thread).where(Thread.id == thread_id, Thread.account_id.in_(account_ids))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Thread not found")

    await trash_thread(thread_id, db)
    return {"status": "ok"}


@router.patch("/{thread_id}/read")
async def toggle_thread_read(
    thread_id: uuid.UUID,
    body: dict | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a thread and all its emails as read or unread. Syncs to Nylas."""
    is_unread = body.get("is_unread", False) if body else False

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

    for email in thread.emails:
        if email.is_unread != is_unread:
            email.is_unread = is_unread
            if grant_id:
                try:
                    await nylas_service.update_message(
                        grant_id, email.nylas_message_id,
                        {"unread": is_unread},
                    )
                except Exception as e:
                    logger.warning(
                        "Failed to sync read status to Nylas for %s: %s",
                        email.id, e,
                    )

    thread.is_unread = is_unread
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
