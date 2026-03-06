# mailmind-v2

A local-first, AI-supported email client with an ambient triage agent. Sign in with Gmail, get your inbox automatically classified and prioritized, review AI-proposed actions with one click, and chat with your email history using RAG.

## Features

- **Gmail inbox** — threads, search (full-text + fuzzy), read/unread, star, labels, compose, reply, draft autosave
- **AI triage agent** — classifies, prioritizes, and proposes actions on incoming email; human-in-the-loop approval before execution
- **RAG chatbot** — ask natural-language questions over your full email history with source citations
- **Ambient mode** — agent runs continuously; high-confidence low-risk actions can auto-execute

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| Backend | FastAPI (Python 3.11+), async SQLAlchemy + asyncpg |
| Email API | Nylas v3 (Gmail via Hosted Auth, webhooks + polling) |
| AI agent | LangGraph (self-hosted, postgres checkpointer) |
| Vector store | Qdrant (email embeddings for RAG) |
| Database | PostgreSQL 16 |
| Auth | Nylas Hosted Auth + backend-issued JWT (no NextAuth) |

## Prerequisites

- Docker + Docker Compose
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [pnpm](https://pnpm.io/) (Node package manager)
- A [Nylas](https://dashboard.nylas.com/) account (free sandbox, up to 5 Gmail accounts)
- An OpenAI API key (embeddings + LLM)

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-username/mailmind-v2.git
cd mailmind-v2
make setup
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
NYLAS_CLIENT_ID=your_nylas_client_id
NYLAS_API_KEY=your_nylas_api_key
NYLAS_WEBHOOK_SECRET=your_nylas_webhook_secret
SESSION_SECRET=generate-a-random-secret-here
OPENAI_API_KEY=your_openai_api_key
```

> Get your Nylas credentials from the [Nylas Dashboard](https://dashboard.nylas.com/). Set the callback URI to `http://localhost:8000/api/v1/auth/callback`.

### 3. Run database migrations

```bash
make migrate
```

### 4. Start the dev servers

```bash
make dev
```

This starts PostgreSQL + Qdrant in Docker, then shows you to run the backend and frontend in separate terminals:

```bash
make backend    # terminal 1 — FastAPI on :8000
make frontend   # terminal 2 — Next.js on :3000
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Gmail.

## Development commands

```bash
make help        # list all commands
make setup       # first-time: docker + deps
make dev         # start docker, then open two terminals for backend + frontend
make migrate     # run pending DB migrations
make migration msg="add agent_actions table"  # create a new migration
make lint        # lint backend (ruff) + frontend (eslint)
make format      # format backend code
make test        # run backend tests (pytest)
make clean       # remove containers, volumes, and build artifacts
```

### Full Docker stack (optional)

To run everything including the backend and frontend in Docker:

```bash
make dev-docker        # build + start all services
make dev-docker-down   # stop
make dev-docker-logs   # tail logs
```

## Project structure

```
mailmind-v2/
├── frontend/                  # Next.js 16 (App Router)
│   └── src/
│       ├── app/               # Pages: login, inbox, dashboard, auth/callback
│       ├── components/        # inbox/, ui/ (shadcn)
│       ├── hooks/             # use-inbox, use-labels, use-draft-autosave, ...
│       ├── lib/               # auth.ts, api-client.ts, format.ts
│       └── types/             # email.ts
│
├── backend/                   # FastAPI + LangGraph
│   └── app/
│       ├── main.py            # FastAPI entry point, CORS, router mounting
│       ├── config.py          # pydantic-settings (reads .env)
│       ├── api/routes/        # auth, emails, threads, drafts, labels,
│       │                      # contacts, sync, webhooks
│       ├── models/            # SQLAlchemy ORM models
│       ├── schemas/           # Pydantic request/response schemas
│       ├── services/          # nylas_service, sync_service, session, crypto
│       ├── agent/             # LangGraph graph, state, nodes, tools
│       └── db/                # async engine, Alembic migrations
│
├── docker-compose.yml         # PostgreSQL 16 + Qdrant
├── .env.example               # environment variable template
├── Makefile                   # all dev commands
└── docs/
    └── ARCHITECTURE.md        # detailed architecture plan + milestones
```

## Architecture

### Auth flow

1. User clicks "Sign in with Gmail" on the login page
2. Frontend redirects to Nylas Hosted Auth (`/v3/connect/auth`) — Nylas handles Google consent
3. Nylas redirects back to `GET /api/v1/auth/callback` with an auth code
4. Backend exchanges the code for a `grant_id` via Nylas, upserts the user + account, issues a JWT
5. JWT is stored in `localStorage` and attached as `Authorization: Bearer` on every API call

### Email sync

```
Nylas Webhook (message.created / message.updated)
  -> POST /api/v1/webhooks/nylas
  -> validate HMAC signature
  -> fetch full message from Nylas
  -> upsert to PostgreSQL (emails + threads)
  -> embed to Qdrant
  -> invoke LangGraph triage agent
```

Polling fallback runs every 5 minutes per account for reliability.

### AI triage agent (LangGraph)

```
START -> classify_email -> extract_entities -> determine_priority
  |-- actionable (high/medium priority):
  |     -> propose_action -> interrupt() (human approval)
  |          |-- approved/edited -> execute_action -> save_result -> END
  |          `-- rejected        -> save_result -> END
  `-- informational / low priority:
        -> save_result -> END
```

The graph uses `langgraph-checkpoint-postgres` for durable state across restarts. Pending actions are stored in `agent_actions` and surfaced in the UI for one-click approval.

### RAG chatbot

1. Embed the user's question (OpenAI `text-embedding-3-small`)
2. Vector search in Qdrant filtered by the user's account IDs
3. Fetch full email bodies from PostgreSQL
4. Stream LLM answer with email citations via SSE

## API routes

```
/api/v1/auth/       callback, accounts, disconnect
/api/v1/emails/     list, get, patch (read/star/labels), send
/api/v1/threads/    list, get (with messages)
/api/v1/drafts/     CRUD + send
/api/v1/labels/     CRUD
/api/v1/contacts/   list (autocomplete)
/api/v1/sync/       trigger manual sync
/api/v1/webhooks/   Nylas webhook receiver
```

All routes except `/webhooks/` require a valid JWT session token.

## Database schema

| Table | Purpose |
|---|---|
| `users` | Google profile (id, email, name, avatar) |
| `email_accounts` | Nylas grant per Gmail account |
| `threads` | Thread grouping (subject, last_message_at, participant list) |
| `emails` | Individual messages + AI annotations (category, priority, summary) |
| `drafts` | Local drafts with autosave |
| `labels` | User-defined labels with color |
| `agent_actions` | Pending/executed agent proposals |
| `chat_sessions` / `chat_messages` | RAG conversation history + citations |
