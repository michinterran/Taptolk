# Gap Analysis: Notification and Reply

> Date: 2026-07-20
> Design: `docs/02-design/features/notification-reply.design.md`

## Match Rate: 96%

Phase 7 acceptance is implemented. The Worker consumes Phase 6 intents with `SKIP LOCKED` leases,
bounded retry/final failure, stable idempotency, hash-only 60-minute Response Tokens, KO/EN Owner
reply, and caller polling reflection.

## Verified implementation

- transient provider failure → `FAILED_RETRYABLE` → due retry → one `SENT` receipt
- expired `PROCESSING` lease reclaimed without duplicate active token or SMS
- one active CONTACT_REPLY token per session; expired/revoked token denied
- Owner quick/custom reply transaction appends Message, sets `OWNER_REPLIED`, consumes token, audits
- caller cookie-only polling renders the reply without Owner identity or destination
- staging provider decrypts destination only inside the provider boundary and stores no phone
- production without an approved provider remains fail-closed
- Phase 7 linked pgTAP 35/35, staging feature E2E 3/3, WCJ 100, `pnpm verify` PASS

## Approved deviations

- Owner locale is not yet persisted, so the SMS response URL defaults to KO while the response page
  itself supports both KO/EN. Persisted Owner locale belongs in a later account-preference change.
- Optional caller SMS was not activated because no explicit caller consent/destination collection
  UI exists. The master specification marks it optional; Phase 7 core acceptance is unaffected.
- The staging inbox is an internal, Worker-secret-protected, non-production in-memory adapter used
  only to prove token navigation and idempotency. Production rejects mock mode.

## Recommendation

Close Phase 7 and implement Phase 8's durable abuse event, 60/180-second state evaluation,
management-office action, CAPTCHA hook, report/block workflow, scoped Admin queue, and audit.
