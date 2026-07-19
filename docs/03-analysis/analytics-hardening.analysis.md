# Gap Analysis: analytics-hardening

> Date: 2026-07-20 | Design: `docs/02-design/features/analytics-hardening.design.md`

## Match Rate: 94%

## Summary

The automated Phase 9 operating surface is complete: scoped KPI/cost read model, KO/EN Admin
dashboard, hourly snapshots, Cron-authorized privacy cleanup, immutable-history redaction,
idempotent run ledger, Pilot readiness snapshot, bounded load/security checks, and print-source
QA. External provider and physical/manual acceptance correctly remain open.

## Implemented Items

- [x] Authenticated Site-scoped KPI and recorded-cost dashboard with explicit missing-cost count.
- [x] Hourly idempotent metric snapshots protected by forced RLS.
- [x] Tenant-bounded cleanup with typed environment retention inputs and Cron Bearer policy.
- [x] Expired Session transition, Response Token and caller-block revoke, aged-message redaction.
- [x] Original message hash, Contact Session, QR Asset, Queue archive, and audit history preserved.
- [x] Cleanup request idempotency, run ledger, and redacted same-transaction audit.
- [x] Pilot readiness snapshot that never promotes manual device/print gates to PASS.
- [x] 100-request bounded health load, zero-error threshold, security headers, sensitive-field scan.
- [x] 100-item 85mm print source, QR decode 100/100, PDF geometry, and checksum verification.
- [x] Authenticated operations dashboard at 320/768/1280/1920 with axe violations zero.

## Open Items

- [ ] Real domestic SMS provider cost and billing reconciliation.
- [ ] Production CAPTCHA provider.
- [ ] Representative iOS/Android QR decode and full journey.
- [ ] Hands-on screen-reader and computed-contrast review.
- [ ] Physical 85mm printer output and operator sign-off.
- [ ] Production deployment/environment/Cron scheduling.

## Deviations

- The synthetic load gate is intentionally 100 requests with concurrency 10; it is a regression
  gate, not production capacity certification.
- The print gate validates actual generated artifacts and 85mm PDF source geometry, not a physical
  printer result.
- Standard Storage upload remains accepted for the proven 100-item per-Batch artifacts. A TUS
  switch above the reviewed large-file threshold remains a production reliability decision.

## Evidence

- Phase 9 linked pgTAP: 40/40 PASS.
- Complete linked pgTAP suite: PASS.
- Public Contact / Phase 8-9 staging journey: 5/5 PASS.
- Cleanup: expired Session 1, redacted body 1, revoked block 1, expired tokens at least 1,
  repeated request idempotent, residue zero.
- Operations dashboard: authenticated Site Admin, Site count 1, cross-scope identifiers absent,
  four responsive widths PASS, axe 0.
- Phase 9 hardening: health load 100, errors 0; print items 100, decode 100/100, PDF pages 17,
  checksums 4/4.
- Full authenticated staging E2E: 28 PASS, one intentional opt-in 1,000-item acceptance skip.
- Final `pnpm verify`: lint 312 files; typecheck 19/19; unit 312/312; DB structure 54
  migrations/21 tests; secret scan 491 files; WCJ 100; production build PASS.

## Recommendation

Automated Phase 9 is complete. Pilot status is `AUTOMATED_READY / MANUAL_GATES_PENDING`, not
production-ready.
