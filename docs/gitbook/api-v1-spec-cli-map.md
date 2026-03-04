# Governance.so API v1 + CLI Command Map (Draft)

## Scope

This draft defines:

- a public, versioned REST API at `/api/v1`
- a CLI (`govso`) that is a thin wrapper over the API
- a migration path from current ad hoc API routes

The API is read-first for v1, with optional write/admin routes for notifications and automation.

---

## Design Goals

- Stable contract for UI, CLI, partners, and automations.
- Cursor pagination for all list endpoints.
- Predictable filtering/sorting across resources.
- Explicit cluster/program scoping (`mainnet`, `devnet`, custom).
- Backward-compatible migration from existing endpoints.

---

## Base URL and Versioning

- Production: `https://governance.so/api/v1`
- Dev: `https://<host>/api/v1`
- Versioning: URL path version (`/v1`).

Breaking changes require `/v2`.

---

## Auth Model

### Public read endpoints

- No auth required for standard reads.
- Higher rate limits available with API key.

### Authenticated endpoints

- `Authorization: Bearer <token>`
- Token types:
  - API key token (server-to-server)
  - wallet session token (signed challenge)

### Admin endpoints

- Require `scope=admin:notifications` or equivalent server secret.

### Strict runtime controls (implemented)

`/api/v1` is now protected by strict guardrails:

- `API_V1_STRICT=true` (default) requires auth for all v1 routes.
- `API_V1_KEYS` or `GOVSO_API_KEYS`: comma-separated read tokens.
- `API_V1_ADMIN_KEYS` or `GOVSO_ADMIN_KEYS`: comma-separated admin tokens.
- `API_V1_ALLOWED_ORIGINS` (optional): comma-separated origin allowlist (supports `*` wildcards).
- `API_V1_IP_ALLOWLIST` (optional): comma-separated IP allowlist (supports `*` wildcards).
- `API_V1_READ_RPM` (default `20`) and `API_V1_ADMIN_RPM` (default `5`) enforce strict per-minute limits.

---

## Common Request Conventions

### Headers

- `Accept: application/json`
- `Content-Type: application/json` (for `POST`/`PUT`/`PATCH`)
- `X-Request-Id: <uuid>` (optional)
- `X-Cluster: mainnet|devnet` (optional; fallback to default cluster)

### Pagination

All list endpoints support:

- `limit` (default `25`, max `200`)
- `cursor` (opaque string)

Response envelope:

```json
{
  "data": [],
  "page": {
    "next_cursor": "opaque_cursor_or_null",
    "has_more": true
  }
}
```

### Sorting

- `sort_by=<field>`
- `sort_order=asc|desc`

### Error schema

```json
{
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "realm is required",
    "details": {
      "field": "realm"
    },
    "request_id": "req_123"
  }
}
```

### Standard error codes

- `INVALID_ARGUMENT` (`400`)
- `UNAUTHORIZED` (`401`)
- `FORBIDDEN` (`403`)
- `NOT_FOUND` (`404`)
- `CONFLICT` (`409`)
- `RATE_LIMITED` (`429`)
- `INTERNAL` (`500`)

---

## Core Resource Shapes

### Realm

```json
{
  "id": "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip",
  "name": "Example DAO",
  "program_id": "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw",
  "cluster": "mainnet",
  "verified": true,
  "proposal_count": 182,
  "member_count": 1240,
  "active_proposals": 2,
  "treasury_value_usd": 1240500.42
}
```

### Proposal

```json
{
  "id": "8yYqWqyDeLFNyLzwyoxvxPvnpYQ9GfSFtMz6aBnNp3eA",
  "realm_id": "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip",
  "governance_id": "9n7...",
  "name": "Upgrade treasury policy",
  "state": "Voting",
  "draft_at": 1738512000,
  "voting_at": 1738598400,
  "voting_ends_at": 1739203200,
  "yes_votes": 4500000,
  "no_votes": 1200000,
  "abstain_votes": 100000
}
```

### Vote

```json
{
  "proposal_id": "8yYqW...",
  "voter": "7oL...",
  "side": "yes",
  "weight": 12500.5,
  "mint": "community",
  "cast_at": 1738601000
}
```

---

## Endpoint Spec (v1)

## Health and metadata

### `GET /health`

Returns service health and dependency status.

### `GET /meta`

Returns API version, default cluster, supported programs, and rate-limit policy summary.

## Realms

### `GET /realms`

List DAOs/realms.

Query params:

- `search` (name/address)
- `verified` (`true|false`)
- `active_voting` (`true|false`)
- `min_proposals` (int)
- `cluster`
- `program_id`
- `limit`, `cursor`, `sort_by`, `sort_order`

### `GET /realms/{realm_id}`

Get a single realm.

### `GET /realms/{realm_id}/stats`

Aggregated metrics used by directory/stats screens.

### `GET /realms/{realm_id}/members`

Member list and participation metrics.

Query params:

- `mint` (`community|council|all`)
- `min_voting_power`
- `include_inactive` (`true|false`)
- `limit`, `cursor`, `sort_by`, `sort_order`

### `GET /realms/{realm_id}/treasury`

Realm treasury summary with wallet aggregates.

### `GET /realms/{realm_id}/wallets`

Treasury wallets under a realm.

### `GET /realms/{realm_id}/proposals`

Proposals scoped to one realm.

Query params:

- `state` (`Draft|Voting|Succeeded|Defeated|Cancelled|Vetoed`)
- `author`
- `with_instructions` (`true|false`)
- `from_ts`, `to_ts`
- `limit`, `cursor`, `sort_by`, `sort_order`

### `GET /realms/{realm_id}/participants`

Replacement for current route `/api/:handlekey/:querytype/:queryvar1/:queryvar2/:queryvar3`.

Query params:

- `mode` (`latest|days`)
- `proposal_count` (for `mode=latest`)
- `days` (for `mode=days`, default `60`)
- `min_vote_weight`
- `min_staked_weight`
- `format` (`json|csv`)

Response (`json`):

```json
{
  "data": {
    "realm_id": "By2sV...",
    "participants": ["wallet1", "wallet2"]
  }
}
```

Response (`csv`): `wallet1,wallet2,...`

## Proposals

### `GET /proposals/{proposal_id}`

Get one proposal with summary and metadata.

### `GET /proposals/{proposal_id}/instructions`

Proposal instruction list for execution UIs.

### `GET /proposals/{proposal_id}/votes`

Vote records for proposal.

Query params:

- `side` (`yes|no|abstain|veto`)
- `min_weight`
- `limit`, `cursor`

### `GET /proposals/{proposal_id}/events`

Proposal timeline events (`created`, `voting_started`, `vote_cast`, `executed`, etc.).

## Events and realtime

### `GET /events/proposals`

Global or realm-scoped proposal feed for realtime screens.

Query params:

- `realm_id` (optional)
- `event_type` (`created|voting_started|state_changed`)
- `from_ts`, `to_ts`
- `limit`, `cursor`

### `GET /events/proposals/stream`

Server-Sent Events endpoint for realtime consumers.

## Notifications

### `POST /notifications/subscriptions`

Register or update an FCM/web push token.

Body:

```json
{
  "realm_id": "By2sV...",
  "token": "<fcm_token>",
  "enabled": true
}
```

### `DELETE /notifications/subscriptions`

Disable a token for a realm.

Body:

```json
{
  "realm_id": "By2sV...",
  "token": "<fcm_token>"
}
```

### `POST /notifications/scan` (admin)

Scan realms, detect proposal events, dispatch notifications.

Body:

```json
{
  "realm_ids": ["By2sV..."],
  "dry_run": false
}
```

### `POST /notifications/test` (admin)

Send a test notification to one registered token.

Body:

```json
{
  "realm_id": "By2sV...",
  "token": "<fcm_token>",
  "title": "Push Test",
  "body": "If you can read this, notifications work."
}
```

---

## Compatibility Mapping (Current -> v1)

| Current route | v1 route |
|---|---|
| `POST /api/notifications-register` | `POST /api/v1/notifications/subscriptions` |
| `GET/POST /api/notifications-scan` | `POST /api/v1/notifications/scan` |
| `POST /api/notifications-test` | `POST /api/v1/notifications/test` |
| `GET /api/:handlekey/:querytype/:queryvar1/:queryvar2/:queryvar3` | `GET /api/v1/realms/{realm_id}/participants` |

Deprecation policy:

- Keep current endpoints for one release cycle.
- Return `Deprecation` and `Link` headers pointing to v1 docs.
- Remove old routes in next major UI/API release.

---

## Rate Limits (Draft)

- Anonymous: `60 req/min`
- API key: `300 req/min`
- Admin routes: `30 req/min`

Headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## CLI Command Map (`govso`)

CLI principle: every command maps to exactly one v1 endpoint where possible.

Global flags:

- `--base-url <url>` (default `https://governance.so/api/v1`)
- `--api-key <key>`
- `--cluster <mainnet|devnet>`
- `--output <table|json|csv>` (default `table`)
- `--verbose`

## Command groups

### `govso health`

- `govso health` -> `GET /health`
- `govso meta` -> `GET /meta`

### `govso realms`

- `govso realms list [--search --verified --active-voting --min-proposals --limit --cursor]`
  - `GET /realms`
- `govso realms get <realm_id>`
  - `GET /realms/{realm_id}`
- `govso realms stats <realm_id>`
  - `GET /realms/{realm_id}/stats`
- `govso realms members <realm_id> [--mint --min-voting-power --limit --cursor]`
  - `GET /realms/{realm_id}/members`
- `govso realms treasury <realm_id>`
  - `GET /realms/{realm_id}/treasury`
- `govso realms wallets <realm_id> [--limit --cursor]`
  - `GET /realms/{realm_id}/wallets`
- `govso realms participants <realm_id> [--mode latest|days --proposal-count --days --min-vote-weight --min-staked-weight --output json|csv]`
  - `GET /realms/{realm_id}/participants`

### `govso proposals`

- `govso proposals list --realm <realm_id> [--state --author --from-ts --to-ts --limit --cursor]`
  - `GET /realms/{realm_id}/proposals`
- `govso proposals get <proposal_id>`
  - `GET /proposals/{proposal_id}`
- `govso proposals instructions <proposal_id>`
  - `GET /proposals/{proposal_id}/instructions`
- `govso proposals votes <proposal_id> [--side --min-weight --limit --cursor]`
  - `GET /proposals/{proposal_id}/votes`
- `govso proposals events <proposal_id> [--limit --cursor]`
  - `GET /proposals/{proposal_id}/events`

### `govso events`

- `govso events list [--realm-id --event-type --from-ts --to-ts --limit --cursor]`
  - `GET /events/proposals`
- `govso events tail [--realm-id --event-type]`
  - `GET /events/proposals/stream`

### `govso notifications`

- `govso notifications subscribe --realm-id <realm_id> --token <token> [--disable]`
  - `POST /notifications/subscriptions`
- `govso notifications unsubscribe --realm-id <realm_id> --token <token>`
  - `DELETE /notifications/subscriptions`
- `govso notifications scan [--realm-id <realm_id> ...] [--dry-run]` (admin)
  - `POST /notifications/scan`
- `govso notifications test --realm-id <realm_id> --token <token> [--title --body]` (admin)
  - `POST /notifications/test`

---

## Suggested v1 Milestones

1. Ship read endpoints: `health/meta/realms/proposals/members/treasury/events`.
2. Add participants endpoint and migrate current `/api/:...` route.
3. Move notification routes behind `/api/v1/notifications/*`.
4. Release `govso` CLI read-only.
5. Add auth scopes and admin-grade automation commands.
