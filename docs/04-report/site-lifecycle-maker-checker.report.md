# site-lifecycle-maker-checker - Completion Report

> Date: 2026-07-19
> Status: Feature unit complete; overall Phase 1 remains open

## Summary

Tenant-owned Site lifecycle requests now provide a complete maker-checker path for suspend,
reactivate, and close. Request permissions no longer stop at a notice: authorized customer roles
can submit and cancel scoped requests, while separate platform approvers can approve or reject
them. Approval atomically changes the Site, terminalizes the request, and writes a redacted audit
event.

Design-to-code match rate is 100%.

## Related documents

- Plan: `docs/01-plan/features/site-lifecycle-maker-checker.plan.md`
- Design: `docs/02-design/features/site-lifecycle-maker-checker.design.md`
- Analysis: `docs/03-analysis/site-lifecycle-maker-checker.analysis.md`
- Schema: `docs/01-plan/schema.md`

## Completed scope

- Request entity, action/status enums, composite tenant/Site scope, terminal history
- Request/Site optimistic versions and one pending request per Site
- Request, approve, reject, cancel audited PostgreSQL commands
- Central RBAC, AAL, scope, state, parent, contract, maker-checker enforcement
- RLS visibility limited to request/reviewer roles
- Application Service, Supabase repository, server actions, unit tests
- KO/EN request controls, pending/cancel state, approval/rejection queue
- Staging Auth/TOTP E2E for Management Admin, Site Admin, and Super Admin
- Cross-tenant and sibling-Site tamper denial
- Redacted request/approval audit evidence and cleanup residue `0`

## Quality evidence

| Gate | Result |
|---|---|
| `pnpm verify` | Passed |
| Unit | 17 files, 80 tests passed |
| WCJ | W 100, C 100, J 100; 47 files |
| DB static contract | 17 migrations, 9 database tests |
| Desktop/Mobile smoke | 26 passed |
| Staging authenticated Site E2E | 4 passed |
| Staging migration alignment | 17 local = 17 remote |
| Staging fixture residue | Tenant/company/Site/profile/request/audit/Auth user all 0 |
| Secret scan | 243 text files passed |
| Logo integrity | Required SHA-256 passed |
| Production build | Passed |

## Security decisions

- Existing direct lifecycle permissions were not widened.
- Site Operator and Read Only do not query or receive lifecycle request reasons.
- Requester and checker identities must differ in Application and PostgreSQL.
- Failed stale approval leaves the request pending because the transaction rolls back.
- Audit JSON includes action/status/version only; reason uses its dedicated column.

## Open gates

- Docker is not installed, so Supabase Local reset and local pgTAP runtime remain open.
- Keyboard, screen-reader, computed contrast, responsive real-device, and real-journey manual
  review remain separate from automated WCJ.
- Supabase Advisor SECURITY DEFINER review, leaked-password protection, MFA recovery, and Admin
  idle timeout remain open.

## Next development step

Implement the QR inventory and batch lifecycle vertical slice, beginning with Plan/Design for
`StickerDesignVersion`, `QrBatch`, and `QrAsset` authority/state boundaries. Keep actual bulk
generation behind Super Admin final approval and preserve the existing request/sample/final
approval permission split.
