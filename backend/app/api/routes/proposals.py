"""Proposal routes — list, count, and update ambient agent proposals."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.routes.threads import trash_thread
from app.db.database import get_db
from app.models.email_account import EmailAccount
from app.models.proposal import AgentProposal
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/proposals", tags=["proposals"])


class ProposalResponse(BaseModel):
    id: str
    account_id: str
    thread_id: str | None
    type: str
    status: str
    payload: dict
    created_at: str

    model_config = {"from_attributes": True}


class ProposalListResponse(BaseModel):
    items: list[ProposalResponse]
    total: int
    page: int
    per_page: int


class ProposalCountResponse(BaseModel):
    count: int


class ProposalUpdateRequest(BaseModel):
    status: str


def _account_ids_subq(user_id: uuid.UUID):
    return select(EmailAccount.id).where(EmailAccount.user_id == user_id)


@router.get("/", response_model=ProposalListResponse)
async def list_proposals(
    status: str | None = None,
    type: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List proposals for the current user, with optional filters."""
    base = select(AgentProposal).where(
        AgentProposal.account_id.in_(_account_ids_subq(user.id))
    )
    count_base = select(func.count(AgentProposal.id)).where(
        AgentProposal.account_id.in_(_account_ids_subq(user.id))
    )

    if status:
        base = base.where(AgentProposal.status == status)
        count_base = count_base.where(AgentProposal.status == status)
    if type:
        base = base.where(AgentProposal.type == type)
        count_base = count_base.where(AgentProposal.type == type)

    total = (await db.execute(count_base)).scalar() or 0

    query = (
        base
        .order_by(AgentProposal.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    rows = result.scalars().all()

    return {
        "items": [
            {
                "id": str(r.id),
                "account_id": str(r.account_id),
                "thread_id": str(r.thread_id) if r.thread_id else None,
                "type": r.type,
                "status": r.status,
                "payload": r.payload,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/count", response_model=ProposalCountResponse)
async def count_proposals(
    status: str = Query("pending"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the count of proposals matching a status (default: pending)."""
    result = await db.execute(
        select(func.count(AgentProposal.id)).where(
            AgentProposal.account_id.in_(_account_ids_subq(user.id)),
            AgentProposal.status == status,
        )
    )
    return {"count": result.scalar() or 0}


@router.patch("/{proposal_id}")
async def update_proposal(
    proposal_id: uuid.UUID,
    body: ProposalUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a proposal's status (accept, reject, or dismiss)."""
    valid = {"accepted", "rejected", "dismissed"}
    if body.status not in valid:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of: {', '.join(sorted(valid))}",
        )

    result = await db.execute(
        select(AgentProposal).where(
            AgentProposal.id == proposal_id,
            AgentProposal.account_id.in_(_account_ids_subq(user.id)),
        )
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    proposal.status = body.status
    await db.commit()

    # Execute side-effects for accepted proposals
    if body.status == "accepted" and proposal.type == "suggest_delete" and proposal.thread_id:
        try:
            await trash_thread(proposal.thread_id, db)
        except Exception as e:
            logger.warning(
                "Failed to trash thread %s for proposal %s: %s",
                proposal.thread_id, proposal_id, e,
            )

    return {
        "id": str(proposal.id),
        "status": proposal.status,
    }
