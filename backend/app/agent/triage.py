"""LangGraph triage agent — classifies email threads and assigns labels."""

import functools
import logging
import uuid
from typing import TypedDict

from langchain.chat_models import init_chat_model
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.label import Label, ThreadLabel
from app.models.thread import Thread

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an email triage assistant. Given a thread subject and snippet, "
    "assign matching labels from the list. Only assign labels that clearly apply; "
    "returning an empty list is correct when nothing matches."
)


# --- State types ---

class LabelExample(TypedDict):
    subject: str
    snippet: str


class LabelContext(TypedDict):
    label_id: str
    name: str
    description: str | None
    examples: list[LabelExample]


class TriageState(TypedDict):
    thread_id: str
    account_id: str
    subject: str | None
    snippet: str | None
    labels: list[LabelContext]
    assigned_label_ids: list[str]


# --- LLM structured output ---

class ClassificationOutput(BaseModel):
    label_ids: list[str]


_llm = init_chat_model(
    "gpt-4o-mini",
    model_provider="openai",
    temperature=0,
    api_key=settings.openai_api_key,
).with_structured_output(ClassificationOutput)


# --- Nodes ---

async def fetch_context(state: TriageState, *, db: AsyncSession) -> dict:
    account_id = uuid.UUID(state["account_id"])

    label_result = await db.execute(
        select(Label)
        .where(Label.account_id == account_id)
        .order_by(Label.position, Label.created_at)
    )
    labels = label_result.scalars().all()

    label_contexts: list[LabelContext] = []
    for label in labels:
        rows = await db.execute(
            select(Thread.subject, Thread.snippet)
            .join(ThreadLabel, ThreadLabel.thread_id == Thread.id)
            .where(
                ThreadLabel.label_id == label.id,
                ThreadLabel.source == "human",
            )
            .order_by(ThreadLabel.created_at.desc())
            .limit(5)
        )
        examples: list[LabelExample] = [
            {"subject": r.subject or "", "snippet": r.snippet or ""}
            for r in rows
        ]
        label_contexts.append({
            "label_id": str(label.id),
            "name": label.name,
            "description": label.description,
            "examples": examples,
        })

    return {"labels": label_contexts}


async def classify(state: TriageState) -> dict:
    if not state["labels"]:
        return {"assigned_label_ids": []}

    label_sections = []
    for lc in state["labels"]:
        desc = lc["description"] or "No description."
        lines = [
            f"### {lc['name']} (id: {lc['label_id']})",
            f"Description: {desc}",
        ]
        if lc["examples"]:
            lines.append("Examples of threads a human assigned to this label:")
            for ex in lc["examples"]:
                lines.append(f'  - Subject: "{ex["subject"]}" | Snippet: "{ex["snippet"]}"')
        else:
            lines.append("No human-annotated examples yet.")
        label_sections.append("\n".join(lines))

    human_msg = (
        "## Available labels\n\n"
        + "\n\n".join(label_sections)
        + "\n\n## Thread to classify\n"
        + f'Subject: "{state["subject"] or ""}"\n'
        + f'Snippet: "{state["snippet"] or ""}"\n\n'
        + "Return the label UUIDs that apply."
    )

    result = await _llm.ainvoke([("system", SYSTEM_PROMPT), ("human", human_msg)])

    valid = {lc["label_id"] for lc in state["labels"]}
    assigned = [lid for lid in result.label_ids if lid in valid]
    logger.info("Triage classified thread %s → labels %s", state["thread_id"], assigned)
    return {"assigned_label_ids": assigned}


async def apply_labels(state: TriageState, *, db: AsyncSession) -> dict:
    for lid in state["assigned_label_ids"]:
        db.add(ThreadLabel(
            thread_id=uuid.UUID(state["thread_id"]),
            label_id=uuid.UUID(lid),
            source="agent",
        ))
    await db.flush()
    return {}


# --- Graph ---

def build_graph(db: AsyncSession):
    builder = StateGraph(TriageState)
    builder.add_node("fetch_context", functools.partial(fetch_context, db=db))
    builder.add_node("classify", classify)
    builder.add_node("apply_labels", functools.partial(apply_labels, db=db))
    builder.add_edge(START, "fetch_context")
    builder.add_edge("fetch_context", "classify")
    builder.add_edge("classify", "apply_labels")
    builder.add_edge("apply_labels", END)
    return builder.compile()


async def run_triage_graph(
    thread_id: uuid.UUID,
    account_id: uuid.UUID,
    subject: str | None,
    snippet: str | None,
    db: AsyncSession,
) -> list[str]:
    graph = build_graph(db)
    final = await graph.ainvoke({
        "thread_id": str(thread_id),
        "account_id": str(account_id),
        "subject": subject,
        "snippet": snippet,
        "labels": [],
        "assigned_label_ids": [],
    })
    return final.get("assigned_label_ids", [])
