"""Ambient agent — inspects incoming emails and generates action proposals.

Graph shape:  START → triage_node → decide_node → END

- triage_node  : mandatory, always runs, reuses the existing triage graph to
                 classify labels and apply them.  Adds a "triage" proposal.
- decide_node  : single LLM call with bound tools.  The model decides which
                 optional proposals (notify / draft_reply / flag_urgent) are
                 warranted and returns all tool calls in one shot.  Tools are
                 pure functions — no IO, no side-effects.  Side-effects (label
                 writes, draft creation) happen *after* the graph returns.
"""

import functools
import logging
import operator
import uuid
from typing import Annotated, Literal, TypedDict

from langchain.chat_models import init_chat_model
from langchain_core.tools import tool
from langgraph.graph import END, START, StateGraph
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.triage import run_triage_graph
from app.config import settings
from app.models.email import Email
from app.models.thread import Thread

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class Proposal(TypedDict):
    type: Literal["triage", "notify", "draft_reply", "flag_urgent"]
    payload: dict


class AmbientState(TypedDict):
    # Input — populated by run_ambient_agent before invoking the graph
    thread_id: str
    account_id: str
    subject: str | None
    snippet: str | None
    body_preview: str | None
    from_email: str | None
    from_name: str | None
    # Written by triage_node, read by decide_node for prompt context
    triage_label_ids: list[str]
    # Output — Annotated[list, operator.add] allows both nodes to append safely
    proposals: Annotated[list[Proposal], operator.add]


# ---------------------------------------------------------------------------
# Optional proposal tools — pure, instant, no IO
# ---------------------------------------------------------------------------

@tool
def notify_tool(
    reason: str,
    urgency: Literal["high", "medium"] = "medium",
) -> Proposal:
    """Notify the user that this email deserves their attention."""
    return {"type": "notify", "payload": {"reason": reason, "urgency": urgency}}


@tool
def draft_reply_tool(
    reason: str,
    tone: Literal["professional", "casual", "formal"] = "professional",
) -> Proposal:
    """Propose drafting a reply when a response is clearly expected."""
    return {"type": "draft_reply", "payload": {"reason": reason, "tone": tone}}


@tool
def flag_urgent_tool(reason: str) -> Proposal:
    """Flag this email as requiring the user's immediate attention."""
    return {"type": "flag_urgent", "payload": {"reason": reason}}


_OPTIONAL_TOOLS = [notify_tool, draft_reply_tool, flag_urgent_tool]
_TOOL_MAP = {t.name: t for t in _OPTIONAL_TOOLS}


# ---------------------------------------------------------------------------
# LLM for decide_node
# ---------------------------------------------------------------------------

_DECIDE_SYSTEM_PROMPT = (
    "You are an ambient email assistant reviewing an incoming email that has just been triaged.\n"
    "Decide whether any additional actions are warranted by calling the appropriate tools.\n"
    "You may call zero, one, or several tools — but never call the same tool more than once.\n\n"
    "Tool guidance:\n"
    "  notify_tool      — email is notable and the user should be made aware\n"
    "  draft_reply_tool — a reply is clearly expected from the user\n"
    "  flag_urgent_tool — requires the user's immediate attention\n\n"
    "Default to doing nothing. Newsletters, automated alerts, and low-signal "
    "emails should be silently ignored."
)

_decide_llm = init_chat_model(
    "gpt-4o-mini",
    model_provider="openai",
    temperature=0,
    api_key=settings.openai_api_key,
).bind_tools(_OPTIONAL_TOOLS)


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

async def triage_node(state: AmbientState, *, db: AsyncSession) -> dict:
    """Mandatory first step: classify labels and apply them via the triage graph."""
    assigned = await run_triage_graph(
        thread_id=uuid.UUID(state["thread_id"]),
        account_id=uuid.UUID(state["account_id"]),
        subject=state["subject"],
        snippet=state["snippet"],
        db=db,
    )
    proposal: Proposal = {
        "type": "triage",
        "payload": {"assigned_label_ids": assigned},
    }
    return {"triage_label_ids": assigned, "proposals": [proposal]}


async def decide_node(state: AmbientState) -> dict:
    """Single LLM call: decide which optional proposals to generate."""
    parts: list[str] = []
    if state.get("subject"):
        parts.append(f'Subject: "{state["subject"]}"')
    sender = state.get("from_name") or state.get("from_email") or ""
    if sender:
        parts.append(f"From: {sender} <{state.get('from_email', '')}>")
    if state.get("snippet"):
        parts.append(f'Snippet: "{state["snippet"]}"')
    if state.get("body_preview"):
        parts.append(f"Body preview:\n{state['body_preview']}")
    if state.get("triage_label_ids"):
        parts.append(f"Triage assigned label IDs: {state['triage_label_ids']}")

    human_msg = "\n".join(parts) if parts else "No email context available."

    response = await _decide_llm.ainvoke([
        ("system", _DECIDE_SYSTEM_PROMPT),
        ("human", human_msg),
    ])

    if not response.tool_calls:
        return {"proposals": []}

    # Execute tool calls; deduplicate by tool name to prevent double proposals
    proposals: list[Proposal] = []
    seen: set[str] = set()
    for tc in response.tool_calls:
        name = tc["name"]
        if name in _TOOL_MAP and name not in seen:
            seen.add(name)
            proposals.append(_TOOL_MAP[name].invoke(tc["args"]))

    return {"proposals": proposals}


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

def build_ambient_graph(db: AsyncSession):
    builder = StateGraph(AmbientState)
    builder.add_node("triage", functools.partial(triage_node, db=db))
    builder.add_node("decide", decide_node)
    builder.add_edge(START, "triage")
    builder.add_edge("triage", "decide")
    builder.add_edge("decide", END)
    return builder.compile()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_ambient_agent(
    thread_id: uuid.UUID,
    account_id: uuid.UUID,
    db: AsyncSession,
) -> list[Proposal]:
    """Run the ambient agent on an incoming thread.

    Returns all generated proposals.  Label assignments (from triage) are
    committed to the DB here, after the graph completes.  All other proposal
    side-effects (draft creation, SSE push) are the caller's responsibility.
    """
    thread = (await db.execute(
        select(Thread).where(Thread.id == thread_id)
    )).scalar_one_or_none()
    if thread is None:
        logger.warning("Ambient agent: thread %s not found", thread_id)
        return []

    # Most recent email in the thread for body context
    email = (await db.execute(
        select(Email)
        .where(Email.thread_id == thread_id)
        .order_by(Email.received_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    graph = build_ambient_graph(db)
    final = await graph.ainvoke({
        "thread_id": str(thread_id),
        "account_id": str(account_id),
        "subject": thread.subject,
        "snippet": thread.snippet,
        "body_preview": (email.snippet or "")[:500] if email else None,
        "from_email": email.from_email if email else None,
        "from_name": email.from_name if email else None,
        "triage_label_ids": [],
        "proposals": [],
    })

    await db.commit()  # persists label assignments written by triage_node
    proposals = final.get("proposals", [])
    logger.info(
        "Ambient agent completed for thread %s — %d proposal(s): %s",
        thread_id,
        len(proposals),
        [p["type"] for p in proposals],
    )
    return proposals
