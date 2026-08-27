# tenant-admin-foundation - Design

> Version: 1.0.0 | Date: 2026-07-18 | Status: Approved
> Plan: `docs/01-plan/features/tenant-admin-foundation.plan.md`

## 1. Architecture

```text
Admin UI / Route
→ Admin authentication assurance
→ Application service
→ RBAC domain policy
→ tenant-scoped repository transaction
→ PostgreSQL constraints + RLS
→ redacted audit record
```

Application authorization and RLS are independent controls. Service Role access never uses a
tenant or Site ID directly from client input without resolving trusted membership scope.

## 2. Entities

| Entity | Purpose |
|---|---|
| Tenant | Highest customer isolation boundary |
| ManagementCompany | Company operating one or more Sites |
| Site | Physical operating location |
| Contract | Plan and vehicle-capacity agreement |
| AdminProfile | 1:1 extension of `auth.users` |
| AdminMembership | User role plus explicit hierarchy scope |
| AuditLog | Redacted record of security-relevant mutations |

## 3. Integrity Strategy

- UUID primary keys and `timestamptz`.
- Tenant-scoped tables expose composite unique keys.
- Child composite foreign keys include `tenant_id`.
- Site references include tenant and management company.
- Membership uses explicit `scope_type` plus a role/scope check constraint.
- Slugs are case-insensitively unique through normalized indexes.
- Recoverable customer records use `deleted_at`; audit rows are append-only.
- `updated_at` and optimistic `version` are maintained by trigger.

## 4. Role and Scope

| Role | Allowed scope |
|---|---|
| SUPER_ADMIN | PLATFORM |
| PLATFORM_OPERATOR | PLATFORM |
| MANAGEMENT_ADMIN | MANAGEMENT_COMPANY |
| SITE_ADMIN | SITE |
| SITE_OPERATOR | SITE |
| READ_ONLY | TENANT, MANAGEMENT_COMPANY, or SITE |

MFA is required for SUPER_ADMIN, MANAGEMENT_ADMIN, and SITE_ADMIN. The application policy
returns both permission and required assurance; UI hiding alone is never authorization.

## 5. RLS

- RLS is enabled and forced on every browser-readable Phase 1 table.
- `app_private` security-definer helper functions resolve membership without recursive policy
  reads and use a fixed `search_path`.
- Authenticated users see only rows inside a matching active membership scope.
- Browser roles cannot insert audit logs.
- Site create/update is limited to platform roles in Phase 1; Management Admin creation remains
  an application approval workflow.
- Service Role remains server/worker only.

## 6. Audit Safety

`before_data` and `after_data` permit only redacted operational fields. A database constraint
rejects top-level keys matching phone, token, cookie, authorization, message, password, or
secret patterns. Full payload logging is forbidden.

## 7. Migration

Supabase migration files are the execution source of truth. Drizzle mirrors types and constraints
for application code. Migration order:

1. enums and helper functions
2. tables and composite constraints
3. indexes and triggers
4. grants and RLS policies
5. pgTAP isolation tests

Forward-fix is used after staging; Production dashboard schema edits are prohibited.

## 8. Test Plan

- Unit: role/permission/MFA policy matrix.
- Type: Drizzle entity inserts/selects.
- Static: explicit transaction, RLS markers, policy tests.
- pgTAP: cross-tenant read/write denial, same-scope access, audit append-only behavior.
- E2E after auth exists: role-specific Site CRUD and tenant isolation.

## 9. Current Constraint

Docker is unavailable, so migration runtime and pgTAP remain an external acceptance gate. Code
must not claim full Phase 1 completion until those tests and authenticated Site CRUD E2E pass.
