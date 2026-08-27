# Gap Analysis: site-lifecycle-maker-checker

> Date: 2026-07-19
> Design: `docs/02-design/features/site-lifecycle-maker-checker.design.md`

## Match Rate: 100%

34 implementation items were compared with the approved Design and all 34 are present.

## Implemented items

### Domain and application

- Explicit `SUSPEND`, `REACTIVATE`, `CLOSE` action model
- Explicit pending and terminal request states
- Request/review/cancel permission mapping without direct permission changes
- Site/request optimistic version validation
- Application-layer role, MFA, scope, transition, self-review, and requester checks
- Request read model with approval queue, pending-by-Site, and cancellable ownership
- Site Operator/Read Only early return before request repository access
- Unit coverage for request matrix, transition, MFA, approval filtering, self-review, cancel
  ownership, and non-participant visibility

### PostgreSQL

- Tenant-owned request table, enums, composite Site FK, constraints, timestamps, version
- Site-level partial unique index for one pending request
- RLS with request/reviewer roles only
- Authenticated `SELECT` only; no browser table mutation
- Request, approve, reject, and cancel SECURITY DEFINER commands
- Same-transaction request/Site/audit mutation
- Terminal request immutability guard
- Requester/approver separation, AAL, role, scope, transition, parent, active-contract, and
  optimistic version revalidation
- Redacted audit allowlist
- pgTAP contract for schema, RLS, privileges, functions, and anonymous denial
- Drizzle schema parity

### Web

- Authenticated Supabase query/command repository
- Server actions with PRG status and bounded error mapping
- KO/EN request, pending, cancel, approval, and rejection copy
- Request-only role controls replacing the previous notice-only state
- Super/Platform action-filtered approval queue
- Existing direct lifecycle controls unchanged
- WCJ 100 for W/C/J

### Acceptance evidence

- Management Admin scope request and cross-tenant tamper denial
- Site Admin exact-Site request and sibling tamper denial
- Super Admin independent approval
- Approved Site transition and request status
- Request/approval actor separation and audit redaction
- Staging cleanup residue `0`
- Unit, type, lint, build, static DB, secret, logo, WCJ, Desktop/Mobile smoke gates

## Changed items

- The initial Design wording allowed generic customer-role reads. Security review narrowed direct
  request-row visibility to `SUPER_ADMIN`, `PLATFORM_OPERATOR`, `MANAGEMENT_ADMIN`, and
  `SITE_ADMIN`. Site Operator and Read Only do not query or receive request reasons.
- The authenticated E2E validates self-review separation through distinct customer makers and a
  Super checker. The direct self-review branch is covered by Application unit policy and the DB
  command guard because the Super UI intentionally does not expose duplicate request controls
  where direct authority already exists.

## Open external acceptance gate

Supabase Local reset and pgTAP runtime remain unexecuted because the `docker` executable is not
installed. This is not a Design-to-code gap and does not permit a Phase 1 completion claim.
Staging migrations `20260719030000` and `20260719032200` were applied and the authenticated
browser journey passed.

## Recommendation

Proceed to the completion report for this feature unit. Keep overall Phase 1 open until Docker
Local migration reset and pgTAP runtime pass.
