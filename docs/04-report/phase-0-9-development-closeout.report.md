# Taptolk Phase 0-9 Development Closeout Report

> Date: 2026-07-20 | Decision: `AUTOMATED_DEVELOPMENT_READY / EXTERNAL_PILOT_GATES_PENDING`

## 1. Outcome

The code-owned Phase 0-9 development scope is complete at the automated and linked-staging
evidence boundary. All 15 tracked PDCA features are closed, the linked PostgreSQL contracts and
authenticated staging journeys pass, and the monorepo passes its complete verification gate.

This is not a Production pilot approval. The separate Production data project, SMS and CAPTCHA
providers, real devices, assistive-technology review, physical print proof, monitoring, incident
ownership, and actual-service Cron rehearsal remain external operator gates.

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
| Clean local Supabase reset | PASS twice with the approved Docker Desktop 4.82.0 runtime |
| Local pgTAP | All 23 database test files; 587 tests PASS |
| Linked pgTAP | All 23 database test files PASS |
| Authenticated linked-staging E2E | 28 focused journey tests PASS; one intentional opt-in 10x100 skip |
| Local browser smoke | 30/30 PASS across Chromium and mobile profiles |
| Lint | 320 files PASS |
| Typecheck | 19/19 PASS |
| Unit | 53 files, 326 tests PASS |
| DB static contract | 56 migrations, 23 database tests PASS |
| Secret scan | 530 text files PASS |
| WCJ | 100 / C100 / J100 / W100 over 91 files |
| Production build | PASS |
| Deferred Cron verifier | PASS; zero active Cron definitions in the default manifest |
| PDCA registry | 15/15 features completed |
| GitHub Actions | Run `29705730777` PASS including Linux Chromium browser smoke |
| Production web deploy | `0e2a15e` READY; KO/EN/health 200, cleanup 503, active Cron 0 |

## 4. Acceptance Boundary

The clean local Supabase reset acceptance condition is now satisfied. The formal Production pilot
claim remains conditional because the Production project/provider/manual gates are not configured.
Local and linked database evidence is current and complete, but it does not erase those separate
external acceptance conditions.

The deployed web surface must remain fail closed:

- no active Vercel Cron definition;
- no Production privacy-cleanup authorization or data mutation;
- no public Contact provider path without approved SMS and CAPTCHA adapters;
- no Production secrets in Git, documentation, logs, screenshots, or chat.

The verified fail-closed deployment is available at `https://taptolk.vercel.app`. This URL is
evidence for the web shell and health boundary only; it is not authorization to run Production
cleanup or provider journeys.

## 5. Exact External Completion Order

1. Approve a separate Production Supabase project and region, then apply and verify migrations.
2. Select Production SMS and CAPTCHA providers and authorize their adapters before configuring
   secrets.
3. Complete representative device, VoiceOver/TalkBack, computed-contrast, keyboard, and 85mm
   print review.
4. Assign Production monitoring, rollback, incident, and pilot-window owners.
5. At actual service launch only, move the Vercel project to an hourly-Cron-capable plan, activate
   the reviewed template, and execute the runbook's authorized aggregate-only run, same-hour
   replay, duplicate-zero proof, secret rotation, monitoring, and rollback rehearsal.
6. Mark the pilot `READY` only after every open item in the pilot checklist is signed off.

If a quantity above 100 per Batch is requested, stop and obtain separate quantity-policy design
approval before changing schema, UI, Worker, Queue, or export contracts.

## 6. 2026-07-20 Public Surface Addendum

The prior Production root was technically healthy but still presented a Phase/Foundation
development screen. The public experience now has a localized product landing and a role-based
onboarding route. It explains the verified QR-mediated caller and owner journeys without adding a
tokenless contact path, and it separates customer administrator and Taptolk platform
administrator login entry points before authentication.

The two login surfaces share the existing sign-in, callback, MFA, central RBAC, repository, and
PostgreSQL RLS boundaries. The split changes public routing and typed introduction copy only; it
does not create a second authorization system or imply that external Production providers are
configured.

Revalidation after the change produced:

- linked pgTAP: all 22 database test files PASS;
- `pnpm verify`: lint 324 files, typecheck 19/19, unit 53 files/326 tests, DB static 55
  migrations/22 tests, secret scan 526 text files, WCJ 100 over 91 files, and Production build
  PASS;
- focused landing/onboarding browser checks: KO/EN, Axe, semantic copy, and 320 CSS pixel
  overflow PASS.
- authenticated staging full-suite revalidation: 28 PASS and one intentional opt-in 10x100
  acceptance skip in one run.

The later clean-local checkpoint produced:

- Docker Desktop 4.82.0 daemon verification and two clean local Supabase resets PASS;
- local pgTAP: all 23 files and 587 tests PASS;
- repeatable `qr-generation` Queue baseline security pgTAP: 12/12 PASS;
- linked staging migration apply and all 23 linked pgTAP files PASS;
- post-reset authenticated staging focused suites: 28 PASS, with the approved 10x100 acceptance
  still intentionally opt-in;
- DB static contract: 56 migrations and 23 database tests; secret scan: 530 text files;
  WCJ: 100 over 91 files; Production build PASS.

The decision remains `AUTOMATED_DEVELOPMENT_READY / EXTERNAL_PILOT_GATES_PENDING`. In particular,
the clean-local Phase 1 gate is now satisfied. Production Supabase project/region, SMS/CAPTCHA
providers, secrets, monitoring/rollback/incident owners, and actual-service Cron activation
remain explicit external decisions. Active Cron remains zero on Hobby, and the per-Batch quantity
contract remains `1..100`.

## 7. 2026-07-21 Administrator Entry Supersession

Workorder Task 2 supersedes the 2026-07-20 two-entry public presentation. Customer and platform
administrators now use one canonical localized login. The server still resolves the approved
profile, active membership, valid role/scope pairing, and MFA before routing to separate customer
or platform dashboards. This is a UX-entry consolidation, not an authorization merge.

Task 2 revalidation produced linked pgTAP 23 files/590 tests, authenticated staging E2E 30 PASS
with one intentional 10x100 opt-in skip, WCJ 100/100, local browser smoke 36/36, and full
`pnpm verify` PASS. Manual and external Production pilot gates remain open.
