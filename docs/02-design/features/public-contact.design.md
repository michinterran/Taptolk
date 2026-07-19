# public-contact - Design Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Implementation
> Level: Dynamic | Plan: `docs/01-plan/features/public-contact.plan.md`

## 1. Architecture

```text
KO/EN Public QR UI
  → same-origin Route Handler
  → PublicContactService
  → ContactReason / Message / Rate / Polling Domain Policy
  → SupabasePublicContactRepository
  → service-only PostgreSQL RPC transaction

Waiting Room
  → HttpOnly session + anonymous cookies
  → no-store session read RPC
  → 3s/5s/10s/background polling policy
```

The browser never imports the server environment, Supabase service client, HMAC key, owner table,
notification destination, or raw audit data.

## 2. Domain Contract

### 2.1 Reason and message

Approved reasons:

```text
MOVE_REQUEST
EXIT_BLOCKED
DOUBLE_PARKED
VEHICLE_NOT_MOVING
LIGHT_ON
WINDOW_OPEN
VEHICLE_DAMAGE
ACCIDENT_CONTACT
OTHER
```

`TEMPLATE` accepts only the locale dictionary body mapped to its reason. `FREE_TEXT` is normalized
to Unicode NFC, trims outer whitespace, collapses excessive blank space, and accepts 1–200
characters. It rejects URL schemes/domains, email, Korean/international phone patterns, repeated
identical input, and the bounded threat/profanity patterns owned by Domain policy.

### 2.2 Public state

Phase 6 exposes:

```ts
type PublicContactStatus =
  | "NOTIFICATION_QUEUED"
  | "NOTIFICATION_FAILED"
  | "OWNER_NOTIFIED"
  | "OWNER_VIEWED"
  | "OWNER_REPLIED"
  | "CALLER_VIEWED"
  | "RESOLVED"
  | "ESCALATED"
  | "EXPIRED"
  | "BLOCKED"
  | "CANCELLED";
```

Phase 6 creates `NOTIFICATION_QUEUED`. Later statuses are read-compatible for Phase 7–8 without
claiming a provider delivery before it exists.

### 2.3 Polling

- under 2 minutes: 3 seconds
- 2–5 minutes: 5 seconds
- over 5 minutes: 10 seconds
- background tab: 15 seconds
- visibility resume: immediate
- network failure: bounded exponential backoff
- terminal state: stop

## 3. Data Model

### 3.1 `contact_sessions`

- tenant/site/QR/Vehicle exact scope with composite foreign keys
- `caller_anonymous_hash`, reason, status, caller/owner message counts
- notification/view/reply/escalation/resolution timestamps
- `expires_at`, blocked reason, version, timestamps
- one stable `public_id` for redacted response; no raw token

### 3.2 `session_participants`

- exact session/tenant scope
- `CALLER/OWNER/ADMIN`
- Caller has `anonymous_token_hash`; Owner has `owner_id`
- check ensures only the identity field for the participant type is present
- one active Caller participant per session

### 3.3 `messages`

- exact session/tenant scope
- sender type, optional Owner actor
- `TEMPLATE/FREE_TEXT/SYSTEM`, reason, body, moderation status
- body is application content, never log/audit metadata
- immutable rows; caller count limit is enforced under session lock

### 3.4 `notification_deliveries`

Phase 6 creates one `OWNER_CONTACT` `SMS` intent with:

- tenant/site/session/Owner scope
- destination hash only; provider destination ciphertext is resolved from Owner data in Phase 7
- unique idempotency key derived from Session and purpose
- `QUEUED`, retry 0, configured max retries, scheduled timestamp

No provider call occurs in Phase 6.

### 3.5 `public_contact_attempts`

Service-only append ledger:

- QR, anonymous, network, user-agent purpose hashes
- created timestamp and merged/session-created result
- indexes for anonymous+QR, anonymous-global, IP+QR, and QR-global windows

No raw IP, User-Agent, token, or message is stored.

## 4. Database Commands

### 4.1 `inspect_public_contact(text)`

Input: `public_token_hash`.

Locks nothing and returns only:

```ts
{
  qrStatus: "ACTIVE";
  vehicle: {
    plateLast4: string;
    color: string | null;
    type: string | null;
  };
  contactEnabled: true;
  siteDisplayName: string;
}
```

It requires ACTIVE QR, active primary Binding, active Vehicle, active vehicle-owner relationship,
active Owner, and active Site/contract. All unavailable states return one public category.

### 4.2 `create_public_contact_session(jsonb)`

Lock order:

1. transaction advisory lock on anonymous+QR+reason
2. QR Asset by public token hash
3. active Binding and Vehicle
4. active vehicle-owner relationship and Owner
5. existing matching open Contact Session

Validation:

- fixed policy values from application configuration
- last4 confirmation
- reason/message mode/body hash and normalized body
- anonymous/network/user-agent/session token hashes
- same anonymous+QR 3-minute, anonymous global 10-minute, IP+QR 10-minute, QR global 1-minute limits

If a same anonymous/QR/reason open Session exists within 3 minutes, the command records one
merged attempt and returns its public Session DTO without inserting Message or notification.

Otherwise the same transaction inserts:

- Contact Session with `NOTIFICATION_QUEUED`
- Caller participant with anonymous hash
- first caller Message
- one notification delivery intent with unique idempotency key
- redacted audit row with status/reason/resource IDs only
- one attempt ledger row

### 4.3 `read_public_contact_session(text,text)`

Inputs are `session_token_hash` and `anonymous_token_hash`. Both must match the active Caller
participant/session. Returns only:

```ts
{
  status: PublicContactStatus;
  reasonCode: ContactReason;
  callerMessageCount: number;
  ownerMessages: Array<{
    replyCode: string | null;
    body: string;
    createdAt: string;
  }>;
  expiresAt: string;
  version: number;
}
```

No Owner ID, destination, phone hash, tenant/site internal ID, or full vehicle data is returned.

### 4.4 Staging fixture and cleanup

Provisioning accepts only a bounded `PC-*` label and creates one ACTIVE QR with Owner/Vehicle/
Binding and no raw public or session token. Cleanup accepts the exact public-token hash and E2E
tenant, disables only immutable-history triggers inside the service transaction, deletes dependent
acceptance rows in FK order, and verifies zero contact/owner/QR/Auth residue.

## 5. HTTP and Cookie Contract

Routes:

```text
GET  /{locale}/q/{publicToken}
GET  /{locale}/c/{sessionToken}
POST /api/public/qr/inspect
POST /api/public/contact-sessions
GET  /api/public/contact-sessions/current
```

Every response is JSON/no-store/no-referrer with a request ID. Mutation requires same-origin.
Public errors are uniform and never include database/provider details.

Cookies:

```text
tt_caller_anon
  HttpOnly, Secure on HTTPS, SameSite=Lax, Path=/, MaxAge=30 days

tt_contact_session
  HttpOnly, Secure on HTTPS, SameSite=Lax, Path=/, MaxAge=session TTL
```

The session token may appear in the canonical waiting-room path for initial navigation, but Route
Handlers never log it and the browser immediately relies on cookies for polling/recovery.

## 6. UI Journey

`/{locale}/q/{publicToken}`:

1. inspect/loading
2. vehicle last4 confirmation
3. reason selection
4. template or limited free text
5. confirmation
6. submitting
7. truthful notification preparing result
8. redirect to waiting room

`/{locale}/c/{sessionToken}`:

- waiting status
- owner reply list when Phase 7 writes one
- reconnect/retry state
- expired/blocked/cancelled/resolved terminal state

No signup banner, app menu, Owner identity, phone, full plate, or false provider-sent copy.

## 7. Module Ownership

```text
packages/domain/src/public-contact-policy.ts
packages/application/src/public-contact-service.ts
packages/db/src/schema/tenant-admin.ts
apps/web/public-contact/public-contact-crypto.ts
apps/web/public-contact/supabase-public-contact-repository.ts
apps/web/public-contact/public-contact-runtime.ts
apps/web/app/api/public/*
apps/web/app/[locale]/q/[publicToken]/*
apps/web/app/[locale]/c/[sessionToken]/*
apps/web/components/public-contact-view.tsx
apps/web/components/contact-waiting-room.tsx
apps/web/content/public-contact-copy.ts
supabase/migrations/*_phase_6_public_contact.sql
supabase/tests/database/phase_6_public_contact.sql
e2e/staging/public-contact.spec.ts
```

## 8. Verification

### Unit

- reason/template/free-text normalization and rejection
- polling intervals/terminal status
- application inspect/create/read DTO mapping
- no raw token/message in logs or audit

### Linked pgTAP

- FK/RLS/grants/constraints
- ACTIVE-only public DTO and Owner non-disclosure
- rate windows and 3-minute merge
- Session/Message/intent/audit transaction and rollback
- dual-hash session read isolation
- notification idempotency
- bounded cleanup

### Staging E2E

- KO unauthenticated create under 20 seconds
- 320/768/1280/1920, keyboard, axe
- repeat/concurrent merge to one Session
- browser context reopen recovery
- tampered session/anonymous cookie denial
- URL/phone/email/length rejection
- rendered/JSON Owner data non-disclosure
- fixture/contact/message/intent/attempt/Auth/Queue residue 0

## 9. Phase Gate

Phase 7 does not start until unauthenticated create under 20 seconds, Owner non-disclosure,
same-session merge, reconnect recovery, cross-session denial, cleanup residue 0, linked pgTAP,
WCJ, and `pnpm verify` all pass.
