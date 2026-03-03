# M2: Email Sync + Inbox UI

Detailed implementation plan for Milestone 2. Builds on M1 (Foundation + Auth with Nylas Hosted Auth).

## Goals

- Sync emails from Gmail via Nylas (initial sync + webhooks + polling fallback)
- Store emails and threads in PostgreSQL
- Expose CRUD API for emails/threads
- Send emails via Nylas
- Build an inbox UI with thread list, email detail, and compose

## Prerequisites

- M1 complete: user can sign in, Nylas grant exists in `email_accounts`
- Docker services running (PostgreSQL + Qdrant)

---

## Phase 1: Database Models + Migrations

### New tables

**`threads`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `account_id` | UUID | FK → email_accounts.id |
| `nylas_thread_id` | VARCHAR(255) | Unique per account |
| `subject` | TEXT | |
| `snippet` | TEXT | Preview text |
| `is_unread` | BOOLEAN | |
| `is_starred` | BOOLEAN | |
| `has_attachments` | BOOLEAN | |
| `participant_emails` | JSONB | `[{name, email}]` |
| `folder_ids` | JSONB | Nylas folder/label IDs |
| `last_message_at` | TIMESTAMP(tz) | For sorting |
| `message_count` | INTEGER | |
| `created_at` | TIMESTAMP(tz) | |
| `updated_at` | TIMESTAMP(tz) | |

**`emails`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `account_id` | UUID | FK → email_accounts.id |
| `thread_id` | UUID | FK → threads.id |
| `nylas_message_id` | VARCHAR(255) | Unique per account |
| `nylas_thread_id` | VARCHAR(255) | Denormalized for sync lookups |
| `subject` | TEXT | |
| `snippet` | TEXT | |
| `body_html` | TEXT | Full HTML body |
| `body_text` | TEXT | Plain text fallback |
| `from_name` | VARCHAR(255) | |
| `from_email` | VARCHAR(320) | |
| `to_list` | JSONB | `[{name, email}]` |
| `cc_list` | JSONB | |
| `bcc_list` | JSONB | |
| `reply_to` | JSONB | |
| `is_unread` | BOOLEAN | |
| `is_starred` | BOOLEAN | |
| `folder_ids` | JSONB | |
| `has_attachments` | BOOLEAN | |
| `received_at` | TIMESTAMP(tz) | From Nylas `date` field |
| `created_at` | TIMESTAMP(tz) | |
| `updated_at` | TIMESTAMP(tz) | |
| `ai_category` | VARCHAR(50) | NULL until M3 (triage agent) |
| `ai_priority` | VARCHAR(20) | NULL until M3 |
| `ai_summary` | TEXT | NULL until M3 |
| `qdrant_point_id` | UUID | NULL until M4 (embeddings) |

### Indexes
- `emails(account_id, nylas_message_id)` UNIQUE — deduplication
- `emails(account_id, received_at DESC)` — inbox sorting
- `emails(thread_id)` — thread message lookup
- `threads(account_id, last_message_at DESC)` — thread list sorting
- `threads(account_id, nylas_thread_id)` UNIQUE — deduplication

### Files to create/modify
- `backend/app/models/thread.py` — Thread ORM model
- `backend/app/models/email.py` — Email ORM model
- `backend/app/models/__init__.py` — export new models
- `backend/app/db/migrations/versions/002_add_threads_and_emails.py` — migration

---

## Phase 2: Nylas Service — Email Operations

Extend `backend/app/services/nylas_service.py` with:

### Methods to add

```
async def list_messages(grant_id, limit, page_token, received_after) -> {data, next_cursor}
async def get_message(grant_id, message_id) -> message dict
async def update_message(grant_id, message_id, {unread, starred, folders}) -> message dict
async def list_threads(grant_id, limit, page_token) -> {data, next_cursor}
async def get_thread(grant_id, thread_id) -> thread dict
async def send_message(grant_id, {to, subject, body, reply_to_message_id}) -> message dict
```

All methods use `GET/PUT/POST https://api.us.nylas.com/v3/grants/{grant_id}/...` with bearer token auth.

**Pagination**: Nylas v3 uses cursor-based pagination. Responses include `next_cursor`; pass as `page_token` in next request.

---

## Phase 3: Sync Service

New file: `backend/app/services/sync_service.py`

### Initial sync (on first connect or manual trigger)
1. Fetch threads from Nylas (last 30 days, paginate through all)
2. For each thread, fetch messages
3. Upsert threads + emails to PostgreSQL
4. Update `email_accounts.last_sync_at` and `email_accounts.sync_cursor`

### Webhook receiver
New route: `POST /api/v1/webhooks/nylas`

1. **Challenge verification**: `GET /api/v1/webhooks/nylas?challenge=...` → return challenge value
2. **Signature validation**: Verify `X-Nylas-Signature` header (HMAC-SHA256 of body with webhook secret)
3. **Handle events**:
   - `message.created` → fetch full message from Nylas → upsert email + thread
   - `message.updated` → fetch full message → update email record

Config: Add `NYLAS_WEBHOOK_SECRET` to settings.

**Webhook registration**: Done manually via Nylas Dashboard or API. The webhook URL must be publicly reachable (use ngrok/cloudflare tunnel for local dev).

### Polling fallback
New file: `backend/app/services/poll_service.py`

- Background task that runs every 5 minutes
- For each active account: fetch messages since `last_sync_at`
- Deduplicates via `nylas_message_id` unique constraint (INSERT ON CONFLICT DO UPDATE)
- Updates `last_sync_at` after successful sync

### Files to create
- `backend/app/services/sync_service.py` — upsert logic (shared by webhook + poll)
- `backend/app/services/poll_service.py` — polling background task
- `backend/app/api/routes/webhooks.py` — webhook endpoint
- `backend/app/config.py` — add `nylas_webhook_secret`

---

## Phase 4: Email + Thread API Routes

### Thread routes (`backend/app/api/routes/threads.py`)

```
GET  /api/v1/threads/                   → list threads (paginated, sorted by last_message_at)
GET  /api/v1/threads/{thread_id}        → get thread with messages
```

Query params for list: `limit` (default 25), `cursor` (UUID cursor), `folder` (filter).

### Email routes (`backend/app/api/routes/emails.py`)

```
GET   /api/v1/emails/{email_id}         → get single email (full body)
PATCH /api/v1/emails/{email_id}         → update read/star status (syncs to Nylas)
POST  /api/v1/emails/send               → send new email or reply
```

### Sync route (`backend/app/api/routes/sync.py`)

```
POST /api/v1/sync/trigger               → trigger initial sync for current user's accounts
GET  /api/v1/sync/status                → get sync status per account
```

### Schemas (`backend/app/schemas/`)
- `thread.py` — ThreadListResponse, ThreadDetailResponse
- `email.py` — EmailResponse, EmailUpdateRequest, SendEmailRequest
- `sync.py` — SyncTriggerResponse, SyncStatusResponse

---

## Phase 5: Inbox UI (Frontend)

### New pages
- `src/app/inbox/page.tsx` — main inbox view (thread list + detail panel)
- `src/app/inbox/compose/page.tsx` — compose new email (or modal)

### New components
- `src/components/thread-list.tsx` — scrollable thread list with unread indicators
- `src/components/thread-item.tsx` — single thread row (subject, snippet, date, participants)
- `src/components/email-detail.tsx` — email message view (HTML body rendered safely)
- `src/components/email-header.tsx` — from/to/cc/date display
- `src/components/compose-modal.tsx` — compose/reply form (to, subject, body, send button)
- `src/components/inbox-layout.tsx` — split-pane layout (list left, detail right)

### API client additions (`src/lib/api-client.ts`)
```
listThreads(cursor?) → {threads, next_cursor}
getThread(threadId) → {thread, messages}
getEmail(emailId) → email
updateEmail(emailId, {unread, starred}) → email
sendEmail({to, subject, body, reply_to_message_id}) → email
triggerSync() → status
```

### Key UX decisions
- Thread list is the primary view (like Gmail), not individual messages
- Clicking a thread opens it in the right panel (desktop) or navigates to it (mobile)
- Compose can be a modal or slide-over panel
- Mark as read automatically when opening a thread
- Optimistic UI updates for read/star toggles

### Navigation update
- Update dashboard to redirect to `/inbox` (or merge dashboard into inbox)
- Add sidebar/nav with: Inbox, (future: Chat, Actions, Settings)

---

## Phase 6: Background Polling Setup

### FastAPI lifespan
Add background polling task to `backend/app/main.py` lifespan:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(poll_all_accounts_loop())
    yield
    task.cancel()
```

The polling loop iterates active accounts every 5 minutes, calling the sync service for each.

---

## Implementation Order

1. **Models + migration** — threads and emails tables
2. **Nylas service methods** — list/get/send messages and threads
3. **Sync service** — upsert logic for messages and threads
4. **Sync trigger API** — manual trigger for initial sync
5. **Thread + email API routes** — CRUD endpoints
6. **Polling background task** — automatic sync every 5 min
7. **Webhook receiver** — real-time sync (requires public URL)
8. **Frontend inbox UI** — thread list, detail panel, compose
9. **Navigation update** — sidebar, redirect from dashboard

## Verification

- Sign in → trigger sync → threads appear in inbox within seconds
- Click thread → see all messages with full HTML body
- Star/unstar a message → reflected in Gmail
- Send a reply → appears in Gmail sent folder
- New email arrives in Gmail → appears in inbox via poll (or webhook if configured)


  M2 — Likely remaining items

  1. Folder filtering — activeFolder state exists but doesn't filter threads yet (inbox/sent/drafts/starred)
  2. Search — no email search endpoint or UI
  3. Mark as read/unread — updateEmail exists but doesn't sync back to Nylas (only updates local DB)
  4. Star/unstar — handleStar updates UI state only, doesn't persist to DB or Nylas
  5. Pagination — listThreads currently returns all threads, no cursor/offset
  6. Send/reply — no compose or reply functionality yet (likely M2 or M3)