"""Sync service — upserts Nylas messages/threads into PostgreSQL."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email import Email
from app.models.email_account import EmailAccount
from app.models.thread import Thread
from app.services.nylas_service import nylas_service

logger = logging.getLogger(__name__)


def _parse_nylas_thread(nylas_thread: dict, account_id) -> dict:
    """Convert a Nylas thread object to our DB fields."""
    return {
        "account_id": account_id,
        "nylas_thread_id": nylas_thread["id"],
        "subject": nylas_thread.get("subject"),
        "snippet": nylas_thread.get("snippet"),
        "is_unread": nylas_thread.get("unread", False),
        "is_starred": nylas_thread.get("starred", False),
        "has_attachments": nylas_thread.get("has_attachments", False),
        "participants": nylas_thread.get("participants"),
        "folder_ids": nylas_thread.get("folders"),
        "last_message_at": _unix_to_dt(nylas_thread.get("latest_message_received_date")),
        "message_count": len(nylas_thread.get("message_ids", [])),
    }


def _parse_nylas_message(nylas_msg: dict, account_id, thread_id=None) -> dict:
    """Convert a Nylas message object to our DB fields."""
    from_list = nylas_msg.get("from", [])
    return {
        "account_id": account_id,
        "thread_id": thread_id,
        "nylas_message_id": nylas_msg["id"],
        "nylas_thread_id": nylas_msg.get("thread_id"),
        "subject": nylas_msg.get("subject"),
        "snippet": nylas_msg.get("snippet"),
        "body_html": nylas_msg.get("body"),
        "from_name": from_list[0]["name"] if from_list else None,
        "from_email": from_list[0]["email"] if from_list else None,
        "to_list": nylas_msg.get("to"),
        "cc_list": nylas_msg.get("cc"),
        "bcc_list": nylas_msg.get("bcc"),
        "reply_to": nylas_msg.get("reply_to"),
        "is_unread": nylas_msg.get("unread", True),
        "is_starred": nylas_msg.get("starred", False),
        "folder_ids": nylas_msg.get("folders"),
        "has_attachments": bool(nylas_msg.get("attachments")),
        "received_at": _unix_to_dt(nylas_msg.get("date")),
    }


def _unix_to_dt(ts: int | None) -> datetime | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


async def upsert_thread(db: AsyncSession, nylas_thread: dict, account_id) -> Thread:
    """Insert or update a thread from Nylas data."""
    result = await db.execute(
        select(Thread).where(
            Thread.account_id == account_id,
            Thread.nylas_thread_id == nylas_thread["id"],
        )
    )
    thread = result.scalar_one_or_none()
    fields = _parse_nylas_thread(nylas_thread, account_id)

    if thread:
        for k, v in fields.items():
            if k != "account_id":
                setattr(thread, k, v)
    else:
        thread = Thread(**fields)
        db.add(thread)

    await db.flush()
    return thread


async def upsert_message(db: AsyncSession, nylas_msg: dict, account_id, thread_id=None) -> Email:
    """Insert or update an email from Nylas data."""
    result = await db.execute(
        select(Email).where(
            Email.account_id == account_id,
            Email.nylas_message_id == nylas_msg["id"],
        )
    )
    email = result.scalar_one_or_none()
    fields = _parse_nylas_message(nylas_msg, account_id, thread_id)

    if email:
        for k, v in fields.items():
            if k not in ("account_id", "nylas_message_id"):
                setattr(email, k, v)
    else:
        email = Email(**fields)
        db.add(email)

    await db.flush()
    return email


async def sync_account(db: AsyncSession, account: EmailAccount) -> int:
    """Full sync: fetch threads + messages from Nylas and upsert to DB.

    Returns the number of messages synced.
    """
    grant_id = account.nylas_grant_id
    total_messages = 0
    page_token = None

    # Paginate through threads
    while True:
        result = await nylas_service.list_threads(
            grant_id, limit=25, page_token=page_token
        )
        threads_data = result["data"]

        for nylas_thread in threads_data:
            thread = await upsert_thread(db, nylas_thread, account.id)

            # Fetch messages for this thread
            for msg_id in nylas_thread.get("message_ids", []):
                try:
                    nylas_msg = await nylas_service.get_message(grant_id, msg_id)
                    await upsert_message(db, nylas_msg, account.id, thread.id)
                    total_messages += 1
                except Exception:
                    logger.warning("Failed to fetch message %s", msg_id, exc_info=True)

        page_token = result.get("next_cursor")
        if not page_token or not threads_data:
            break

    # Update last_sync_at
    account.last_sync_at = datetime.now(timezone.utc)
    await db.commit()

    logger.info("Synced %d messages for account %s", total_messages, account.email_address)
    return total_messages
