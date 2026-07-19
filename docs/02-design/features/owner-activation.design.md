# owner-activation - Design Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Implementation
> Level: Dynamic | Plan: `docs/01-plan/features/owner-activation.plan.md`

## 1. Overview

### 1.1 Purpose

Phase 4의 `IN_STOCK` 또는 preassigned `ASSIGNED` QR을 verified phone Owner와 차량에
원자적으로 연결하고, QR을 `ACTIVE`, activation code를 `USED`로 전이한다.

### 1.2 Design Goals

- raw phone/OTP/activation/public/session token이 DB lookup column, log, audit, browser table에
  노출되지 않는다.
- browser는 Route/Application Service를 통하고, DB mutation은 service-only RPC로만 한다.
- QR/code/proof/Binding 동시성은 PostgreSQL row lock과 unique index가 최종 권위다.
- Owner session read model은 owner identity와 tenant scope를 함께 검증한다.

## 2. Architecture

### 2.1 System Architecture

```text
KO/EN Activation UI
  → Route Handler
  → OwnerActivationService
  → OTP / Crypto / Session Domain Policies
  → SupabaseOwnerActivationRepository
  → service-only PostgreSQL RPC transaction

Owner PWA UI
  → HttpOnly owner session cookie
  → OwnerSessionService
  → owner-scoped read RPC
  → RLS-protected Owner DTO
```

The SMS boundary is:

```text
OwnerActivationService
  → OwnerOtpProvider
      → StagingMockOwnerOtpProvider
      → future Supabase Send SMS Hook / domestic provider
```

The provider receives the raw six-digit OTP only in memory. Repository calls receive purpose-
separated hashes and encrypted phone data, never the raw OTP or phone.

### 2.2 Component Design

| Layer | Owner |
|---|---|
| Domain | OTP policy, activation state policy, consent/session TTL |
| Application | inspect/requestOtp/verifyOtp/complete/listVehicles services and DTO |
| Repository | typed RPC boundary, no browser DB client |
| Route | Zod input, origin/CSRF, cookie issue/revoke, error mapping |
| UI | typed KO/EN journey states and recovery actions |
| DB | constraints, locks, transaction, audit, RLS, cleanup |

### 2.3 State Flows

OTP:

```text
PENDING → VERIFIED
PENDING → LOCKED
PENDING → EXPIRED
VERIFIED/LOCKED/EXPIRED are terminal
```

Verified phone proof:

```text
ISSUED → CONSUMED
ISSUED → EXPIRED
```

QR:

```text
IN_STOCK → ACTIVATION_PENDING → ACTIVE
ASSIGNED → ACTIVATION_PENDING → ACTIVE
```

Activation complete locks and commits the final two QR transitions inside one transaction. A
failed transaction leaves the original status unchanged.

## 3. Data Model

### 3.1 `owners`

| Field | Rule |
|---|---|
| id | UUID PK |
| auth_user_id | nullable unique Auth link |
| phone_hash | unique 64-char purpose HMAC |
| phone_encrypted | AES-256-GCM ciphertext |
| phone_key_version | positive integer |
| phone_last4 | 4 digits, masked DTO only |
| status | `ACTIVE/SUSPENDED/DELETED` |
| verified_at | required for ACTIVE |
| terms_version/privacy_version | allowlisted version text |
| consented_at | DB timestamp |
| created_at/updated_at/version | immutable identity + optimistic version |

`owners` is a platform identity table. Tenant-owned access is derived only through active
`vehicle_owners`; no tenant-wide Owner catalog is exposed to browser roles.

### 3.2 `owner_devices`

Owner-owned device hash, optional push subscription, `ACTIVE/REVOKED`, last seen. Push payload
is out of Phase 5. Browser direct select/mutation is denied.

### 3.3 `vehicle_owners`

Contains tenant/site/vehicle/owner, `started_at`, nullable end fields, `is_primary`, and activation
source. Composite FKs prevent cross-tenant vehicle relationship. One primary active Owner per
Vehicle is enforced with a partial unique index.

### 3.4 `owner_otp_challenges`

Service-only table:

- tenant/site/QR scope
- phone hash/ciphertext/key version/last4
- IP hash and device hash
- OTP code HMAC
- status, attempt count, send count
- expires at, resend after, verified/locked timestamps
- delivery status without provider response body

Indexes support phone-hour/day, IP window, device window, and QR challenge lookup.

### 3.5 `owner_phone_verification_proofs`

Service-only one-time proof with challenge/tenant/site/QR/phone hashes, unique proof hash,
expires/consumed timestamps, and state constraint.

### 3.6 `owner_sessions`

Hash-only session token, Owner/device relationship, expiry, last seen, revoked timestamp and
status. Cookie raw token is never persisted. Cleanup preserves redacted session lifecycle counts.

### 3.7 Existing table changes

- `qr_bindings.created_by` becomes nullable.
- add `created_by_owner_id` FK.
- check exactly one of Admin actor or Owner actor is present.
- add Owner FK to `qr_bindings.owner_id` and `qr_activation_codes.used_by_owner_id`.
- existing rows remain Admin-created and valid.

## 4. Database Commands

### 4.1 `inspect_owner_activation(text)`

Input is `public_token_hash`, never raw token. Returns only:

```ts
{
  activatable: boolean;
  assignmentMode: "PREASSIGNED" | "SELF_REGISTRATION";
  plateLast4: string | null;
  qrStatus: "IN_STOCK" | "ASSIGNED" | "ACTIVATION_PENDING";
  siteDisplayName: string;
}
```

No Owner ID, phone, full plate, internal QR ID, token hash, or activation code state is returned.
Non-activatable tokens use stable error categories rather than existence-revealing detail.

### 4.2 `request_owner_activation_otp(jsonb)`

Service role only. Locks QR/code scope, enforces:

- expiry 180 seconds
- resend cooldown 60 seconds
- max input attempts 5
- phone hour 5 / day 10
- IP and device configured limits

Inserts one challenge and returns challenge ID/expiry/cooldown only.

### 4.3 `verify_owner_activation_otp(jsonb)`

Service role only. Locks challenge, increments attempt atomically, checks expiry/code HMAC, and
on success writes the application-generated proof hash with TTL. Returns status/proof expiry;
the raw proof stays only in the application response.

### 4.4 `complete_owner_activation(jsonb)`

Service role only. Lock order:

1. QR Asset by public token hash
2. activation code by QR ID
3. verification proof by proof hash
4. current Binding/Vehicle if preassigned

Then validate code hash/status/expiry, proof scope/phone/TTL/unused, consent versions, QR state,
vehicle plate hash, and active Binding conflicts.

Transaction writes:

- create/reuse Owner by phone hash
- create/reuse Vehicle in exact Site or validate preassigned Vehicle
- create/update active Binding and `vehicle_owners`
- QR status log `… → ACTIVATION_PENDING → ACTIVE`
- QR `current_vehicle_id/current_binding_id/activated_at`
- activation code `USED/used_by_owner_id/used_at`
- proof `CONSUMED`
- owner session hash
- redacted audit with status/relationship IDs only

Idempotent retry with the same consumed proof/session request returns the existing completed DTO
only when all identity/scope fields match; a competing request receives conflict.

### 4.5 Read/Cleanup

- `list_owner_vehicle_read_model(session_hash)` returns masked vehicle/QR status for only the
  session Owner.
- service-only fixture cleanup accepts only bounded `e2e-*` tenant/owner/session identities and
  leaves zero Auth/session/OTP/proof residue.

## 5. HTTP and UI Contract

### 5.1 Routes

```text
GET  /{locale}/activate/{publicToken}
POST /api/v1/owner/activation/inspect
POST /api/v1/owner/activation/otp/request
POST /api/v1/owner/activation/otp/verify
POST /api/v1/owner/activation/complete
GET  /{locale}/owner
GET  /{locale}/owner/vehicles
GET  /api/v1/owner/vehicles
```

All API responses are `Cache-Control: no-store`. Mutations enforce same-origin/CSRF policy.

### 5.2 Cookie

```text
Name: tt_owner_session
HttpOnly: true
Secure: production/staging
SameSite: Lax
Path: /
MaxAge: configured owner session TTL
```

### 5.3 Activation Journey

1. status inspection
2. activation code
3. preassigned vehicle confirmation or vehicle plate entry
4. phone entry
5. OTP request and six-digit input
6. terms/privacy consent
7. atomic completion
8. Owner PWA success shell

Every step has loading, invalid, expired, rate-limited, offline, retry, and completed states in
both Korean and English. Semantic headings use locale-specific typed line groups.

### 5.4 PWA

- manifest/icons/standalone display
- static shell/offline fallback only
- activation, phone, OTP, vehicle, response data excluded from Cache Storage
- no offline success state

## 6. Environment Policy

```text
OWNER_OTP_TTL_SECONDS=180
OWNER_OTP_RESEND_SECONDS=60
OWNER_OTP_MAX_ATTEMPTS=5
OWNER_OTP_PHONE_HOURLY_LIMIT=5
OWNER_OTP_PHONE_DAILY_LIMIT=10
OWNER_OTP_IP_WINDOW_LIMIT=10
OWNER_OTP_DEVICE_WINDOW_LIMIT=10
OWNER_PHONE_PROOF_TTL_SECONDS=300
OWNER_SESSION_TTL_MINUTES=43200
OWNER_PHONE_HMAC_KEY=
OWNER_OTP_HMAC_KEY=
OWNER_SESSION_HMAC_KEY=
```

`.env.example` contains empty keys. Server-only secrets are never `NEXT_PUBLIC_`.

## 7. File Plan

```text
packages/domain/src/owner-activation-policy.ts
packages/application/src/owner-activation-service.ts
packages/auth/src/owner-session.ts
apps/web/owner/*
apps/web/app/api/v1/owner/*
apps/web/app/[locale]/activate/[publicToken]/page.tsx
apps/web/app/[locale]/owner/*
apps/web/components/owner-activation-view.tsx
apps/web/content/owner-copy.ts
supabase/migrations/*_phase_5_owner_activation.sql
supabase/tests/database/phase_5_owner_activation.sql
e2e/staging/owner-activation.spec.ts
```

## 8. Test Plan

### 8.1 Unit

- policy boundaries for every OTP limit and TTL
- phone/OTP/proof/session purpose separation
- DTO redaction and copy KO/EN key parity
- Application service never forwards raw phone/OTP to repository
- cookie attributes and owner session expiry

### 8.2 pgTAP

- table constraints, composite FKs, RLS/grants
- service-only OTP/proof/session storage
- rate limit and attempt/expiry transitions
- concurrent complete: one success/one conflict
- preassigned and self-registration transaction
- QR ACTIVE/code USED/proof consumed/audit in one commit
- cross-owner/cross-tenant read denial

### 8.3 Staging E2E

- actual QR fixture with activation code only in process memory
- request/verify OTP through bounded staging provider
- concurrent activation completion
- Owner PWA masked vehicle read
- other Owner session tamper denial
- KO/EN, 320px and keyboard journey
- fixture/Auth/session/OTP/proof residue zero

## 9. Security and Evidence Boundary

- No phone, OTP, activation code, public token, proof, session token, cookie, or authorization
  value in logs, errors, audit JSON, screenshots, reports, or committed fixtures.
- Public URL paths are never copied into structured logs. Platform access-log redaction is a
  Phase 9 operational check.
- Phase 5 can claim staging mock-provider acceptance, not domestic SMS delivery acceptance.
- Phase 6 does not start until transaction, OTP limits, ACTIVE transition, owner isolation,
  cleanup, linked pgTAP, staging E2E, WCJ, and `pnpm verify` pass.
