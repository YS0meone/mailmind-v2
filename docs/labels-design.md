# Labels Design

## Overview

Local-only labels for organizing emails. Labels are stored in PostgreSQL and never synced to Nylas/Gmail, keeping things fast and free of API overhead. Designed for a future triage agent that auto-labels on webhook ingestion.

## Preset Labels

| Name | Color | Description |
|------|-------|-------------|
| Work | blue | Work-related emails, meetings, projects |
| Shopping | green | Orders, receipts, shipping notifications |
| News | purple | Newsletters, news digests, subscriptions |
| Finance | amber | Banking, bills, payments, investments |

Presets are seeded when an email account is first created. Users can rename, recolor, or delete them.

## Tiered Classification Architecture

### Tier 1: Rule-Based Matching (fast, free)

Each label has an optional `rules` JSONB column for structured matching:

```json
{
  "conditions": [
    { "field": "from_email", "op": "contains", "value": "@company.com" },
    { "field": "subject", "op": "matches", "value": "invoice|receipt|payment" }
  ],
  "match": "any"
}
```

Fields: `from_email`, `from_name`, `subject`, `snippet`, `to_email`
Operators: `contains`, `equals`, `matches` (regex), `starts_with`, `ends_with`
Match mode: `all` (AND) or `any` (OR)

Rules are evaluated on webhook ingestion before any AI call. If rules match, the label is applied immediately.

### Tier 2: AI Classification (fallback)

When no rules match, the triage agent classifies the email using the label descriptions as context. The agent can also suggest new rules based on patterns it observes, which get stored in the `rules` JSONB for future fast matching.

### AI-Generated Rules

The triage agent can propose rules after classifying emails:
1. Classify email with AI (Tier 2)
2. Observe patterns (e.g., "all emails from orders@amazon.com get Shopping")
3. Propose a rule: `{ "field": "from_email", "op": "contains", "value": "orders@amazon.com" }`
4. Next time, Tier 1 catches it without an AI call

This creates a feedback loop where AI usage decreases over time as rules accumulate.

## Data Model

### `labels` table
- `id` UUID PK
- `account_id` UUID FK -> email_accounts
- `name` String(100) NOT NULL
- `color` String(30) NOT NULL
- `description` Text (nullable, used as AI context)
- `rules` JSONB (nullable, for rule engine)
- `is_preset` Boolean (default false)
- `position` Integer (display ordering)
- Unique: `(account_id, name)`

### `thread_labels` junction table
- `thread_id` UUID FK -> threads
- `label_id` UUID FK -> labels
- Composite PK: `(thread_id, label_id)`
