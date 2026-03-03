"""Nylas webhook receiver — no auth dependency (requests come from Nylas)."""

import asyncio
import hashlib
import hmac
import logging

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from starlette.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_signature(body: bytes, signature: str, secret: str) -> bool:
    """Verify Nylas X-Nylas-Signature using HMAC-SHA256."""
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


async def _handle_message_event(grant_id: str):
    """Look up account by grant_id and trigger a background sync."""
    from sqlalchemy import select

    from app.db.database import async_session
    from app.models.email_account import EmailAccount
    from app.services.sync_service import sync_account

    async with async_session() as db:
        result = await db.execute(
            select(EmailAccount).where(
                EmailAccount.nylas_grant_id == grant_id,
                EmailAccount.is_active == True,  # noqa: E712
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            logger.warning("Webhook: no active account for grant_id=%s", grant_id)
            return

        logger.info("Webhook: syncing account %s (grant=%s)", account.email_address, grant_id)
        try:
            await sync_account(db, account, days=1)
        except Exception as e:
            logger.error("Webhook sync failed for %s: %s", account.email_address, e, exc_info=True)


@router.get("/nylas")
async def nylas_challenge(request: Request):
    """Nylas endpoint verification handshake — return the challenge value."""
    challenge = request.query_params.get("challenge", "")
    return PlainTextResponse(challenge)


@router.post("/nylas")
async def nylas_webhook(request: Request):
    """Receive Nylas webhook events."""
    secret = settings.nylas_webhook_secret
    if not secret:
        logger.error("Webhook: NYLAS_WEBHOOK_SECRET not configured")
        return JSONResponse({"error": "webhook secret not configured"}, status_code=500)

    # Verify signature
    signature = request.headers.get("x-nylas-signature", "")
    body = await request.body()

    if not signature or not _verify_signature(body, signature, secret):
        return JSONResponse({"error": "invalid signature"}, status_code=401)

    import json

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return JSONResponse({"error": "invalid JSON"}, status_code=400)

    event_type = payload.get("type", "")
    logger.info("Webhook: received event type=%s", event_type)

    if event_type in ("message.created", "message.updated"):
        try:
            grant_id = payload["data"]["object"]["grant_id"]
        except (KeyError, TypeError):
            logger.warning("Webhook: could not extract grant_id from payload")
            return JSONResponse({"status": "ignored"})

        # Fire-and-forget background sync
        asyncio.create_task(_handle_message_event(grant_id))

    return JSONResponse({"status": "ok"})
