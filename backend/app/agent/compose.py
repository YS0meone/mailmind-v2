"""LangGraph compose agent — generates email body text with streaming."""

import logging
from typing import TypedDict

from langchain.chat_models import init_chat_model
from langgraph.graph import END, START, StateGraph

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an email writing assistant. Write the email body only. "
    "Do not include a subject line. Use a professional, concise style. "
    "Match the tone and formality implied by the user's instruction. "
    "If context from a previous email is provided, write a contextual reply."
)


class ComposeState(TypedDict):
    instruction: str
    thread_subject: str | None
    thread_snippet: str | None
    sender_name: str | None
    generated_body: str


_llm = init_chat_model(
    "gpt-4o-mini",
    model_provider="openai",
    temperature=0.7,
    api_key=settings.openai_api_key,
)


async def generate(state: ComposeState) -> dict:
    parts: list[str] = []
    if state.get("thread_subject"):
        parts.append(f'Thread subject: "{state["thread_subject"]}"')
    if state.get("thread_snippet"):
        parts.append(f'Latest message snippet: "{state["thread_snippet"]}"')
    if state.get("sender_name"):
        parts.append(f"Replying to: {state['sender_name']}")

    context = "\n".join(parts)
    human_msg = (
        f"## Context\n{context}\n\n" if context else ""
    ) + f"## Instruction\n{state['instruction']}"

    result = await _llm.ainvoke([("system", SYSTEM_PROMPT), ("human", human_msg)])
    return {"generated_body": result.content}


def build_graph():
    builder = StateGraph(ComposeState)
    builder.add_node("generate", generate)
    builder.add_edge(START, "generate")
    builder.add_edge("generate", END)
    return builder.compile()


async def stream_compose(state: ComposeState):
    """Yield (content_str) chunks as the LLM generates the email body."""
    graph = build_graph()
    async for msg, metadata in graph.astream(state, stream_mode="messages"):
        if hasattr(msg, "content") and msg.content:
            yield msg.content
