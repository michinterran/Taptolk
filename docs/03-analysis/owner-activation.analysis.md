# Gap Analysis: Owner Activation

> Date: 2026-07-20
> Design: `docs/02-design/features/owner-activation.design.md`

## Match Rate: 96%

Phase 5 acceptance is complete. The implementation satisfies the required Phone OTP, activation
code, Owner/Vehicle/Binding transaction, ACTIVE transition, owner-scoped session, and PWA shell
contracts. The remaining differences are route/file naming and a future provider boundary, not a
reduction of the Phase 5 acceptance scope.

## Implemented items

### Domain and application policy

- Purpose-separated HMAC, encrypted phone/plate values, masked DTOs, and hash-only session/proof
  persistence.
- Fixed OTP TTL, cooldown, attempt, hourly, daily, device, and network policies.
- Typed inspection, OTP request/verification, activation completion, and owner vehicle read
  services.
- Raw OTP delivery is confined to the provider boundary and never reaches DB, audit, or logs.

### Database transaction and isolation

- Added Owner, device, vehicle relationship, OTP challenge, proof, and session tables.
- Added tenant/site/vehicle composite constraints, one active primary Owner relationship, RLS
  enable/force, service-only grants, and browser denial.
- Activation locks QR, code, proof, Binding, Vehicle, and Owner scope before mutation.
- One transaction creates/reuses Owner and Vehicle, creates Binding/relationship/session, consumes
  proof/code, transitions QR to ACTIVE, and writes a redacted audit row.
- Concurrent completion proves exactly one success and one conflict with one active Binding, one
  vehicle-owner relationship, one consumed proof, one used code, and one audit event.
- `ACTIVATION_PENDING` cannot persist from the command because both status log entries and the
  final ACTIVE update share the same transaction. An invalid pre-existing pending state fails the
  same-state log constraint and rolls back without partial rows.

### KO/EN web journey

- Added canonical `/ko|en/activate/{publicToken}` and `/ko|en/owner` routes.
- Added same-origin, no-store Route Handlers and HttpOnly, SameSite=Lax owner session cookie.
- Added typed KO/EN copy and `SemanticHeading` line groups.
- Added an offline owner shell that caches only public static assets and excludes activation
  tokens, API responses, and owner data.
- Preserved the immutable logo source byte-for-byte.

### Verification

- 43/43 Phase 5 pgTAP assertions passed on the linked staging database.
- Full linked pgTAP suite passed.
- Full authenticated staging E2E passed: 21 passed, 1 explicit 1,000-item acceptance skip.
- Owner staging E2E passed 2/2, including concurrent completion and cleanup.
- Axe reports zero violations; keyboard focus begins at activation code.
- Responsive overflow checks pass at 320, 768, 1280, and 1920 CSS pixels.
- WCJ remains 100/C100/J100/W100.

## Approved deviations

- HTTP routes use `/api/owner/*` instead of the design draft's `/api/v1/owner/*`. They remain
  typed and private to the same application boundary; API versioning is deferred until a public
  external API exists.
- Owner session composition is owned by `apps/web/owner/*` rather than a new `packages/auth`
  export because the current raw-cookie lifecycle is web-only.
- Staging uses a bounded in-memory mock OTP provider. Production refuses this mode and requires a
  real provider in Phase 7.
- Exact DB-command idempotency with a reused session hash is protected by the session uniqueness
  constraint, while the browser completion contract deliberately returns conflict for a competing
  request. A client-visible completion idempotency key is not required by Phase 5 acceptance.

## Evidence boundary

Automated browser checks cover keyboard order, axe, computed browser layout, and four responsive
widths. They do not constitute a physical screen-reader session or representative iOS/Android
real-device test. Those remain Phase 9 pilot-readiness gates.

## Recommendation

Close Phase 5 and begin Phase 6 Public Contact with a separate Plan/Design. Keep contact-session
creation, anonymous recovery cookie, message filtering, owner non-disclosure, and polling inside
one explicit service/RPC boundary.
