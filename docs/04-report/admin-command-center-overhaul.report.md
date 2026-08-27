# Admin Command Center Overhaul Report

## Plan

- Match the operator-provided command-center reference with a compact, table-first administration
  system instead of oversized marketing-style administrator pages.
- Model the visible hierarchy as management company to managed locations while preserving
  `tenant_id` as the highest server and database isolation boundary.
- Give Super Admins platform-wide operations, revenue, administrator-directory, and customer
  portfolio controls; keep management-company and site roles inside their approved scope.
- Turn QR production into a guided workflow while preserving the 1-100 per-Batch contract.
- Add useful operational and financial analysis without fabricating unavailable business data.

## Do

- Rebuilt the shared administrator shell with compact role-aware navigation, account/profile access,
  scope status, KO/EN copy, and Phosphor icons.
- Added server-authorized management-company and managed-location detail workspaces with editable
  names, operating summaries, QR/contact/service-quality signals, and scoped navigation.
- Added operational charts, report views, a platform administrator directory, delegated
  account-permission rules, and editable profile names. Account email remains read-only; phone data
  was not added before an encrypted-storage and provider decision.
- Added versioned monthly active-vehicle pricing and revenue projection. The default business value
  is stored as versioned database data, not hardcoded UI copy, and projected revenue is explicitly
  separated from recognized or settled revenue.
- Rebuilt QR production as a six-step flow with four real renderer-backed template previews,
  approved/uploaded brand assets, quantity presets and stepper, review/approval, production, and
  delivery/inventory tracking. A total request up to 10,000 is atomically split into child Batches
  of no more than 100 each.
- Added PostgreSQL migrations, RLS-aware read models, same-transaction redacted audit writes, and
  pgTAP coverage for QR series requests, command-center metrics, revenue pricing, and administrator
  directory/profile behavior.

## Check

- Clean local database reset: PASS through 65 migrations.
- Local pgTAP: PASS, 29 files / 636 tests.
- Linked `taptolk-staging` pgTAP: PASS, all 29 files; no Production project was selected.
- Authenticated staging E2E: 31 passed, 1 intentional opt-in 10x100 Worker acceptance skip.
  - Site Admin reached the customer dashboard and was denied the platform workspace.
  - Super Admin reached the platform dashboard.
  - Approval-pending account was denied all administrator workspaces and read zero operational rows.
  - QR design, independent approval, Batch series request, sample/final approval, generation,
    receipt, assignment, CSV, replacement, revocation, audit, cleanup, caller, Owner, and Site
    isolation regressions passed.
- `corepack pnpm verify`: PASS.
  - lint: 381 files
  - typecheck: 19/19 tasks
  - unit: 60 files / 391 tests
  - DB static contract: 65 migrations / 29 database tests
  - secret scan: 633 text files
  - logo integrity and SERVICE fail-closed boundary: PASS
  - WCJ: 100 / C100 / J100 / W100 over 124 files
  - production build: PASS
- `corepack pnpm verify:production-cron:deferred`: PASS; active Production Cron definitions remain
  zero.
- Same-viewport browser comparison plus 320/768/1280 responsive review: PASS; details are in
  `design-qa.md`.

## Act

- Published commit `6c96677` to Vercel Preview only. Deployment
  `dpl_1YEEphMPg7SUYeEr5tDaFmXbwbvN` is `READY`; protected KO/EN public, administrator-login, and
  health entries return the expected Vercel SSO redirect. GitHub Actions `29847699333` passed.
- Keep Production deployment, `taptolk.com` connection, Production Supabase selection/secrets,
  provider setup, plan changes, and Cron activation behind separate operator approval.
- Before commercial operation, confirm licensed brand artwork, tax-invoice/print-vendor workflow,
  delivery-confirmation ownership, encrypted phone-storage policy, physical 85mm output, real-device
  accessibility, and monitoring/rollback/incident owners.
- Do not describe revenue projections as invoices, settlements, or recognized revenue until the
  corresponding contract and accounting workflow exists.
