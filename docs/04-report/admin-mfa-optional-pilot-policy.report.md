# Admin MFA Optional Pilot Policy Report

## Plan

- Remove MFA as a mandatory gate for the current pilot because operator and management-company
  access must remain simple enough for early service validation.
- Preserve MFA as an optional hardening capability for later high-risk or production-grade
  operations.
- Keep the actual authorization boundary on the server: approved admin profile, active membership,
  role/scope policy, PostgreSQL RLS, and redacted audit.
- Do not weaken the public/contact, QR inventory, caller, Owner activation, notification/reply,
  or 1-100 per-Batch QR contracts.

## Do

- Changed the central admin permission catalog so no admin role currently requires MFA.
- Updated Auth, domain, and application tests so Super Admin, Management Admin, Site Admin, and
  Site Operator sessions are accepted at password-authenticated assurance when their server role
  and scope are approved.
- Added database migrations that remove AAL2 checks from existing admin command functions and
  Super Admin profile review policy while leaving role, scope, status, RLS, maker-checker, and
  audit checks in place.
- Added pgTAP coverage proving the pilot policy no longer contains the previous mandatory MFA
  checks for admin approval, tenant creation, QR inventory actor authorization, and Super Admin
  profile review.
- Updated authenticated staging E2E to prove role routing and operational data access without
  generating, logging, or requiring OTP/TOTP material.
- Updated KO/EN copy so administrator screens describe approval, role, scope, and password
  authentication instead of implying mandatory MFA.

## Check

- `corepack pnpm validate:wcj`: PASS; WCJ 100 over 101 files.
- `corepack pnpm typecheck`: PASS; 19/19 tasks.
- Focused unit tests: PASS for `@taptolk/domain`, `@taptolk/auth`, and `@taptolk/application`
  MFA/authorization coverage.
- `corepack pnpm db:reset:local`: PASS.
- Local pgTAP: PASS; 25 database files / 608 tests.
- Approved linked target check: PASS; `taptolk-staging` in Seoul was confirmed before linked
  database changes.
- Linked migrations: PASS; both pilot MFA optional migrations applied to `taptolk-staging`.
- `corepack pnpm db:test:linked`: PASS; all 25 linked pgTAP files.
- `corepack pnpm e2e:staging`: PASS; 31 passed, 1 intentional opt-in 1,000-item Worker acceptance
  skip.
  - Site Admin reaches the customer dashboard after password authentication.
  - Super Admin reaches the platform dashboard after password authentication.
  - Site Admin is still denied platform workspace access.
  - Approval-pending account is denied administrator workspaces and reads zero operational rows.
  - QR/caller/Owner/admin and tenant-isolation regressions remain green.
- `corepack pnpm verify:production-cron:deferred`: PASS; active Production Cron definitions remain
  zero.
- `corepack pnpm verify`: PASS.
  - lint: 342 files
  - typecheck: 19/19 tasks
  - unit: 57 files / 382 tests
  - DB static contract: 61 migrations / 25 database tests
  - secret scan: 584 text files
  - logo integrity: PASS
  - service-stage guard: PASS
  - Production Cron deferred verifier: PASS
  - WCJ: 100 / C100 / J100 / W100 over 101 files
  - production build: PASS

## Act

- Keep MFA optional through the pilot unless a later approved security policy reintroduces a
  mandatory gate for specific production or high-risk actions.
- Before public production traffic, decide whether Super Admin high-risk operations, bulk personal
  data access, provider credential changes, or production configuration changes should require
  step-up verification again.
- Continue manual desktop/mobile review for the Super Admin and contracted management-company
  dashboards, using aggregate observations only and without recording credentials, OTPs, cookies,
  tokens, phone numbers, or message bodies.
