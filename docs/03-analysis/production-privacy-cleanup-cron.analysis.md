# Gap Analysis: Production Privacy Cleanup Cron

> Date: 2026-07-20 | Design:
> `docs/02-design/features/production-privacy-cleanup-cron.design.md`

---

## Match Rate: 100%

## Summary

The implementation matches the approved design. It adds one bounded, server-only scheduler
adapter around the existing tenant cleanup transaction without changing the cleanup data model,
tenant boundary, QR quantity policy, or resident QR Worker state.

Production deployment and secret provisioning are intentionally excluded. Those remain manual
pilot gates governed by the deployment runbook.

## Implemented Items

- [x] Service-role-only due-tenant RPC with a `1..100` limit.
- [x] Active, non-deleted, never-run/oldest-due deterministic tenant selection.
- [x] Current-hour exclusion for tenants already recorded in the cleanup ledger.
- [x] Application coordinator with sequential execution and a bounded duration budget.
- [x] Stable version-8 UUID per tenant and UTC-hour window.
- [x] Per-tenant failure isolation and aggregate-only results.
- [x] Supabase repository adapter with strict UUID and result mapping.
- [x] Authorized `GET /api/internal/privacy-cleanup` route with `maxDuration = 60`.
- [x] Credential-free hourly UTC Vercel Cron manifest.
- [x] Static manifest verifier included in `pnpm verify`.
- [x] Production setup, monitoring, rotation, replay, and rollback runbook.
- [x] Unit, linked pgTAP, smoke E2E, secret, WCJ, type, lint, and build validation.

## Missing Items

None within the approved code-owned scope.

## Changed Items (Deviations from Design)

None.

## Verification Evidence

| Gate | Result |
| --- | --- |
| Focused application/config/handler unit tests | 30/30 PASS |
| Complete linked pgTAP suite | 22 files PASS; new Cron contract 16/16 PASS |
| Authenticated/local smoke E2E | 30/30 PASS |
| Full unit suite inside `pnpm verify` | 53 files, 326 tests PASS |
| Database static contract | 55 migrations, 22 database tests PASS |
| WCJ | 100; C100/J100/W100; 87 files |
| Production build | PASS |
| Full `pnpm verify` | PASS |

## Recommendations

1. Keep Production status at `AUTOMATED_READY / MANUAL_GATES_PENDING` until the runbook has been
   completed against the actual Production project.
2. Provision the Cron bearer only through the platform secret manager and record no value in Git,
   documentation, logs, or chat.
3. Verify the Production plan supports the approved hourly schedule before deployment.
4. Complete external SMS/CAPTCHA provider selection and the remaining device, accessibility,
   contrast, print, and operator rehearsal gates independently.

## Next Steps

- [x] Proceed to report because the design match rate is at least 90%.
