# Gap Analysis: admin-console-architecture

> Date: 2026-07-20 | Design:
> `docs/02-design/features/admin-console-architecture.design.md`

## Match Rate: 100%

## Summary

The approved feature is an architecture contract, not a promise that every future Admin domain
route is already implemented. The Plan explicitly excludes full Admin UI, API, repository, and
Production setup. Against that approved boundary, all 10 success criteria are covered by the
Design and the implemented vertical slices preserve the contract.

## Implemented Items

- [x] Platform, Management Company, and Site console purposes and trust boundaries are defined.
- [x] Every planned route has a purpose, role boundary, scope, data responsibility, and action
      model.
- [x] Super Admin, Management Company, Site, Operator, and Read Only responsibilities are
      separated in the central permission design.
- [x] Dashboard metrics define calculation semantics, window, freshness, status, and drill-down.
- [x] PII, message, export, destructive action, audit, and maker-checker policies are explicit.
- [x] Loading, empty, unavailable, partial, stale, forbidden, conflict, error, and success states
      are defined.
- [x] Typed KO/EN copy, semantic heading, responsive, keyboard, and accessibility contracts are
      defined.
- [x] Vertical-slice delivery order is defined from Admin context through later domain modules.
- [x] Subsequent Auth, Site, QR, escalation, and operations slices use the central RBAC,
      repository, PostgreSQL RLS, and redacted-audit boundaries.
- [x] The 320px Auth shell regression is covered by Desktop and Mobile Chromium tests.

## Deviations from Design

- Some shipped routes consolidate multiple planned domain views into the current Site, QR
  inventory, and operations surfaces. This is an implementation-sequencing choice, not an
  architecture-contract gap.
- Full VoiceOver/TalkBack, computed-contrast, and real-device review remain Pilot gates and are not
  converted into automated claims.

## Evidence

- `packages/domain/src/admin-permission-catalog.ts`
- `packages/domain/src/admin-rbac.test.ts`
- `docs/04-report/site-management-authenticated-e2e.report.md`
- `docs/04-report/phase-2-4-implementation.report.md`
- `docs/04-report/analytics-hardening.report.md`
- `e2e/phase-0-health.spec.ts`
- `e2e/staging/`

## Recommendation

Close the architecture PDCA as complete. Continue individual Admin domain modules under their own
feature PDCA and keep the Pilot manual gates in the readiness checklist.
