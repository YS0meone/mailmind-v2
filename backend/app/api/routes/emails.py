import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.email import Email
from app.models.email_account import EmailAccount
from app.models.thread import Thread
from app.models.user import User
from app.schemas.email import EmailResponse, EmailUpdateRequest, SendEmailRequest
from app.services import nylas_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/emails", tags=["emails"])


async def _get_user_email(
    email_id: uuid.UUID, user: User, db: AsyncSession
) -> Email:
    """Fetch an email owned by the user or raise 404."""
    account_ids = select(EmailAccount.id).where(EmailAccount.user_id == user.id)
    result = await db.execute(
        select(Email).where(Email.id == email_id, Email.account_id.in_(account_ids))
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return email


@router.get("/{email_id}", response_model=EmailResponse)
async def get_email(
    email_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_user_email(email_id, user, db)


@router.patch("/{email_id}", response_model=EmailResponse)
async def update_email(
    email_id: uuid.UUID,
    body: EmailUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update read/star status. Syncs change to Nylas."""
    email = await _get_user_email(email_id, user, db)

    # Get the grant_id for this email's account
    account = await db.get(EmailAccount, email.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    nylas_updates = {}
    if body.is_unread is not None:
        email.is_unread = body.is_unread
        nylas_updates["unread"] = body.is_unread
    if body.is_starred is not None:
        email.is_starred = body.is_starred
        nylas_updates["starred"] = body.is_starred

    if nylas_updates:
        try:
            await nylas_service.update_message(
                account.nylas_grant_id, email.nylas_message_id, nylas_updates
            )
        except Exception as e:
            logger.warning("Failed to sync email %s to Nylas: %s", email_id, e)

    # Update parent thread's is_unread based on remaining unread emails
    if body.is_unread is not None and email.thread_id:
        # Flush so this email's new is_unread is visible to the query
        await db.flush()
        remaining_unread = await db.execute(
            select(Email.id)
            .where(
                Email.thread_id == email.thread_id,
                Email.is_unread == True,  # noqa: E712
            )
            .limit(1)
        )
        thread = await db.get(Thread, email.thread_id)
        if thread:
            thread.is_unread = remaining_unread.first() is not None

    await db.commit()
    await db.refresh(email)
    return email


@router.post("/send", response_model=EmailResponse)
async def send_email(
    body: SendEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send an email via Nylas."""
    # Use the first active account
    result = await db.execute(
        select(EmailAccount).where(
            EmailAccount.user_id == user.id, EmailAccount.is_active == True
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=400, detail="No active email account")

    message_payload = {
        "to": [p.model_dump() for p in body.to],
        "subject": body.subject,
        "body": body.body,
    }
    if body.reply_to_message_id:
        message_payload["reply_to_message_id"] = body.reply_to_message_id

    sent = await nylas_service.send_message(account.nylas_grant_id, message_payload)

    # Store the sent message locally
    from app.services.sync_service import upsert_message
    email = await upsert_message(db, sent, account.id)
    await db.commit()
    await db.refresh(email)
    return email
