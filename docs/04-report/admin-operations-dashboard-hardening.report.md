# Admin Operations Dashboard Hardening Report

## Plan

- Replace the generic administrator landing cards with decision-oriented operational dashboards.
- Keep the Super Admin platform workspace and contracted management-company workspace visibly and
  functionally separate.
- Reuse only server-authorized, PostgreSQL RLS-scoped operational aggregates.
- Move account identity and sign-out into the persistent left workspace rail.
- Replace internal-facing navigation vocabulary with clear KO/EN product language.

## Do

- Added a server-only operations-dashboard loader that preserves the existing application service,
  central RBAC authorization, repository boundary, and database RPC.
- Added separate platform and contracted-company dashboard compositions over the same authorized
  model: operating sites, active QR assets, contact requests, unresolved requests, owner response,
  completed batches, notification delivery, and open reports.
- Derived the attention queue only from real unresolved, escalation, delivery-failure, and report
  counts. No synthetic chart or fabricated business KPI was introduced.
- Added role-specific navigation and shortcuts. Only a server-confirmed Super Admin receives the
  account-approval entry.
- Changed visible terminology from tenant-oriented implementation language to customer organization,
  site, operations status, and QR production/inventory language while preserving internal routes,
  schema names, enum values, and the 1-100 per-Batch contract.
- Added typed Korean and English overview copy and parity tests.

## Check

- `corepack pnpm verify`: PASS
  - lint: 342 files
  - typecheck: 19/19 tasks
  - unit: 57 files / 382 tests
  - DB static contract: 59 migrations / 24 database tests
  - secret scan: 578 text files
  - WCJ: 100 / C100 / J100 / W100 over 101 files
  - production build: PASS
- `corepack pnpm e2e:smoke`: 42/42 PASS
- `corepack pnpm verify:production-cron:deferred`: PASS; active Production Cron definitions remain 0.
- The approved staging project already contains two operator-provided ACTIVE platform Super Admin
  accounts. One has a verified MFA factor; the other correctly requires first-login MFA enrollment.
- No Production deployment, Production secret, provider, plan, domain, or Cron setting changed.

## Act

- Deploy this checkpoint to Preview/staging only and rerun authenticated role-routing E2E against the
  deployed source.
- Manually review the platform and contracted-company dashboards at desktop and mobile widths without
  recording account identifiers or authentication material in screenshots or logs.
- A durable contracted-company test login still requires a user-approved email address. Do not invent
  an identity or reset an existing account password without that approval.
- QR production-order orchestration above 100 total items remains a separately approved feature; the
  current 1-100 child-Batch contract is unchanged.
