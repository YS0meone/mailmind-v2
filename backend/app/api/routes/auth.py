import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.email_account import EmailAccount
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    EmailAccountResponse,
    NylasCallbackRequest,
    UserResponse,
)
from app.services import nylas_service
from app.services.session import create_session_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/callback", response_model=AuthResponse)
async def nylas_callback(
    request: NylasCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Handle Nylas Hosted Auth callback.

    This is the single sign-in endpoint:
    1. Exchange the Nylas code for a grant_id + email
    2. Upsert the user
    3. Upsert the email account
    4. Return a JWT session token
    """
    redirect_uri = request.redirect_uri or "http://localhost:3000/auth/callback"

    # Exchange code with Nylas
    try:
        grant_data = await nylas_service.exchange_code_for_grant(
            code=request.code,
            redirect_uri=redirect_uri,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to exchange Nylas code: {e}",
        )

    email = grant_data["email"]
    grant_id = grant_data["grant_id"]

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email returned from Nylas",
        )

    # Upsert user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(email=email)
        db.add(user)
        await db.flush()

    # Upsert email account (update grant if re-authenticating)
    result = await db.execute(
        select(EmailAccount).where(
            EmailAccount.user_id == user.id,
            EmailAccount.email_address == email,
        )
    )
    account = result.scalar_one_or_none()

    if account:
        account.nylas_grant_id = grant_id
        account.is_active = True
    else:
        account = EmailAccount(
            user_id=user.id,
            email_address=email,
            provider="google",
            nylas_grant_id=grant_id,
        )
        db.add(account)

    await db.commit()
    await db.refresh(user)
    await db.refresh(account)

    # Create session token
    token = create_session_token(str(user.id), user.email)

    return AuthResponse(
        token=token,
        user_id=user.id,
        email=user.email,
        nylas_grant_id=account.nylas_grant_id,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get the currently authenticated user."""
    return user


@router.get("/accounts", response_model=list[EmailAccountResponse])
async def list_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all connected email accounts for the current user."""
    result = await db.execute(
        select(EmailAccount).where(EmailAccount.user_id == user.id)
    )
    return result.scalars().all()


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_account(
    account_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect an email account (revoke Nylas grant and delete record)."""
    result = await db.execute(
        select(EmailAccount).where(
            EmailAccount.id == account_id,
            EmailAccount.user_id == user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    try:
        await nylas_service.revoke_grant(account.nylas_grant_id)
    except Exception:
        pass

    await db.delete(account)
    await db.commit()
