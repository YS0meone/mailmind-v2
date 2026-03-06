"""Triage service — public entrypoint for running the triage agent on a thread."""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.triage import run_triage_graph
from app.models.label import ThreadLabel
from app.models.thread import Thread

logger = logging.getLogger(__name__)


async def run_triage(
    thread_id: uuid.UUID,
    account_id: uuid.UUID,
    db: AsyncSession,
) -> list[str]:
    """Classify a thread and persist agent-assigned labels.

    Returns the list of assigned label IDs, or [] if skipped/failed.
    Skips threads that already have any labels (human or agent).
    """
    existing = (await db.execute(
        select(ThreadLabel.label_id)
        .where(ThreadLabel.thread_id == thread_id)
        .limit(1)
    )).scalar_one_or_none()
    if existing is not None:
        return []

    thread_row = (await db.execute(
        select(Thread.subject, Thread.snippet).where(Thread.id == thread_id)
    )).one_or_none()
    if thread_row is None:
        return []

    try:
        assigned = await run_triage_graph(
            thread_id, account_id, thread_row.subject, thread_row.snippet, db
        )
        await db.commit()
        if assigned:
            logger.info("Triage assigned labels %s to thread %s", assigned, thread_id)
        return assigned
    except Exception:
        logger.exception("Triage failed for thread %s", thread_id)
        await db.rollback()
        return []
