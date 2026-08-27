# Gap Analysis: Public Landing and Onboarding

> Date: 2026-07-20 | Design:
> `docs/02-design/features/public-landing-onboarding.design.md`

---

## Match Rate: 100%

## Summary

The implementation matches the approved public-surface design. The internal Phase/Foundation
screen is replaced by a localized product landing, `/{locale}/onboarding` provides four explicit
role paths, and customer administrator and Taptolk platform administrator login entry points are
separate before the existing shared authentication and authorization boundary.

No provider, Production data, secret, Cron, token, or QR quantity policy was added or changed.

## Implemented Items

- [x] Public KO/EN landing at `/{locale}` without Phase or implementation-status copy.
- [x] Role-based onboarding for caller, vehicle owner, customer administrator, and platform
      administrator.
- [x] QR/token-led caller and owner guidance without a generic tokenless contact start.
- [x] Separate customer and platform administrator login URLs and localized headings.
- [x] Shared `AdminLoginScreen` with unchanged sign-in, callback, MFA, RBAC, and RLS boundaries.
- [x] Login-area preservation through password, Google, callback, and registration error paths.
- [x] Typed KO/EN copy and meaning-based `SemanticHeading` line groups.
- [x] Responsive public layout, keyboard-visible links, Axe coverage, and 320px overflow checks.
- [x] WCJ source checks for public route purpose, onboarding markers, and platform login split.
- [x] Pilot checklist and closeout-report evidence updates.

## Missing Items

None within the approved code-owned scope.

## Changed Items (Deviations from Design)

None. An initial automated contrast finding on the orange QR motif was corrected before final
validation by using the accessible ink color for the text.

## Verification Evidence

| Gate | Result |
| --- | --- |
| Focused landing/onboarding browser coverage | KO/EN, Axe, semantic copy, and 320px overflow PASS |
| WCJ | 100; C100/J100/W100; 91 files |
| Linked pgTAP | All 22 database test files PASS |
| Full unit suite inside `pnpm verify` | 53 files, 326 tests PASS |
| Database static contract | 55 migrations, 22 database tests PASS |
| Secret scan | 526 text files PASS |
| Production build | PASS |
| Full `pnpm verify` | PASS |
| Authenticated staging full suite | 28 PASS; one intentional opt-in 10x100 skip |

## Staging Reliability Note

Two complete authenticated-staging attempts exercised all affected public, owner, QR, and Site
journeys. Each encountered a different one-off linked-service timing failure after the relevant
landing/auth changes had passed: one TOTP validity-window race and one Supabase
`UNAVAILABLE` page query during the QR concurrency scenario. The TOTP fixture now requires at
least eight seconds of validity. The complete public-contact serial file subsequently passed
5/5, and the complete QR-inventory serial file passed 15/15 on a clean fixture, including the
previously interrupted concurrency and cleanup scenarios. A final complete staging run then
passed 28 scenarios with only the intentional opt-in 10x100 acceptance test skipped.

## Recommendations

1. Keep platform/customer login separation as a routing and content distinction only; central
   RBAC and PostgreSQL RLS remain authoritative.
2. Do not expose tokenless caller or activation starts as later onboarding content expands.
3. Keep Production provider and Cron claims out of the public surface until their external gates
   are explicitly approved and verified.
4. Complete real-device, screen-reader, computed-contrast, and headline-rhythm review at the
   manual pilot gate.

## Next Steps

- [x] Proceed to report because the design match rate is at least 90%.
