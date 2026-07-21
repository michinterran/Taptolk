# Kakao AlimTalk Ephemeral Contact - Design Document

> Version: 1.0.0 | Date: 2026-07-21 | Status: Approved for Do
> Level: Dynamic | Plan: `docs/01-plan/features/kakao-alimtalk-ephemeral-contact.plan.md`

---

## 1. Overview

### 1.1 Purpose

Move owner notification from an SMS-specific contract to a typed Kakao AlimTalk intent and add a
transactional terminal lifecycle for the caller’s temporary Taptolk Contact Session.

### 1.2 Design Goals

- Preserve `UI -> Route Handler -> Application Service -> Repository/RPC -> PostgreSQL`.
- Treat AlimTalk as a wake-up notification, never as the A–B conversation or authority boundary.
- Keep free-text caller content out of the provider template variables.
- Revoke transient access and redact content at resolution or expiry without deleting minimum
  audit, status, and aggregate history.

## 2. Architecture

### 2.1 Notification Flow

```text
Caller request
  -> create_public_contact_session
      -> contact_session + caller message
      -> KAKAO_ALIMTALK delivery intent
  -> NotificationDispatchService
      -> typed OWNER_CONTACT_REQUEST_V1 payload
      -> OwnerNotificationProvider
          -> staging simulator, or
          -> unavailable fail-closed adapter
  -> one-time Taptolk response URL
  -> Owner reply inside Taptolk
```

The future live adapter maps `OWNER_CONTACT_REQUEST_V1` to the approved Kakao template ID. That
mapping, channel profile, partner-specific credentials, and message approval are external launch
inputs and are not represented by invented source defaults.

### 2.2 Typed Provider Contract

```ts
interface OwnerContactNotification {
  templateKey: "OWNER_CONTACT_REQUEST_V1";
  locale: "ko" | "en";
  variables: {
    reasonCode: ContactReasonCode;
    responseUrl: string;
  };
}
```

The dispatch claim may resolve encrypted destination data on the server. Provider implementations
receive destination ciphertext, a stable idempotency key, and the typed notification. They do not
receive the caller’s free-text message, a raw audit payload, or browser-controlled role metadata.

### 2.3 Resolution Flow

```text
Caller selects complete
  -> POST /api/public/contact-sessions/current/resolve
  -> PublicContactService.resolve
  -> resolve_public_contact_session RPC
      lock session and active caller participant
      validate session hash + anonymous hash
      mark RESOLVED and resolved_at
      redact every session message body
      revoke every active response token
      cancel QUEUED/RETRY_WAIT delivery intents
      mark active participants left
      append redacted audit row
  -> clear caller/session cookies
  -> localized completed state
```

The operation is idempotent for an already resolved matching session. Any other terminal or missing
session is unavailable. Once participant rows are marked left, the existing read and response paths
cannot reopen the session.

### 2.4 Expiry Flow

`run_privacy_cleanup` first identifies sessions whose TTL elapsed, marks them `EXPIRED`, then in the
same transaction redacts their messages, revokes all active response tokens, cancels queued/retry
deliveries, and marks participants left. The existing time-based redaction remains as a fallback for
nonterminal legacy content.

## 3. Data Model

### 3.1 Notification Channel

- Add `KAKAO_ALIMTALK` to `notification_channel` in a standalone migration.
- Keep `SMS` and `WEB_PUSH` enum values so historical rows remain readable.
- Replace `create_public_contact_session` in the next migration so all new owner-contact intents use
  `KAKAO_ALIMTALK`.

### 3.2 Preserved and Removed Data

Preserved after terminal transition:

- session UUID, tenant/site/QR/vehicle foreign keys;
- reason code, terminal status, created/updated/resolved/expiry timestamps;
- delivery outcome metadata, redacted audit event, and aggregate metrics;
- Owner, Vehicle, QR binding, and management-company data needed for future scans.

Revoked or redacted after terminal transition:

- caller and Owner message bodies (`[REDACTED]`);
- response-token authority (`revoked_at`);
- participant authority (`left_at`);
- undelivered notification attempts (`CANCELLED`).

Opaque HMAC hashes remain only where existing append-only rate/audit/history constraints require
them; no raw token is stored.

## 4. API Specification

### 4.1 Resolve Current Caller Session

`POST /api/public/contact-sessions/current/resolve`

- Reads the existing httpOnly caller/session cookies only.
- Has no request-body authority.
- Returns `200 { data: { status: "RESOLVED" } }` after a successful or idempotent transaction.
- Clears both cookies with the same secure/same-site attributes.
- Returns `401` when cookies are absent, `409` for a non-resolvable terminal conflict, and `503` for
  unavailable server configuration.
- Returns and logs no message, destination, token, QR token, or provider payload.

### 4.2 Provider Configuration

- `OWNER_NOTIFICATION_PROVIDER`: `mock` or `kakao-alimtalk`, default `mock` outside Production.
- Production rejects `mock`.
- `kakao-alimtalk` selects only the unavailable fail-closed adapter until an approved provider
  implementation and its contract-specific configuration are added.
- Owner activation verification remains separately staged; this change does not claim an approved
  Production OTP or identity-verification provider.

## 5. Implementation Plan

### 5.1 Main Files

```text
packages/domain/src/notification-reply-policy.ts
packages/application/src/notification-reply-service.ts
packages/application/src/public-contact-service.ts
packages/config/src/env.server.ts
packages/db/src/schema/tenant-admin.ts
apps/web/notification-reply/*
apps/web/public-contact/supabase-public-contact-repository.ts
apps/web/app/api/public/contact-sessions/current/resolve/route.ts
apps/web/components/contact-waiting-room.tsx
apps/web/content/public-contact-copy.ts
supabase/migrations/*_kakao_alimtalk_*.sql
supabase/tests/database/kakao_alimtalk_ephemeral_contact.sql
```

### 5.2 Implementation Order

1. Rename the domain/application/provider interfaces and add the typed template payload.
2. Add channel migration, terminal RPCs, schema enum, and pgTAP.
3. Add service/repository/route resolution and cookie clearing.
4. Add typed KO/EN UI states, then immediately run `pnpm validate:wcj`.
5. Update the master specification and operational readiness documents.
6. Prove with focused unit tests, clean local reset/pgTAP, authenticated staging E2E, and full verify.

## 6. Test Plan

### 6.1 Unit and Web Tests

- Dispatch passes a typed template and never passes `messageBody`.
- Staging simulator extracts the response token only from the typed response URL and remains
  unavailable in Production.
- Provider errors retain bounded retry/final behavior with provider-neutral names.
- Resolve hashes both opaque secrets, invokes the repository once, and rejects invalid secrets.
- Resolve route returns no protected content and clears both cookies only after success.
- Waiting room exposes localized complete/working/error copy and disables duplicate submission.

### 6.2 pgTAP and E2E

- Enum includes `KAKAO_ALIMTALK`; new sessions enqueue exactly that channel.
- RPC execute remains service-role-only and browser tables retain forced RLS.
- A matching caller can resolve once/idempotently; a different caller cannot resolve it.
- Resolution redacts all messages, revokes response tokens, cancels pending deliveries, marks
  participants left, and writes a redacted audit row.
- Expiry cleanup performs the same transient-data cleanup and keeps terminal rows.
- Authenticated staging proves caller create -> mock AlimTalk inbox -> Owner reply -> caller read ->
  caller resolve -> read/reply forbidden.

## 7. Security and Privacy

- Provider selection is server-only; no `NEXT_PUBLIC_` value is introduced.
- Template variables exclude caller free text, phone, plate, QR public token, activation code, OTP,
  and raw response token outside its one-time HTTPS URL.
- Logs and audit rows contain only bounded codes, IDs, and state transitions.
- The database transaction—not browser state—authorizes and performs terminal cleanup.
- Existing central RBAC, tenant constraints, RLS, service-role RPC grants, and MFA boundaries remain
  unchanged.
- Production Cron stays inactive and no external provider side effect occurs in this change.
