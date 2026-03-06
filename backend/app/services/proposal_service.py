"""Proposal persistence — writes ambient agent proposals to the database."""

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.proposal import AgentProposal

logger = logging.getLogger(__name__)


async def persist_proposals(
    proposals: list[dict],
    thread_id: uuid.UUID,
    account_id: uuid.UUID,
    db: AsyncSession,
) -> list[AgentProposal]:
    """Write proposals to the agent_proposals table and commit."""
    rows: list[AgentProposal] = []
    for p in proposals:
        row = AgentProposal(
            account_id=account_id,
            thread_id=thread_id,
            type=p["type"],
            payload=p.get("payload", {}),
        )
        db.add(row)
        rows.append(row)

    if rows:
        await db.commit()
        logger.info(
            "Persisted %d proposal(s) for thread %s",
            len(rows),
            thread_id,
        )
    return rows
