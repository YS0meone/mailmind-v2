import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.email_account import EmailAccount
from app.models.label import Label, ThreadLabel
from app.models.thread import Thread
from app.models.user import User
from app.schemas.email import (
    LabelCreateRequest,
    LabelResponse,
    LabelUpdateRequest,
    ThreadLabelsRequest,
)

router = APIRouter(tags=["labels"])

PRESET_LABELS = [
    {"name": "Work", "color": "blue", "description": "Work-related emails, meetings, projects"},
    {"name": "Shopping", "color": "green", "description": "Orders, receipts, shipping"},
    {"name": "News", "color": "purple", "description": "Newsletters, news digests, subscriptions"},
    {"name": "Finance", "color": "amber", "description": "Banking, bills, payments, investments"},
]


def _account_ids_subq(user: User):
    return select(EmailAccount.id).where(EmailAccount.user_id == user.id)


async def seed_preset_labels(account_id: uuid.UUID, db: AsyncSession) -> None:
    for i, preset in enumerate(PRESET_LABELS):
        label = Label(
            account_id=account_id,
            name=preset["name"],
            color=preset["color"],
            description=preset["description"],
            is_preset=True,
            position=i,
        )
        db.add(label)


@router.get("/labels/", response_model=list[LabelResponse])
async def list_labels(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account_ids = _account_ids_subq(user)
    result = await db.execute(
        select(Label)
        .where(Label.account_id.in_(account_ids))
        .order_by(Label.position, Label.created_at)
    )
    labels = result.scalars().all()

    # Auto-seed presets for existing accounts that have none
    if not labels:
        acct_result = await db.execute(
            select(EmailAccount).where(
                EmailAccount.user_id == user.id,
                EmailAccount.is_active == True,  # noqa: E712
            )
        )
        account = acct_result.scalars().first()
        if account:
            await seed_preset_labels(account.id, db)
            await db.commit()
            result = await db.execute(
                select(Label)
                .where(Label.account_id.in_(account_ids))
                .order_by(Label.position, Label.created_at)
            )
            labels = result.scalars().all()

    return labels


@router.post("/labels/", response_model=LabelResponse, status_code=201)
async def create_label(
    body: LabelCreateRequest,
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

    # Get next position
    pos_result = await db.execute(
        select(Label.position)
        .where(Label.account_id == account.id)
        .order_by(Label.position.desc())
        .limit(1)
    )
    max_pos = pos_result.scalar_one_or_none()
    next_pos = (max_pos or 0) + 1

    label = Label(
        account_id=account.id,
        name=body.name,
        color=body.color,
        description=body.description,
        position=next_pos,
    )
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return label


@router.patch("/labels/{label_id}", response_model=LabelResponse)
async def update_label(
    label_id: uuid.UUID,
    body: LabelUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Label).where(
            Label.id == label_id,
            Label.account_id.in_(_account_ids_subq(user)),
        )
    )
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    updates = body.model_dump(exclude_unset=True)
    for key, val in updates.items():
        setattr(label, key, val)
    label.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(label)
    return label


@router.delete("/labels/{label_id}", status_code=204)
async def delete_label(
    label_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Label).where(
            Label.id == label_id,
            Label.account_id.in_(_account_ids_subq(user)),
        )
    )
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    await db.delete(label)
    await db.commit()


@router.put("/threads/{thread_id}/labels", response_model=list[LabelResponse])
async def set_thread_labels(
    thread_id: uuid.UUID,
    body: ThreadLabelsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify thread belongs to user
    result = await db.execute(
        select(Thread).where(
            Thread.id == thread_id,
            Thread.account_id.in_(_account_ids_subq(user)),
        )
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Replace all thread_labels for this thread
    await db.execute(
        delete(ThreadLabel).where(ThreadLabel.thread_id == thread_id)
    )

    for label_id in body.label_ids:
        db.add(ThreadLabel(thread_id=thread_id, label_id=label_id))

    await db.commit()

    # Return the updated labels
    result = await db.execute(
        select(Label).where(Label.id.in_(body.label_ids))
    )
    return result.scalars().all()
