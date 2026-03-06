"""Agent routes — triage trigger, AI compose streaming, and AI chat."""

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.agent.chat import stream_chat
from app.agent.compose import ComposeState, stream_compose
from app.api.deps import get_current_user
from app.db.database import async_session
from app.models.email_account import EmailAccount
from app.models.thread import Thread
from app.models.user import User
from app.services.triage_service import run_triage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["agent"])


@router.post("/agent/triage/{thread_id}")
async def triage_thread(
    thread_id: uuid.UUID,
    user: User = Depends(get_current_user),
):
    """Manually trigger triage on a thread. Returns assigned label IDs."""
    async with async_session() as db:
        # Verify thread belongs to user
        account_ids_subq = select(EmailAccount.id).where(EmailAccount.user_id == user.id)
        result = await db.execute(
            select(Thread).where(
                Thread.id == thread_id,
                Thread.account_id.in_(account_ids_subq),
            )
        )
        thread = result.scalar_one_or_none()
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

        assigned = await run_triage(thread_id, thread.account_id, db)

    return {"thread_id": str(thread_id), "assigned_label_ids": assigned}


class ComposeRequest(BaseModel):
    instruction: str
    thread_subject: str | None = None
    thread_snippet: str | None = None
    sender_name: str | None = None


@router.post("/agent/compose")
async def compose_email(
    body: ComposeRequest,
    user: User = Depends(get_current_user),
):
    """Stream AI-generated email body via SSE."""

    state: ComposeState = {
        "instruction": body.instruction,
        "thread_subject": body.thread_subject,
        "thread_snippet": body.thread_snippet,
        "sender_name": body.sender_name,
        "generated_body": "",
    }

    async def event_stream():
        full_text = ""
        try:
            async for chunk in stream_compose(state):
                full_text += chunk
                yield f"event: token\ndata: {json.dumps({'content': chunk})}\n\n"
            yield f"event: done\ndata: {json.dumps({'full_text': full_text})}\n\n"
        except Exception as e:
            logger.exception("Compose streaming failed")
            yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("/agent/chat")
async def chat(
    body: ChatRequest,
    user: User = Depends(get_current_user),
):
    """Stream AI chat responses via SSE, powered by a ReAct agent with thread search."""

    async def event_stream():
        full_text = ""
        try:
            async with async_session() as db:
                # Resolve account_id
                result = await db.execute(
                    select(EmailAccount.id).where(EmailAccount.user_id == user.id).limit(1)
                )
                account_id = result.scalar_one_or_none()
                if not account_id:
                    err = json.dumps({"detail": "No email account linked"})
                    yield f"event: error\ndata: {err}\n\n"
                    return

                messages = [{"role": m.role, "content": m.content} for m in body.messages]
                async for chunk in stream_chat(messages, db, account_id):
                    full_text += chunk
                    yield f"event: token\ndata: {json.dumps({'content': chunk})}\n\n"

            yield f"event: done\ndata: {json.dumps({'full_text': full_text})}\n\n"
        except Exception as e:
            logger.exception("Chat streaming failed")
            yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
