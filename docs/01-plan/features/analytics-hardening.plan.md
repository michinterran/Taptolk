# Analytics and Hardening - Phase 9 Plan

> Version: 1.0.0 | Date: 2026-07-20 | Authority: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`

## Goal

Complete the automated Phase 9 operating surface: scoped KPI and cost visibility, auditable
privacy cleanup, bounded load/security/print-source checks, and a deterministic pilot-readiness
snapshot. Automated success must not be reported as physical device, screen-reader, or printer
acceptance.

## Scope

- Site-scoped KPI dashboard for sessions, response time, escalations, notifications, reports,
  active QR inventory, generation completion, and provider cost.
- Hourly aggregate snapshots with no message, phone, token, cookie, or raw network data.
- Tenant-scoped cleanup command driven by typed retention values, preserving session/QR history
  while redacting expired message bodies and revoking expired recovery/block state.
- Cron-authorized cleanup route and application service.
- Staging seed/evidence snapshot and automated load, security-header, responsive, accessibility,
  QR-decode, checksum, and print-source geometry checks.
- KO/EN operations dashboard with loading, empty, partial/error-safe, and action-oriented states.
- Pilot-readiness checklist that separates automated PASS from external/manual gates.

## Out of scope

- Changing the approved 1-100 Batch quantity policy.
- Production credentials, live provider billing, or production data seeding.
- Claiming representative iOS/Android, physical 85mm output, or hands-on screen-reader acceptance
  without the user's devices and operator.
- Destructive deletion of QR Assets, bindings, expired sessions, audits, Queue archives, or other
  required history.

## Acceptance

1. Authenticated Admin sees only centrally authorized Site scope.
2. KPI/cost results contain no sensitive payloads and have an explicit freshness timestamp.
3. Cleanup expires sessions, revokes expired response tokens/blocks, redacts aged message bodies,
   writes one run ledger and one redacted audit, and is idempotent.
4. Load/security/print-source verification is bounded, reproducible, and secret-free.
5. Pilot snapshot proves all automated gates and lists every external/manual gate as pending.
6. Linked pgTAP, authenticated staging E2E, full staging E2E, WCJ, and `pnpm verify` pass.

## Risks

- Analytics queries can load OLTP tables: constrain to authorized sites and bounded windows.
- Cleanup can destroy evidence: redact only body content and preserve hashes, rows, audits, and
  terminal histories.
- A synthetic load pass can be mistaken for capacity certification: report its exact bounded
  workload and keep production capacity approval separate.
- Provider cost can be incomplete: expose recorded cost and an explicit missing-cost count.
