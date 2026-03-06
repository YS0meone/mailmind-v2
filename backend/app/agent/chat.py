"""ReAct chat agent — answers email questions using a thread search tool."""

import logging
import uuid
from datetime import datetime

from langchain.chat_models import init_chat_model
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from sqlalchemy import Text, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.email import Email
from app.models.label import Label, ThreadLabel
from app.models.thread import Thread

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an email assistant. Use search_threads to find relevant emails, "
    "then synthesize a helpful answer citing specific threads (subject, sender, date). "
    "You may call the tool multiple times with different filters to refine results. "
    "If no results are found, suggest the user refine their query. "
    "Keep answers concise and well-structured."
)


def _make_search_tool(db: AsyncSession, account_id: uuid.UUID):
    @tool
    async def search_threads(
        keyword: str | None = None,
        sender: str | None = None,
        receiver: str | None = None,
        label_name: str | None = None,
        after: str | None = None,
        before: str | None = None,
        is_unread: bool | None = None,
        is_starred: bool | None = None,
        has_attachments: bool | None = None,
        limit: int = 10,
    ) -> str:
        """Search email threads. Use keyword for text search, sender/receiver for people,
        label_name for categories, after/before for dates (ISO format YYYY-MM-DD).
        Combine filters to narrow results. Returns thread summaries."""
        query = (
            select(Thread)
            .options(selectinload(Thread.labels))
            .where(Thread.account_id == account_id)
            .order_by(Thread.last_message_at.desc())
            .limit(min(limit, 10))
        )

        needs_email_join = keyword or sender or receiver

        if needs_email_join:
            email_filters = [
                Email.account_id == account_id,
                Email.thread_id.is_not(None),
            ]

            if keyword:
                kw = keyword.strip()
                search_tsquery = func.websearch_to_tsquery(text("'english'"), kw)
                ilike_pattern = f"%{kw}%"
                email_filters.append(
                    or_(
                        Email.search_vector.op("@@")(search_tsquery),
                        Email.search_text.ilike(ilike_pattern),
                    )
                )

            if sender:
                email_filters.append(Email.from_email.ilike(f"%{sender}%"))

            if receiver:
                email_filters.append(
                    func.cast(Email.to_list, Text).ilike(f"%{receiver}%")
                )

            matching_thread_ids = (
                select(Email.thread_id).where(*email_filters).distinct()
            )
            query = query.where(Thread.id.in_(matching_thread_ids))

        if label_name:
            labeled_ids = (
                select(ThreadLabel.thread_id)
                .join(Label, Label.id == ThreadLabel.label_id)
                .where(Label.name.ilike(f"%{label_name}%"))
            )
            query = query.where(Thread.id.in_(labeled_ids))

        if after:
            query = query.where(
                Thread.last_message_at >= datetime.fromisoformat(after)
            )
        if before:
            query = query.where(
                Thread.last_message_at <= datetime.fromisoformat(before)
            )

        if is_unread is not None:
            query = query.where(Thread.is_unread == is_unread)
        if is_starred is not None:
            query = query.where(Thread.is_starred == is_starred)
        if has_attachments is not None:
            query = query.where(Thread.has_attachments == has_attachments)

        result = await db.execute(query)
        threads = result.scalars().all()

        if not threads:
            return "No threads found matching the criteria."

        lines = []
        for t in threads:
            label_names = (
                ", ".join(lb.name for lb in t.labels) if t.labels else "none"
            )
            date_str = (
                t.last_message_at.strftime("%Y-%m-%d %H:%M")
                if t.last_message_at
                else "unknown"
            )
            participants = ""
            if t.participants:
                names = [p.get("name") or p.get("email", "") for p in t.participants[:3]]
                participants = ", ".join(names)
            flags = []
            if t.is_unread:
                flags.append("unread")
            if t.is_starred:
                flags.append("starred")
            if t.has_attachments:
                flags.append("has attachments")
            flag_str = f" [{', '.join(flags)}]" if flags else ""

            lines.append(
                f"- **{t.subject or '(no subject)'}**{flag_str}\n"
                f"  From: {participants} | Date: {date_str} | Labels: {label_names}\n"
                f"  Snippet: {(t.snippet or '')[:150]}"
            )

        return f"Found {len(threads)} thread(s):\n\n" + "\n\n".join(lines)

    return search_threads


def build_chat_agent(db: AsyncSession, account_id: uuid.UUID):
    llm = init_chat_model(
        "gpt-4o-mini",
        model_provider="openai",
        temperature=0.3,
        api_key=settings.openai_api_key,
    )
    search_tool = _make_search_tool(db, account_id)
    return create_react_agent(llm, tools=[search_tool], prompt=SYSTEM_PROMPT)


async def stream_chat(messages: list[dict], db: AsyncSession, account_id: uuid.UUID):
    """Yield content chunks from the agent's final response."""
    agent = build_chat_agent(db, account_id)
    async for msg, metadata in agent.astream(
        {"messages": messages}, stream_mode="messages"
    ):
        if (
            hasattr(msg, "content")
            and msg.content
            and isinstance(msg.content, str)
            and metadata.get("langgraph_node") == "agent"
        ):
            yield msg.content
