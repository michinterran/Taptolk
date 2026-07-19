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

The source is ready for Production configuration, but the 2026-07-20 external audit found that
the currently accessible Vercel team is Hobby, no accessible `taptolk` Production Vercel project
exists, and no separate Production Supabase project is accessible. No Production deployment,
provider choice, or secret mutation was performed.

### 1.2 Final Match Rate

100% (Target: 90%)

## 2. Completed Items

- [x] Added bounded due-tenant selection and service-role authorization in PostgreSQL.
- [x] Added stable tenant/hour request IDs and sequential duration-bounded coordination.
- [x] Reused the existing idempotent privacy-cleanup transaction and ledger.
- [x] Added strict repository mapping and aggregate-only HTTP handling.
- [x] Added the authorized hourly GET route and credential-free Vercel manifest.
- [x] Added environment policy, static verification, smoke coverage, and an operator runbook.
- [x] Passed the complete linked pgTAP suite and full repository verification.
- [x] Preserved the QR `1..100` per-Batch contract and kept the resident QR Worker disabled.

## 3. Deviations from Design

None. Production deployment and secret provisioning were explicitly outside the approved
code-owned design and remain manual gates.

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
- Secret scan: PASS.
- Production build: PASS.

## 6. Production Pre-deployment Audit

| Runbook precondition | Result | Evidence boundary |
| --- | --- | --- |
| Hourly-capable Vercel plan | BLOCKED | Accessible team reports Hobby; Vercel restricts Hobby Cron to once daily. |
| Production Vercel project access | BLOCKED | Accessible project inventory contains no `taptolk` project. |
| Root Directory `apps/web` | UNVERIFIED | There is no accessible Production project or local Vercel project link to inspect. |
| Separate Production Supabase | BLOCKED | Accessible inventory contains `taptolk-staging`, but no Production Taptolk project. |
| Production migrations through `20260719184000` | BLOCKED | Confirmed only on linked staging; Production target is absent. |
| SMS/CAPTCHA provider approval | BLOCKED | No provider was selected; production adapters remain unimplemented. |
| Monitoring, rollback, incident ownership | BLOCKED | No accountable Production project/operator decisions are recorded. |
| Release verification | PASS | Linked pgTAP, authenticated staging E2E, and `pnpm verify` passed. |

Because these blockers precede deployment, no authorized Production Cron run, same-hour replay,
cleanup/audit duplicate query, monitoring alert, secret rotation, or rollback rehearsal was
attempted. This is an authorization and environment boundary, not a code-test failure.

## 7. Learnings

1. Scheduler delivery is an at-least-once boundary, so duplicate safety belongs in the
   application request identity and PostgreSQL ledger rather than in scheduler assumptions.
2. Tenant enumeration can remain private while still providing useful operations evidence through
   bounded aggregate counters and non-2xx partial-failure reporting.
3. A code-complete Cron is not a deployed pilot gate; plan support, secret-manager setup,
   monitoring, rotation, and rollback must be verified against the actual Production project.
4. A local monorepo path and historical project mapping do not prove the live Vercel Root
   Directory; the actual accessible Production project settings are the acceptance evidence.

## 8. Follow-up Items

- [ ] Upgrade or select an approved Pro/Enterprise Vercel team, grant the required Production
      project access, and confirm Root Directory `apps/web`.
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
