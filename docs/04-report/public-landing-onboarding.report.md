# Completion Report: Public Landing and Onboarding

> Date: 2026-07-20 | Level: Dynamic

---

## 1. Summary

### 1.1 Feature Overview

Replaced the deployed internal-development root concept with a public Taptolk product landing and
added a role-based onboarding route. The new journey makes the QR-mediated privacy value clear,
shows how caller and owner paths begin from issued QR/token context, and visibly separates
customer operations login from Taptolk platform administration login.

The two administrator entry pages intentionally reuse the existing authentication action,
callback, MFA, central RBAC, repository, and PostgreSQL RLS layers. No external provider,
Production data project, secret, Cron, or authorization shortcut was introduced.

### 1.2 Final Match Rate

100% (Target: 90%)

## 2. Completed Items

- [x] Added localized public landing and onboarding routes.
- [x] Removed internal Phase/Foundation and “preparing structure” copy from the user-facing root.
- [x] Added four explicit onboarding roles with safe QR/token-led guidance.
- [x] Added separate customer administrator and platform administrator pre-login routes.
- [x] Preserved login area across password, Google, callback, and registration error redirects.
- [x] Added typed KO/EN content, semantic heading lines, responsive styles, and WCJ rules.
- [x] Added KO/EN, Axe, platform-login split, and 320px overflow browser coverage.
- [x] Preserved the QR `1..100` per-Batch policy and zero active Cron state.

## 3. Deviations from Design

None. A contrast issue discovered in the first focused Axe pass was fixed before completion.

## 4. Metrics

| Metric | Value |
| --- | --- |
| PDCA iterations | 1 |
| Design match rate | 100% |
| Full unit suite | 53 files, 327 tests PASS |
| WCJ | 100; C100/J100/W100; 92 files |
| Clean local Supabase reset | PASS twice |
| Local pgTAP | 23 files, 590 tests PASS |
| Linked pgTAP | 23 files, 590 tests PASS |
| DB static contract | 57 migrations, 23 database tests PASS |
| Secret scan | 539 text files PASS |
| Production build | PASS |

## 5. Validation

- `pnpm validate:wcj`: PASS after the final public-component changes.
- Focused browser coverage: KO/EN landing, onboarding, customer/platform login distinction, Axe,
  semantic heading source, and 320 CSS pixel overflow PASS.
- `pnpm verify`: PASS.
- Clean local Supabase reset: PASS twice with the operator-approved Docker Desktop 4.82.0
  runtime.
- Complete local pgTAP: all 23 database test files and 587 tests PASS.
- Complete linked pgTAP: all 23 database test files PASS through `pnpm db:test:linked`.
- Complete public-contact authenticated staging serial file: 5/5 PASS.
- Complete QR-inventory authenticated staging serial file: 15/15 PASS on a clean fixture,
  including concurrency and residue-zero cleanup.
- Post-reset authenticated staging focused suites: 28 PASS across Phase 9 hardening, public
  contact, QR inventory, Site tenant isolation, and owner activation. The 10x100 acceptance
  remains an intentional opt-in skip.
- GitHub Actions `29716589923`: PASS including Linux Chromium browser smoke.
- Production deployment `dpl_BAgu1XGxQeN97nab1op8ZGovyoQ3`: READY and aliased to
  `https://taptolk.vercel.app`.
- Production routes: KO/EN landing, onboarding, customer login, platform login, and health 200;
  unconfigured cleanup 503 fail-closed.
- Production browser: no console errors and no horizontal overflow at 1440 or 320 CSS pixels.
- Post-MFA customer and platform administration redirects accept the role-selection landing at
  `/{locale}/admin` as well as their authorized destination routes.
- Refined KO/EN product copy and the landing hero without changing the QR/token-led journey,
  administrator authorization boundary, or the EN `caller` terminology.
- Integrated authenticated staging revalidation: 28/28 default tests PASS; the separately
  approved 10x100 acceptance remains an intentional opt-in skip.
- GitHub Actions `29748841968` and `29749378649`: PASS including Linux Chromium browser smoke.
- Production deployment `dpl_DTvj4RjQ68MnVYAXQKR6KexiEEM7`: READY and aliased to the stable
  URL. KO/EN landing, customer login, platform login, and health return 200; cleanup returns 503
  fail-closed.
- The deployed source uses the explicit `.vercelignore` boundary and the default Cron-deferred
  manifest. Active Production Cron definitions remain zero.

## 6. Release Boundary

Decision: `AUTOMATED_READY / MANUAL_GATES_PENDING`.

The current Vercel Hobby project must retain zero active Cron definitions. Production Supabase
project/region, SMS/CAPTCHA providers, secret configuration, monitoring/rollback/incident owners,
real-device and assistive-technology QA, and actual-service Cron activation were not selected or
configured.

## 7. Follow-up Items

- [x] Obtain the operator's explicit Docker-compatible runtime approval, install/start only that
      runtime, then run a clean local Supabase reset and complete pgTAP.
- [ ] Complete the remaining external/manual pilot checklist in its recorded order.
- [ ] Request Pro or Enterprise approval only at actual hourly Cron activation time.
- [ ] Require separate quantity-policy design approval before any per-Batch quantity above 100.
