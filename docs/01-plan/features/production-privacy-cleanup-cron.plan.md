# Production Privacy Cleanup Cron - Plan Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Design
> Level: Dynamic

---

## 1. Overview

### 1.1 Purpose

Make the approved privacy cleanup policy safely schedulable in Production without requiring a
tenant identifier in a Cron request, weakening the existing tenant boundary, or exposing secrets
and tenant identifiers in responses or logs.

### 1.2 Background

Phase 9 delivered a Cron-authorized `POST /api/internal/privacy-cleanup` path for a single typed
tenant input. Vercel Cron invokes a configured path with an HTTP `GET`, can deliver duplicate or
overlapping invocations, and does not retry failed invocations. The current route therefore cannot
be scheduled directly. The next code-owned pilot gate is a bounded, idempotent scheduler
orchestration contract; actual Production credentials and deployment remain user-owned.

## 2. Goals

### 2.1 Primary Goals

- [ ] Select only active tenants that have not started a cleanup in the current UTC hour.
- [ ] Derive one deterministic UUID per tenant and UTC-hour window so duplicate Cron delivery is
      idempotent.
- [ ] Run a bounded number of tenants within a typed duration budget and return aggregate counts
      only.
- [ ] Add a Cron-compatible authenticated `GET` endpoint and an hourly Vercel schedule manifest.
- [ ] Fail closed when Cron or service credentials are absent and retain the single-tenant POST
      contract for controlled staging acceptance.
- [ ] Add CI-verifiable schedule, route, and configuration contracts without storing secret values.

### 2.2 Non-Goals

- Selecting or configuring an SMS or CAPTCHA provider.
- Creating Production Supabase/Vercel projects, environment values, or live traffic.
- Changing retention periods, privacy semantics, audit history, tenant isolation, or RLS.
- Changing the 1–100 per-Batch contract, Queue/Worker runtime, or export behavior.
- Claiming manual pilot or Production approval.

## 3. Scope

### 3.1 In Scope

- Service-role-only due-tenant PostgreSQL RPC with deterministic ordering and a hard maximum.
- Application service for bounded scheduled cleanup and aggregate results.
- Production-safe configuration for tenant limit and duration budget.
- Cron HTTP handler and `GET /api/internal/privacy-cleanup`.
- An inert hourly Production Cron template and an explicitly deferred default Vercel manifest.
- Source verifier integrated into `pnpm verify`.
- Unit, pgTAP, static manifest, and staging-safe handler tests.

### 3.2 Out of Scope

- External provider credentials or provider-specific adapters.
- Deployment, DNS, alert destinations, billing, and production data seeding.
- Physical device, screen-reader, contrast, or 85mm printer acceptance.
- A resident Worker host manifest.

## 4. Success Criteria

- [ ] Unauthorized, missing-config, and malformed invocations perform no repository work.
- [ ] Two invocations for the same tenant/hour use the same UUID and create no duplicate cleanup
      or audit result.
- [ ] Suspended, closed, deleted, and already-started-this-hour tenants are not selected.
- [ ] Limit and duration policy are bounded and validated before repository access.
- [ ] Response and logs contain counts and request ID only; no tenant ID, secret, message, token,
      phone, or provider payload.
- [ ] Production template schedules the exact GET route hourly, the current default manifest keeps
      activation deferred, and both states are checked by `pnpm verify`.
- [ ] Linked pgTAP, relevant tests, WCJ, secret scan, build, and `pnpm verify` pass.

## 5. Schedule

| Phase | Target Date | Status |
|---|---|---|
| Plan | 2026-07-20 | Complete |
| Design | 2026-07-20 | In progress |
| Implementation | 2026-07-20 | Pending |
| Review | 2026-07-20 | Pending |

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Duplicate or overlapping Cron delivery | Duplicate audit or load | Medium | Deterministic tenant/hour UUID plus existing unique request ledger |
| One tenant blocks the whole invocation | Cleanup starvation | Medium | Per-tenant error isolation, bounded duration, oldest-due ordering |
| More tenants than one invocation can process | Deferred cleanup | Medium | Hard limit, oldest-due ordering, deferred count, hourly next run |
| Cron secret leakage | Privileged route access | Low | Existing constant-time Bearer check, aggregate response, secret scan |
| Staging test mutates unrelated tenants | Data corruption | Low | Unit/pgTAP handler proof; no broad staging invocation |
| Manifest deploys before external approval | Premature Production traffic | Low | Code-only checkpoint; Production deployment remains explicitly user-owned |

## 7. References

- `docs/handoff-0720-0452.md`
- `docs/deployment/pilot-readiness-checklist.md`
- `docs/04-report/analytics-hardening.report.md`
- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` sections 14.5, 26.3, 26.4, and 27
- `docs/architecture/worker-runtime-decision.md`
- Vercel Cron documentation, reviewed 2026-07-20
