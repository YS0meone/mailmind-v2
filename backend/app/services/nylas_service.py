"""Nylas v3 API wrapper using the official Python SDK."""

import asyncio
from functools import partial

from nylas import Client
from nylas.models.auth import CodeExchangeRequest

from app.config import settings

nylas = Client(
    api_key=settings.nylas_api_key,
    api_uri=settings.nylas_api_uri,
)


async def exchange_code_for_grant(code: str, redirect_uri: str) -> dict:
    """Exchange a Nylas Hosted Auth authorization code for a grant."""
    request = CodeExchangeRequest(
        code=code,
        redirect_uri=redirect_uri,
        client_id=settings.nylas_client_id,
    )
    response = await asyncio.to_thread(nylas.auth.exchange_code_for_token, request)
    return {
        "grant_id": response.grant_id,
        "email": response.email or "",
    }


async def list_messages(
    grant_id: str,
    limit: int = 50,
    page_token: str | None = None,
    received_after: int | None = None,
) -> dict:
    """Fetch messages for a grant. Returns {data, next_cursor}."""
    query_params: dict = {"limit": limit}
    if page_token:
        query_params["page_token"] = page_token
    if received_after:
        query_params["received_after"] = received_after

    response = await asyncio.to_thread(
        nylas.messages.list, grant_id, query_params=query_params
    )

    data = [_message_to_dict(msg) for msg in response.data]
    return {"data": data, "next_cursor": response.next_cursor}


async def get_message(grant_id: str, message_id: str) -> dict:
    """Fetch a single message by ID."""
    response = await asyncio.to_thread(nylas.messages.find, grant_id, message_id)
    return _message_to_dict(response.data)


async def update_message(grant_id: str, message_id: str, updates: dict) -> dict:
    """Update message fields (unread, starred, folders)."""
    response = await asyncio.to_thread(
        nylas.messages.update, grant_id, message_id, request_body=updates
    )
    return _message_to_dict(response.data)


async def list_threads(
    grant_id: str,
    limit: int = 25,
    page_token: str | None = None,
) -> dict:
    """Fetch threads for a grant. Returns {data, next_cursor}."""
    query_params: dict = {"limit": limit}
    if page_token:
        query_params["page_token"] = page_token

    response = await asyncio.to_thread(
        nylas.threads.list, grant_id, query_params=query_params
    )

    data = [_thread_to_dict(t) for t in response.data]
    return {"data": data, "next_cursor": response.next_cursor}


async def get_thread(grant_id: str, thread_id: str) -> dict:
    """Fetch a single thread by ID."""
    response = await asyncio.to_thread(nylas.threads.find, grant_id, thread_id)
    return _thread_to_dict(response.data)


async def send_message(grant_id: str, message: dict) -> dict:
    """Send a message via Nylas."""
    response = await asyncio.to_thread(
        nylas.messages.send, grant_id, request_body=message
    )
    return _message_to_dict(response.data)


async def revoke_grant(grant_id: str) -> None:
    """Revoke/delete a Nylas grant."""
    await asyncio.to_thread(nylas.grants.destroy, grant_id)


# --- Converters: SDK objects → plain dicts ---

def _participant_to_dict(p) -> dict:
    return {"name": getattr(p, "name", None) or "", "email": getattr(p, "email", "") or ""}


def _message_to_dict(msg) -> dict:
    return {
        "id": msg.id,
        "grant_id": msg.grant_id,
        "thread_id": getattr(msg, "thread_id", None),
        "subject": getattr(msg, "subject", None),
        "snippet": getattr(msg, "snippet", None),
        "body": getattr(msg, "body", None),
        "from": [_participant_to_dict(p) for p in (msg.from_ or [])],
        "to": [_participant_to_dict(p) for p in (msg.to or [])],
        "cc": [_participant_to_dict(p) for p in (msg.cc or [])],
        "bcc": [_participant_to_dict(p) for p in (msg.bcc or [])],
        "reply_to": [_participant_to_dict(p) for p in (msg.reply_to or [])],
        "date": getattr(msg, "date", None),
        "unread": getattr(msg, "unread", False),
        "starred": getattr(msg, "starred", False),
        "folders": getattr(msg, "folders", []),
        "attachments": getattr(msg, "attachments", []),
    }


def _thread_to_dict(t) -> dict:
    return {
        "id": t.id,
        "grant_id": t.grant_id,
        "subject": getattr(t, "subject", None),
        "snippet": getattr(t, "snippet", None),
        "participants": [_participant_to_dict(p) for p in (getattr(t, "participants", None) or [])],
        "unread": getattr(t, "unread", False),
        "starred": getattr(t, "starred", False),
        "has_attachments": getattr(t, "has_attachments", False),
        "latest_message_received_date": getattr(t, "latest_message_received_date", None),
        "latest_message_sent_date": getattr(t, "latest_message_sent_date", None),
        "message_ids": getattr(t, "message_ids", []),
        "folders": getattr(t, "folders", []),
    }
