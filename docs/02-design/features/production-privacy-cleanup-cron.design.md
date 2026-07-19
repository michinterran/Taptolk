# Production Privacy Cleanup Cron - Design Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Do
> Level: Dynamic | Plan: `docs/01-plan/features/production-privacy-cleanup-cron.plan.md`

---

## 1. Overview

### 1.1 Purpose

Add a bounded Production scheduler adapter around the Phase 9 tenant cleanup service. The
scheduler discovers due tenants through a service-role-only database contract, derives stable
hourly request IDs, and invokes the existing retention transaction once per due tenant.

### 1.2 Design Goals

- Preserve `UI/HTTP -> Application Service -> Repository -> PostgreSQL`.
- Keep Vercel scheduling details in the web adapter and manifest.
- Make duplicate and overlapping invocations safe without trusting scheduler uniqueness.
- Keep all response, error, and log payloads free of tenant identifiers and protected data.

## 2. Architecture

### 2.1 System Architecture

```text
Vercel Cron GET
  -> Cron Bearer authorization
  -> ScheduledPrivacyCleanupService
      -> list_due_privacy_cleanup_tenants RPC
      -> deterministic tenant/hour UUID
      -> run_privacy_cleanup RPC
  -> aggregate response and redacted operational log
```

The existing single-tenant `POST` route remains available for controlled internal/staging
verification. The new `GET` route is the only path referenced by the Production Cron manifest.

### 2.2 Component Design

#### PostgreSQL due selector

`list_due_privacy_cleanup_tenants(p_limit integer) -> jsonb`

- Requires `auth.role() = 'service_role'`.
- Accepts `1..100`.
- Selects `ACTIVE`, non-deleted tenants.
- Excludes a tenant with any cleanup run started in the current UTC hour.
- Orders never-run tenants first, then by oldest latest run, then tenant UUID.
- Returns `{ "tenant_ids": ["uuid", ...] }`.
- Grants execute only to `service_role`.

#### Application coordinator

`ScheduledPrivacyCleanupService` owns:

- limit and duration validation;
- UTC-hour bucket normalization;
- deterministic version-8 UUID derivation from a constant namespace, tenant UUID, and hour;
- sequential per-tenant execution to avoid uncontrolled DB concurrency;
- per-tenant error isolation;
- aggregate success, in-progress, failure, deferred, and mutation counts.

It never returns selected tenant IDs or request IDs.

#### Repository adapter

The web repository:

- calls `list_due_privacy_cleanup_tenants`;
- maps only UUID arrays;
- calls `run_privacy_cleanup` with typed retention values;
- maps `SUCCESS` or `RUNNING` without upstream error/detail leakage.

#### HTTP policy

`GET /api/internal/privacy-cleanup`

- Node runtime, dynamic, no-store, `maxDuration = 60`.
- Requires the existing constant-time Cron Bearer authorization.
- Has no query or request-body authority.
- Returns `200` for a complete bounded run, `500` if one or more tenants fail, `401` for auth
  failure, and `503` for missing/invalid runtime configuration.
- Response contains request ID and aggregate counts only.

### 2.3 Data Flow

1. Vercel performs an HTTP GET using the path in `apps/web/vercel.json`.
2. The route reads typed configuration; missing Cron/service credentials fail closed.
3. The handler validates `Authorization: Bearer ...`.
4. The application service snapshots the current UTC hour and asks for at most the configured
   number of due tenants.
5. For each selected tenant while inside the duration budget, the service derives the same UUID
   for every invocation in that tenant/hour.
6. The repository calls the existing `run_privacy_cleanup` transaction. Its unique request ledger
   absorbs duplicates and preserves the existing tenant audit.
7. The handler returns only aggregate counts. Failures remain visible as a non-2xx status because
   Vercel does not retry failed Cron invocations automatically.

## 3. Data Model

### 3.1 Entities

No new table is required. The design reuses:

- `tenants`
- `privacy_cleanup_runs`
- `contact_sessions`
- `response_tokens`
- `caller_blocks`
- `messages`
- `audit_logs`

One new service-only selector function is added.

### 3.2 Relationships

`privacy_cleanup_runs.tenant_id` remains the scheduling freshness ledger. Existing foreign keys,
RLS, forced RLS, and retention transaction behavior are unchanged.

## 4. API Specification

### 4.1 Endpoints

#### GET `/api/internal/privacy-cleanup`

Headers:

```text
Authorization: Bearer <CRON_SECRET>
```

Success:

```json
{
  "data": {
    "status": "SUCCESS",
    "selectedTenantCount": 4,
    "processedTenantCount": 4,
    "inProgressTenantCount": 0,
    "failedTenantCount": 0,
    "deferredTenantCount": 0,
    "expiredSessionCount": 2,
    "revokedTokenCount": 3,
    "revokedBlockCount": 1,
    "redactedMessageCount": 5
  },
  "meta": { "requestId": "uuid" }
}
```

No tenant identifier, cleanup run ID, policy secret, or protected record value is returned.

### 4.2 Configuration

- `PRIVACY_CLEANUP_TENANT_LIMIT`: default `25`, range `1..100`.
- `PRIVACY_CLEANUP_DURATION_BUDGET_MS`: default `45_000`, range `1_000..55_000`.
- Existing `CRON_SECRET`, `SUPABASE_SECRET_KEY`, and retention variables remain authoritative.
- Production continues to reject absent secrets through the central environment parser.

## 5. Implementation Plan

### 5.1 File Structure

```text
supabase/migrations/*_production_privacy_cleanup_cron.sql
supabase/tests/database/production_privacy_cleanup_cron.sql
packages/application/src/scheduled-privacy-cleanup-service.ts
packages/application/src/scheduled-privacy-cleanup-service.test.ts
apps/web/internal/supabase-scheduled-privacy-cleanup-repository.ts
apps/web/internal/scheduled-privacy-cleanup-handler.ts
apps/web/internal/scheduled-privacy-cleanup-handler.test.ts
apps/web/internal/privacy-cleanup-runtime.ts
apps/web/app/api/internal/privacy-cleanup/route.ts
apps/web/vercel.json
scripts/verify-production-cron.mjs
```

### 5.2 Implementation Order

1. Add typed configuration and application coordinator with unit tests.
2. Add the due-tenant RPC and pgTAP security/selection/idempotency contract.
3. Add the repository, runtime, handler, and GET route.
4. Add the Vercel manifest and static verifier to `pnpm verify`.
5. Run focused tests, linked pgTAP, secret scan, WCJ, build, and full verify.

## 6. Test Plan

### 6.1 Unit Tests

- Same tenant/hour produces the same UUID; adjacent hours produce different UUIDs.
- Invalid policy values fail before repository access.
- Limit and duration stop work without leaking tenant IDs.
- A tenant failure does not prevent remaining selected tenants from running.
- `RUNNING` duplicate results are counted without repeating side effects.
- Unauthorized and unavailable handlers call no application service.
- Handler responses contain no secret or tenant ID.

### 6.2 Database and Integration Tests

- Function exists, accepts only service role, and rejects limits outside `1..100`.
- Active/non-deleted tenant is selected.
- Suspended, closed, and deleted tenants are excluded.
- A current-hour run excludes its tenant; an older run remains eligible.
- Limit and oldest-due ordering are deterministic.
- Existing `run_privacy_cleanup` duplicate request behavior remains unchanged.
- Static verifier confirms exact manifest path, hourly schedule, GET export, and no embedded secret.

## 7. Security Considerations

- Bearer authorization remains constant-time and server-only.
- Cron user-agent is observability metadata, not an authorization factor.
- Scheduler duplication is expected; deterministic request IDs and the DB unique constraint are
  the authority.
- Tenant IDs are internal scheduling inputs and never returned or logged.
- Raw Supabase/provider errors never cross the repository boundary.
- No environment value is written to source, documentation, test snapshots, or build output.
- The manifest does not enable the resident QR Worker and does not change quantity policy.
