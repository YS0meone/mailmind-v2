import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.draft import Draft
from app.models.email_account import EmailAccount
from app.models.user import User
from app.schemas.email import (
    DraftCreateRequest,
    DraftListItem,
    DraftResponse,
    DraftUpdateRequest,
)

router = APIRouter(prefix="/drafts", tags=["drafts"])


def _account_ids_subq(user: User):
    return select(EmailAccount.id).where(EmailAccount.user_id == user.id)


@router.post("/", response_model=DraftResponse, status_code=201)
async def create_draft(
    body: DraftCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Use the first active account
    result = await db.execute(
        select(EmailAccount).where(
            EmailAccount.user_id == user.id, EmailAccount.is_active == True  # noqa: E712
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=400, detail="No active email account")

    draft = Draft(
        account_id=account.id,
        subject=body.subject,
        body=body.body,
        to_list=[p.model_dump() for p in body.to] if body.to else None,
        cc_list=[p.model_dump() for p in body.cc] if body.cc else None,
        bcc_list=[p.model_dump() for p in body.bcc] if body.bcc else None,
        mode=body.mode,
        reply_to_message_id=(
            uuid.UUID(body.reply_to_message_id) if body.reply_to_message_id else None
        ),
        thread_id=uuid.UUID(body.thread_id) if body.thread_id else None,
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


@router.get("/", response_model=list[DraftListItem])
async def list_drafts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Draft)
        .where(Draft.account_id.in_(_account_ids_subq(user)))
        .order_by(Draft.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/by-thread/{thread_id}", response_model=list[DraftResponse])
async def get_drafts_by_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Draft).where(
            Draft.thread_id == thread_id,
            Draft.account_id.in_(_account_ids_subq(user)),
        )
    )
    return result.scalars().all()


@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Draft).where(
            Draft.id == draft_id,
            Draft.account_id.in_(_account_ids_subq(user)),
        )
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.patch("/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: uuid.UUID,
    body: DraftUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Draft).where(
            Draft.id == draft_id,
            Draft.account_id.in_(_account_ids_subq(user)),
        )
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    updates = body.model_dump(exclude_unset=True)
    # Map to/cc/bcc -> to_list/cc_list/bcc_list
    for short, col in [("to", "to_list"), ("cc", "cc_list"), ("bcc", "bcc_list")]:
        if short in updates:
            val = updates.pop(short)
            setattr(draft, col, val if val else None)
    for key, val in updates.items():
        setattr(draft, key, val)

    draft.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(draft)
    return draft


@router.delete("/{draft_id}", status_code=204)
async def delete_draft(
    draft_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Draft).where(
            Draft.id == draft_id,
            Draft.account_id.in_(_account_ids_subq(user)),
        )
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    await db.delete(draft)
    await db.commit()
