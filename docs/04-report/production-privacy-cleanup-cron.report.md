# Completion Report: Production Privacy Cleanup Cron

> Date: 2026-07-20 | Level: Dynamic

---

## 1. Summary

### 1.1 Feature Overview

Implemented the next code-owned pilot gate: a bounded Production privacy-cleanup scheduler that
discovers due tenants through a service-role-only database contract and reuses the existing
transactional retention service. The scheduler is safe against duplicate and overlapping
invocations, returns and logs aggregate counts only, and fails closed when runtime configuration
or authorization is absent.

The source is ready for Production configuration. By user decision, automatic Cron activation is
deferred until actual service launch. The current Hobby deployment registers no Cron, while an
inert reviewed template preserves the exact hourly contract. A Vercel `taptolk` project now exists
with Root Directory `apps/web`; no separate Production Supabase or Production provider decision
was introduced.

### 1.2 Final Match Rate

100% (Target: 90%)

## 2. Completed Items

- [x] Added bounded due-tenant selection and service-role authorization in PostgreSQL.
- [x] Added stable tenant/hour request IDs and sequential duration-bounded coordination.
- [x] Reused the existing idempotent privacy-cleanup transaction and ledger.
- [x] Added strict repository mapping and aggregate-only HTTP handling.
- [x] Added the authorized hourly GET route, a Cron-deferred default manifest, and a
      credential-free hourly Production template.
- [x] Added environment policy, static verification, smoke coverage, and an operator runbook.
- [x] Passed the complete linked pgTAP suite and full repository verification.
- [x] Preserved the QR `1..100` per-Batch contract and kept the resident QR Worker disabled.

## 3. Deviations from Design

The scheduler implementation is unchanged. The user explicitly deferred active Cron registration
until actual service launch so the current Hobby web project can deploy. The exact hourly path and
schedule remain code-reviewed in an inert template, and activation has its own strict verifier.
Production secret provisioning remains a manual gate.

## 4. Metrics

| Metric | Value |
| --- | --- |
| Files changed/added before handoff | 23 |
| Approximate added lines including tests/docs/migration | 1,600 |
| PDCA iterations | 1 |
| Design match rate | 100% |
| New linked pgTAP assertions | 16/16 PASS |
| Smoke E2E | 30/30 PASS |
| Full unit suite | 53 files, 326 tests PASS |
| WCJ | 100; C100/J100/W100 |

## 5. Validation

- `pnpm verify`: PASS.
- Complete linked pgTAP: all 22 database test files PASS.
- Authenticated staging E2E: 28 PASS with one intentional opt-in 1,000-item acceptance skip.
- Linked `taptolk-staging`: healthy in Seoul; local/remote migrations match through
  `20260719184000`.
- `pnpm e2e:smoke`: 30/30 PASS on Chromium and mobile profiles.
- Static Cron contract: exact hourly path, GET export, bounded duration, and no embedded
  credential PASS.
- Cron-deferred contract: default manifest has zero jobs; Production template has exactly one
  approved hourly job; deferred verifier PASS.
- Secret scan: PASS.
- Production build: PASS.
- Vercel project: `taptolk`, Root Directory `apps/web`, Next.js, Node 24.x, Cron definitions 0.
- Vercel deployment of `896904e`: READY. Public KO/EN/health return 200; cleanup without
  Production configuration returns 503 and performs no authorized run.
- Staging Preview: READY and protected by Vercel team SSO.

## 6. Production Pre-deployment Audit

| Runbook precondition | Result | Evidence boundary |
| --- | --- | --- |
| Hourly-capable Vercel plan | DEFERRED | Current web deploy has no Cron; Pro is required only when the approved hourly template is activated. |
| Vercel project access | PASS | `taptolk` was created and linked under the authorized current team. |
| Root Directory `apps/web` | PASS | Live project settings report `apps/web`. |
| Separate Production Supabase | BLOCKED | Accessible inventory contains `taptolk-staging`, but no Production Taptolk project. |
| Production migrations through `20260719184000` | BLOCKED | Confirmed only on linked staging; Production target is absent. |
| SMS/CAPTCHA provider approval | BLOCKED | No provider was selected; production adapters remain unimplemented. |
| Monitoring, rollback, incident ownership | BLOCKED | No accountable Production project/operator decisions are recorded. |
| Release verification | PASS | Linked pgTAP, authenticated staging E2E, and `pnpm verify` passed. |

The web surface is deployed, but actual-service gates remain intentionally closed. No authorized
Production Cron run, same-hour replay, cleanup/audit duplicate query, monitoring alert, secret
rotation, or rollback rehearsal was attempted. This is a go-live boundary, not a code-test
failure.

## 7. Learnings

1. Scheduler delivery is an at-least-once boundary, so duplicate safety belongs in the
   application request identity and PostgreSQL ledger rather than in scheduler assumptions.
2. Tenant enumeration can remain private while still providing useful operations evidence through
   bounded aggregate counters and non-2xx partial-failure reporting.
3. A code-complete Cron is not a deployed pilot gate; plan support, secret-manager setup,
   monitoring, rotation, and rollback must be verified against the actual Production project.
4. A local monorepo path and historical project mapping do not prove the live Vercel Root
   Directory; the actual accessible project settings are the acceptance evidence.
5. Keeping the route fail closed while the schedule is absent allows development deployment
   without silently weakening the later Production Cron contract.

## 8. Follow-up Items

- [ ] At actual service launch, upgrade the linked project to Pro or Enterprise and activate the
      reviewed hourly Cron template in a dedicated release commit.
- [ ] Create or grant access to the separate Production Supabase project and approve its region
      before applying migrations.
- [ ] Select Production SMS and CAPTCHA providers and authorize their adapter implementation;
      configure values only through the approved Production secret manager afterward.
- [ ] Follow `docs/deployment/production-privacy-cleanup-cron-runbook.md` in the verified
      Production project and verify one authorized aggregate-only run, same-hour replay,
      cleanup/audit duplicate 0, monitoring, secret rotation, and rollback.
- [ ] Complete iOS/Android, VoiceOver/TalkBack, computed contrast, print proof, and operator
      rehearsal gates.
- [ ] Keep pilot status `AUTOMATED_READY / MANUAL_GATES_PENDING` until all manual gates pass.
