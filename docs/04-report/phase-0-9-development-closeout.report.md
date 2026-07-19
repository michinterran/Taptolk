# Taptolk Phase 0-9 Development Closeout Report

> Date: 2026-07-20 | Decision: `AUTOMATED_DEVELOPMENT_READY / EXTERNAL_PILOT_GATES_PENDING`

## 1. Outcome

The code-owned Phase 0-9 development scope is complete at the automated and linked-staging
evidence boundary. All 14 tracked PDCA features are closed, the linked PostgreSQL contracts and
authenticated staging journeys pass, and the monorepo passes its complete verification gate.

This is not a Production pilot approval. The separate Production data project, SMS and CAPTCHA
providers, local migration reset runtime, real devices, assistive-technology review, physical
print proof, monitoring, incident ownership, and actual-service Cron rehearsal remain external
operator gates.

## 2. Completed Development Boundary

- Phase 0 foundation, localized web shell, health, CI, WCJ, secret scanning, and immutable brand
  verification.
- Phase 1 tenant/auth/RBAC/RLS/Site lifecycle contracts and authenticated Site CRUD/isolation.
- Phase 2-4 QR domain, approval, queue dispatch, generation, inventory, public contact, owner
  activation, notification/reply, and lifecycle behavior.
- Phase 5-8 staging acceptance, export/print-source integrity, escalation/abuse, retention,
  operations, security, and bounded load evidence.
- Phase 9 analytics hardening and Production privacy-cleanup Cron source contract.
- Admin architecture contract and every tracked PDCA analysis/report closure.
- Linux Chromium narrow-auth overflow repair at 320 CSS pixels.

The QR quantity contract remains `1..100` per Batch. The 1,000-item acceptance was ten approved
100-item Batches; no single 1,000-item Batch policy was introduced.

## 3. Final Automated Evidence

| Gate | Result |
| --- | --- |
| Linked pgTAP | All 22 database test files PASS |
| Authenticated linked-staging E2E | 28 PASS, one intentional opt-in 10x100 skip |
| Local browser smoke | 30/30 PASS across Chromium and mobile profiles |
| Lint | 320 files PASS |
| Typecheck | 19/19 PASS |
| Unit | 53 files, 326 tests PASS |
| DB static contract | 55 migrations, 22 database tests PASS |
| Secret scan | 517 text files PASS |
| WCJ | 100 / C100 / J100 / W100 over 87 files |
| Production build | PASS |
| Deferred Cron verifier | PASS; zero active Cron definitions in the default manifest |
| PDCA registry | 14/14 features completed |

## 4. Acceptance Boundary

The formal Phase 1 and Production pilot claims remain conditional because a clean local Supabase
reset could not be executed without an approved Docker-compatible runtime, and the Production
project/provider/manual gates are not configured. Linked staging evidence is current and complete,
but it does not erase those explicit acceptance conditions.

The deployed web surface must remain fail closed:

- no active Vercel Cron definition;
- no Production privacy-cleanup authorization or data mutation;
- no public Contact provider path without approved SMS and CAPTCHA adapters;
- no Production secrets in Git, documentation, logs, screenshots, or chat.

## 5. Exact External Completion Order

1. Install and start an approved Docker-compatible local runtime and run a clean local Supabase
   reset plus the complete pgTAP suite.
2. Approve a separate Production Supabase project and region, then apply and verify migrations.
3. Select Production SMS and CAPTCHA providers and authorize their adapters before configuring
   secrets.
4. Complete representative device, VoiceOver/TalkBack, computed-contrast, keyboard, and 85mm
   print review.
5. Assign Production monitoring, rollback, incident, and pilot-window owners.
6. At actual service launch only, move the Vercel project to an hourly-Cron-capable plan, activate
   the reviewed template, and execute the runbook's authorized aggregate-only run, same-hour
   replay, duplicate-zero proof, secret rotation, monitoring, and rollback rehearsal.
7. Mark the pilot `READY` only after every open item in the pilot checklist is signed off.

If a quantity above 100 per Batch is requested, stop and obtain separate quantity-policy design
approval before changing schema, UI, Worker, Queue, or export contracts.
