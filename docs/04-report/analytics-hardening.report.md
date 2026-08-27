# Phase 9 Analytics and Hardening Completion Report

> Date: 2026-07-20 | Status: Automated staging ready; manual/external gates pending

## Outcome

Taptolk now has an authenticated, Site-scoped operating dashboard for the last 24 hours of contact
volume, unresolved work, office alerts, Owner response time, notification delivery, provider cost
coverage, reports, blocks, active QR inventory, and completed batches. The dashboard exposes
counts and freshness only.

The privacy cleanup path is Cron-authorized, tenant-bounded, idempotent, and auditable. It expires
open Sessions, revokes expired Response Tokens and blocks, and changes only aged message bodies to
the fixed redaction marker while retaining the original body hash and all required history.

## Automated evidence

- Phase 9 pgTAP: 40/40 PASS; complete linked suite PASS.
- Authenticated Phase 9 staging journey: PASS.
- Cleanup ledger/audit/idempotency: PASS.
- KPI Site scope and RLS: PASS.
- 100-request bounded load: zero errors, p95 below 2 seconds.
- Security headers and response sensitive-field scan: PASS.
- 100-item print source: 100/100 decode, four 85mm templates, 17-page A4 PDF, checksums 4/4.
- Responsive operations dashboard: 320/768/1280/1920 PASS.
- Axe: zero violations.
- Full authenticated staging E2E: 28 PASS; the opt-in 1,000-item acceptance remains intentionally
  skipped in the default suite and has separate completed evidence.
- WCJ: 100 / C100 / J100 / W100.
- Final `pnpm verify`: lint 312 files, typecheck 19/19, unit 312/312, DB structure 54
  migrations/21 tests, secret scan 491 files, immutable logo verification, and production build
  PASS.

## Cost boundary

The dashboard reports only cost values recorded by the provider ledger and separately counts sent
deliveries whose cost is missing. The staging provider does not establish a production billing
rate, so no production cost claim is made.

## Pilot status

`AUTOMATED_READY / MANUAL_GATES_PENDING`

See `docs/deployment/pilot-readiness-checklist.md`. Production provider credentials, real-device
and screen-reader sessions, physical 85mm output, and production deployment/Cron configuration
must be completed by the user-owned pilot window.
