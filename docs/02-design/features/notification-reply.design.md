# notification-reply - Design Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Implementation
> Level: Dynamic | Plan: `docs/01-plan/features/notification-reply.plan.md`

## 1. Architecture

```text
Internal Notification Worker
  → claim_notification_deliveries()
  → NotificationReplyWorkerService
  → SmsProvider.send(stable idempotency key)
  → record_notification_sent() / record_notification_failure()

Owner SMS URL /{locale}/respond/{rawToken}
  → same-origin Route Handler
  → NotificationReplyService
  → inspect/reply service-only RPC
  → Contact Message + status + revoke + audit

Caller Waiting Room
  → existing HttpOnly caller cookies
  → read_public_contact_session()
  → owner reply DTO
```

## 2. Domain Contract

- Provider errors: `AUTH_ERROR`, `INVALID_RECIPIENT`, `PERMANENT_FAILURE` are final;
  `RATE_LIMIT`, `TEMPORARY_FAILURE`, `UNKNOWN` are retryable.
- Retry policy: 30s, 120s, 300s capped; maximum three attempts.
- Response Token: 32 random bytes, CONTACT_REPLY scope, 60-minute TTL, hash-only persistence,
  one active token per Contact Session.
- Reply codes: `MOVING_NOW`, `MOVE_IN_3_MINUTES`, `MOVE_IN_5_MINUTES`,
  `MOVE_IN_10_MINUTES`, `CANNOT_MOVE_NOW`, `CONTACT_SITE_OFFICE`, `CUSTOM`.
- `CUSTOM` reuses the public message normalization/filter policy and 200-character maximum.

## 3. Data Model

### `response_tokens`

- tenant/session/delivery exact scope
- `token_hash` unique; no raw token
- scope, expires/revoked/used timestamps
- one active CONTACT_REPLY token per open session

### `notification_deliveries` additions

- lease owner/version/expiry
- first/last attempted timestamps and next scheduled time
- provider receipt hash plus existing provider message ID
- final/archived timestamp
- retry count and safe error code only

Provider destination continues to be resolved from Owner encrypted phone inside the server
repository/provider boundary. Caller-visible DTOs never include delivery/token/provider fields.

## 4. Atomic Commands

### `claim_notification_deliveries(limit, lease_seconds, worker_id)`

Uses `FOR UPDATE SKIP LOCKED`. Eligible rows are due `QUEUED`/`FAILED_RETRYABLE` and expired
`PROCESSING`. It locks session/Owner, creates or reuses one token hash from Worker-supplied random
material, increments lease version, and returns a minimal claim plus encrypted destination only to
service role.

### `record_notification_sent`

Requires active lease owner/version. It records the provider receipt once, transitions delivery to
`SENT`, session to `OWNER_NOTIFIED`, and writes a redacted audit in one transaction. Replayed
acknowledgement with the same receipt is idempotent.

### `record_notification_failure`

Requires active lease. Retryable errors schedule the Domain-computed next attempt. Final errors or
max attempts set `FAILED_FINAL`, archive the delivery, transition the session to
`NOTIFICATION_FAILED`, revoke active tokens, and audit without provider text.

### `inspect_owner_response` / `submit_owner_response`

Both validate token hash, scope, expiry, revoke state, and open session. Inspect returns reason,
caller message, vehicle last4, site display, and expiry only. Submit locks token/session, validates
reply count/code/body, appends one Owner message, sets `OWNER_REPLIED`, consumes/revokes token, and
audits atomically.

## 5. HTTP/UI

- `POST /api/internal/notification-dispatch`: server-secret authenticated, bounded claim loop.
- `POST /api/public/owner-response/inspect`: no-store, uniform token error.
- `POST /api/public/owner-response/reply`: same-origin, no-store.
- `GET /ko|en/respond/{responseToken}`: KO/EN quick reply UI.
- Existing `/ko|en/c/current` renders Owner replies from its cookie-scoped DTO.

Staging provider records only hash/idempotency evidence in memory/DB fixture controls. Production
without an approved provider is fail-closed.

## 6. Verification

- Unit: classification, retry timing, reply codes/custom moderation, Worker idempotency outcomes.
- pgTAP: RLS/grants/FKs, one active token, lease recovery, sent/failure/reply transactions,
  expiry/revoke denial.
- Staging E2E: one transient failure then success, concurrent dispatch duplicate zero, Owner KO
  reply reflected to caller, expired token denial, cleanup residue zero.
- WCJ: semantic KO/EN headings, keyboard, axe, responsive widths.

## 7. Phase Gate

Phase 8 cannot start until duplicate SMS zero, bounded retry success, expired-lease recovery,
caller-visible Owner reply, token expiry/revoke denial, full linked pgTAP, staging E2E, WCJ, and
`pnpm verify` pass.
