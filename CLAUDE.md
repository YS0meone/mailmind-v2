# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**mailmind-v2** is a local-first AI-supported email client with an ambient triage agent. Users sign in with Google, connect Gmail via Nylas, and get AI-powered email classification, prioritization, draft replies, and a RAG chatbot over their email history.

## Commands

Use `make help` to see all available commands. Key ones:

```bash
make setup       # First-time: docker + backend + frontend deps
make dev         # Start everything (docker + backend + frontend)
make migrate     # Run pending DB migrations
make migration msg="add emails table"  # Create new migration
make lint        # Lint backend + frontend
make test        # Run backend tests
```

### Individual services (when needed)
```bash
make up          # Start PostgreSQL + Qdrant only
make backend     # Start FastAPI dev server only (:8000)
make frontend    # Start Next.js dev server only (:3000)
```

## Architecture

Monorepo with two services:

- **`frontend/`** — Next.js 16 (App Router), Tailwind CSS. No NextAuth — auth is handled entirely via Nylas Hosted Auth + our own JWT sessions stored in localStorage.
- **`backend/`** — FastAPI (Python). Async SQLAlchemy + asyncpg for PostgreSQL. Nylas v3 API for email operations. LangGraph (self-hosted) for the ambient triage agent with `langgraph-checkpoint-postgres` for durable HITL interrupts.

### Key data flow
1. **Auth**: "Sign in with Gmail" → Nylas Hosted Auth (`/v3/connect/auth`) → Google consent → Nylas callback with code → `POST /api/v1/auth/callback` → exchange code for `grant_id` → upsert user + account → return JWT
2. **Email sync**: Nylas webhooks (+ polling fallback) → upsert to PostgreSQL → embed to Qdrant → invoke LangGraph triage agent
3. **Triage agent**: classify → extract entities → prioritize → propose action → `interrupt()` for human approval → execute via Nylas
4. **RAG chat**: embed question → Qdrant vector search (filtered by account) → fetch full emails from PG → LLM answer with citations

### Key backend files
- `app/main.py` — FastAPI app, CORS, router mounting
- `app/config.py` — pydantic-settings for env vars
- `app/api/deps.py` — auth dependency (validates our JWT session token)
- `app/api/routes/auth.py` — Nylas callback (code exchange + user creation), accounts CRUD
- `app/services/session.py` — JWT session creation/verification (PyJWT)
- `app/services/nylas_service.py` — Nylas v3 API wrapper (code exchange, messages, grant revocation)
- `app/models/` — SQLAlchemy ORM models
- `app/db/migrations/` — Alembic migrations (async)

### Key frontend files
- `src/lib/auth.ts` — localStorage token management + Nylas Hosted Auth URL builder
- `src/lib/api-client.ts` — typed fetch wrapper for FastAPI backend (auto-attaches JWT)
- `src/app/login/page.tsx` — "Sign in with Gmail" button → redirects to Nylas
- `src/app/auth/callback/page.tsx` — handles Nylas redirect, exchanges code via backend, stores JWT

### External services
- **Nylas** (Free/Sandbox): email API + Google OAuth via Hosted Auth, max 5 accounts
- **PostgreSQL**: app data + LangGraph checkpoint storage
- **Qdrant**: vector store for email embeddings (RAG chatbot)

### Design decisions
- Nylas Hosted Auth (not Custom Auth) — single sign-in flow, Nylas manages Google OAuth credentials
- No NextAuth — Nylas handles all OAuth, backend issues its own JWT sessions
- Backend validates its own JWT tokens (PyJWT with HS256, SESSION_SECRET env var)
- Frontend stores JWT in localStorage, attaches as Bearer token to all API calls
