# mailmind-v2 Architecture Plan

## Context

mailmind-v2 is a local-first AI-supported email client. The repo is freshly initialized (only a README exists). This plan establishes the full architecture and 6 incremental milestones to reach a production-ready MVP.

**Confirmed tech choices:**
- **Frontend**: Next.js (App Router) + Tailwind + shadcn/ui
- **Backend**: FastAPI (Python)
- **AI Agent**: LangGraph (self-hosted, integrated into FastAPI)
- **Email API**: Nylas (Free/Sandbox — 5 accounts, supports webhooks)
- **Auth**: NextAuth v5 (Google OAuth) → Nylas Custom Auth for grant creation
- **Database**: PostgreSQL (app data + LangGraph checkpoint storage)
- **Vector Store**: Qdrant (RAG chatbot)
- **HITL**: In-app notifications + email digest for offline users

---

## Monorepo Structure

```
mailmind-v2/
├── frontend/                  # Next.js 14+ (App Router)
│   ├── src/
│   │   ├── app/               # Pages: login, inbox, chat, actions, settings
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── auth.ts        # NextAuth config (Google + Gmail scopes)
│   │   │   └── api-client.ts  # Typed FastAPI client
│   │   └── types/
│   ├── next.config.js
│   └── package.json
│
├── backend/                   # FastAPI + LangGraph
│   ├── app/
│   │   ├── main.py            # FastAPI entry point
│   │   ├── config.py          # pydantic-settings
│   │   ├── api/routes/        # auth, emails, agent, chat, webhooks, notifications
│   │   ├── models/            # SQLAlchemy ORM (user, email_account, email, thread, agent_action)
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── services/          # nylas, sync, embedding, notification
│   │   ├── agent/             # LangGraph graph + nodes + tools
│   │   │   ├── graph.py       # Main graph definition + checkpointer
│   │   │   ├── state.py       # EmailTriageState TypedDict
│   │   │   └── nodes/         # classify, extract, prioritize, propose, execute
│   │   └── db/                # Async SQLAlchemy engine + Alembic migrations
│   ├── alembic.ini
│   ├── pyproject.toml
│   └── tests/
│
├── docker-compose.yml         # PostgreSQL + Qdrant
├── .env.example
└── CLAUDE.md
```

---

## Auth Flow

1. User clicks "Sign in with Google" → NextAuth handles OAuth (scopes: `openid email profile https://mail.google.com/`)
2. NextAuth callback captures Google `access_token` + `refresh_token`
3. Frontend calls `POST /api/v1/auth/connect` on FastAPI with Google tokens
4. FastAPI calls Nylas Custom Auth (`POST /v3/connect/custom`) → gets `grant_id`
5. Store `grant_id` in `email_accounts` table, encrypted `refresh_token` for grant re-creation
6. All subsequent Nylas calls use `GET /v3/grants/{grant_id}/...`

**Key decision**: Nylas Custom Auth (not Hosted Auth) avoids a second OAuth redirect.

---

## Email Sync Pipeline

```
Nylas Webhook (message.created/updated)
  → POST /api/v1/webhooks/nylas
  → Validate signature → Fetch full message from Nylas
  → Upsert to PostgreSQL (emails + threads tables)
  → Generate embedding → Upsert to Qdrant
  → Invoke LangGraph triage agent
```

**Polling fallback**: Every 5 min per account, fetches messages since `last_sync_at`. Deduplicates via `nylas_message_id`.

---

## LangGraph Agent (Triage)

```
START → [classify_email] → [extract_entities] → [determine_priority]
  ├─ actionable + high/medium priority:
  │    → [propose_action] → [human_approval] (interrupt())
  │         ├─ approved → [execute_action] → [save_result] → END
  │         ├─ edited   → [execute_action] → [save_result] → END
  │         └─ rejected → [save_result] → END
  └─ informational / low priority:
       → [save_result] → END
```

- **Checkpointer**: `langgraph-checkpoint-postgres` (durable across restarts, same DB)
- **Human-in-the-loop**: `interrupt()` pauses the graph, writes pending action to `agent_actions` table. User approves via UI → `POST /api/v1/agent/actions/{id}/decide` → resumes graph with `Command(resume=...)`.
- **Trigger**: Invoked automatically on each new email from the sync pipeline.

---

## RAG Chatbot

1. Embed user question → search Qdrant (filtered by user's `account_id`s) → top-K results
2. Fetch full email bodies from PostgreSQL
3. LLM generates answer with email citations
4. Streaming SSE endpoint: `POST /api/v1/chat/sessions/{id}/message`

**Qdrant collection**: `emails`, 1536-dim (OpenAI text-embedding-3-small), payload filters on `account_id`, `date`, `from_email`, `folders`, `ai_category`.

---

## Database Schema (key tables)

| Table | Purpose |
|-------|---------|
| `users` | Google profile (id, email, name, avatar) |
| `email_accounts` | Nylas grant per Gmail account (grant_id, encrypted refresh token) |
| `threads` | Thread grouping (nylas_thread_id, subject, last_message_at) |
| `emails` | Individual messages + AI annotations (ai_category, ai_priority, ai_summary, qdrant_point_id) |
| `agent_actions` | Pending/executed agent proposals (action_type, proposed_content, status, langgraph_thread_id) |
| `chat_sessions` / `chat_messages` | RAG conversation history + source citations |
| `notification_preferences` | In-app + digest settings per user |

---

## FastAPI Routes

```
/api/v1/auth/          connect, accounts, disconnect
/api/v1/emails/        list, get, patch (read/star), send
/api/v1/threads/       list, get (with messages)
/api/v1/agent/         triage trigger, list actions, decide (approve/reject/edit)
/api/v1/chat/          sessions CRUD, send message (SSE streaming)
/api/v1/webhooks/      Nylas webhook receiver
/api/v1/notifications/ list, mark read, preferences
```

Auth: JWT validation on all routes except webhooks. NextAuth session token → FastAPI dependency injection.

---

## Milestones

### M1: Foundation + Auth (Week 1–2)
- Init Next.js + FastAPI + docker-compose (Postgres + Qdrant)
- NextAuth v5 Google OAuth with Gmail scopes
- `POST /api/v1/auth/connect` → Nylas Custom Auth → store grant
- Alembic migrations: `users`, `email_accounts`
- **Verify**: Sign in → connect Gmail → Nylas grant created → can fetch messages via grant_id

### M2: Email Sync + Inbox UI (Week 3–4)
- Migrations: `emails`, `threads`
- Sync service: initial full sync (last 30 days) + webhook receiver + polling fallback
- Email CRUD API + send via Nylas
- Inbox UI: thread list, email detail panel, compose modal
- **Verify**: New Gmail emails appear in web inbox within seconds (webhook) or minutes (poll)

### M3: AI Triage Agent (Week 5–7)
- LangGraph graph with postgres checkpointer
- Agent nodes: classify, extract entities, prioritize, propose action, human approval (interrupt), execute
- Wire agent to sync pipeline (auto-triage new emails)
- Migration: `agent_actions`
- Pending Actions UI with approve/reject/edit
- **Verify**: New email → auto-classified with priority badge → actionable emails show proposed action → approve sends reply

### M4: RAG Email Chatbot (Week 8–9)
- Embedding service: embed emails on sync, backfill existing
- Qdrant collection setup with payload filtering
- Streaming chat endpoint (SSE)
- Migrations: `chat_sessions`, `chat_messages`
- Chat UI with source citations linking to emails
- **Verify**: Ask "What did X say about Y?" → grounded answer with clickable email sources

### M5: Notifications + Digest (Week 10–11)
- In-app notification system (SSE push + notification bell)
- Migration: `notification_preferences`
- Digest email: scheduled task, HTML template, sent via Nylas
- Deep links from digest → app pending action
- Quiet hours support
- **Verify**: Agent proposes action while user is offline → digest arrives → click opens pending action

### M6: Polish + Ambient Mode (Week 12–13)
- Auto-execute low-risk actions at high confidence (>0.95)
- Agent activity dashboard (triage stats, approval rate)
- Action expiry (48h timeout)
- Thread-aware context for reply proposals
- Combined search (full-text Postgres + semantic Qdrant)
- Error handling, retry logic, rate limiting
- **Verify**: System runs unattended 24h, correctly triaging emails end-to-end
