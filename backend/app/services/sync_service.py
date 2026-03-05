"""Sync service — upserts Nylas messages/threads into PostgreSQL."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.email import Email
from app.models.email_account import EmailAccount
from app.models.thread import Thread
from app.services import nylas_service

logger = logging.getLogger(__name__)

# In-memory sync status per account (good enough for single-process MVP)
_sync_status: dict[str, dict] = {}


def get_sync_status(account_id: str) -> dict:
    return _sync_status.get(account_id, {"status": "idle"})


def _parse_nylas_thread(nylas_thread: dict, account_id) -> dict:
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
    from_list = nylas_msg.get("from", [])
    return {
        "account_id": account_id,
        "thread_id": thread_id,
        "nylas_message_id": nylas_msg["id"],
        "nylas_thread_id": nylas_msg.get("thread_id"),
        "subject": nylas_msg.get("subject"),
        "snippet": nylas_msg.get("snippet"),
        "body_html": nylas_msg.get("body"),
        "from_name": from_list[0].get("name") if from_list else None,
        "from_email": from_list[0].get("email") if from_list else None,
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


def _build_participants(nylas_msg: dict) -> list[dict]:
    """Build a de-duplicated participant list from a message's from/to/cc."""
    seen: set[str] = set()
    result: list[dict] = []
    for field in ("from", "to", "cc"):
        for p in nylas_msg.get(field) or []:
            email = (p.get("email") or "").lower()
            if email and email not in seen:
                seen.add(email)
                result.append({"name": p.get("name") or "", "email": email})
    return result


def _unix_to_dt(ts: int | None) -> datetime | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


async def upsert_thread(db: AsyncSession, nylas_thread: dict, account_id) -> Thread:
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


async def sync_account(db: AsyncSession, account: EmailAccount, days: int = 2) -> int:
    """Sync messages from Nylas for the last N days.

    Fetches messages in bulk (not per-thread), then groups by thread.
    """
    account_key = str(account.id)
    grant_id = account.nylas_grant_id

    logger.info("sync_account called for %s (grant=%s, days=%d)", account.email_address, grant_id, days)
    _sync_status[account_key] = {"status": "syncing", "messages": 0, "started_at": datetime.now(timezone.utc).isoformat()}

    # Calculate cutoff timestamp
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    received_after = int(cutoff.timestamp())

    total_messages = 0
    page_token = None

    try:
        # Fetch messages in bulk with date filter
        while True:
            result = await nylas_service.list_messages(
                grant_id, limit=50, page_token=page_token, received_after=received_after
            )
            messages = result["data"]
            logger.info("Fetched %d messages (page)", len(messages))

            for nylas_msg in messages:
                # Upsert thread if we have a thread_id
                thread_id_db = None
                nylas_thread_id = nylas_msg.get("thread_id")

                if nylas_thread_id:
                    # Create a minimal thread record from the message
                    thread_result = await db.execute(
                        select(Thread).where(
                            Thread.account_id == account.id,
                            Thread.nylas_thread_id == nylas_thread_id,
                        )
                    )
                    thread = thread_result.scalar_one_or_none()
                    if not thread:
                        thread = Thread(
                            account_id=account.id,
                            nylas_thread_id=nylas_thread_id,
                            subject=nylas_msg.get("subject"),
                            snippet=nylas_msg.get("snippet"),
                            is_unread=nylas_msg.get("unread", False),
                            is_starred=nylas_msg.get("starred", False),
                            has_attachments=bool(nylas_msg.get("attachments")),
                            participants=_build_participants(nylas_msg),
                            folder_ids=nylas_msg.get("folders"),
                            last_message_at=_unix_to_dt(nylas_msg.get("date")),
                            message_count=1,
                        )
                        db.add(thread)
                        await db.flush()
                    else:
                        # Update thread timestamp if this message is newer
                        msg_date = _unix_to_dt(nylas_msg.get("date"))
                        if msg_date and (not thread.last_message_at or msg_date > thread.last_message_at):
                            thread.last_message_at = msg_date
                            thread.snippet = nylas_msg.get("snippet")
                        # Rebuild participants: update names + add new ones
                        msg_participants = _build_participants(nylas_msg)
                        new_by_email = {p["email"]: p["name"] for p in msg_participants}
                        merged: list[dict] = []
                        seen: set[str] = set()
                        for p in (thread.participants or []):
                            email = p.get("email", "").lower()
                            if not email:
                                continue  # drop invalid entries with empty email
                            name = p.get("name", "")
                            if not name and email in new_by_email:
                                name = new_by_email[email]
                            merged.append({"name": name, "email": email})
                            seen.add(email)
                        for p in msg_participants:
                            if p["email"] not in seen:
                                merged.append(p)
                                seen.add(p["email"])
                        thread.participants = merged
                        flag_modified(thread, "participants")
                        # Sync unread from Nylas — if Nylas says unread, mark thread unread;
                        # otherwise keep current state (may have been read locally)
                        if nylas_msg.get("unread", False):
                            thread.is_unread = True
                        await db.flush()
                    thread_id_db = thread.id

                # Check if message already exists (for dedup)
                existing_msg = await db.execute(
                    select(Email.id).where(
                        Email.account_id == account.id,
                        Email.nylas_message_id == nylas_msg["id"],
                    )
                )
                is_new = existing_msg.scalar_one_or_none() is None

                await upsert_message(db, nylas_msg, account.id, thread_id_db)
                if is_new:
                    total_messages += 1

            _sync_status[account_key] = {"status": "syncing", "messages": total_messages}

            page_token = result.get("next_cursor")
            if not page_token or not messages:
                break

        account.last_sync_at = datetime.now(timezone.utc)
        await db.commit()

        _sync_status[account_key] = {"status": "done", "messages": total_messages}
        logger.info("Synced %d messages for %s", total_messages, account.email_address)

    except Exception as e:
        _sync_status[account_key] = {"status": "error", "error": str(e)}
        logger.error("Sync failed for %s: %s", account.email_address, e, exc_info=True)
        raise

    return total_messages
