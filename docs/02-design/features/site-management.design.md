# site-management - Design

> Version: 1.0.0 | Date: 2026-07-19
> Plan: `docs/01-plan/features/site-management.plan.md`

## 1. Module Flow

```text
Localized Site UI
→ Site Server Action
→ SiteApplicationService
→ central RBAC and scope policy
→ Site command/query repository
→ restricted PostgreSQL RPC or scoped SELECT
→ Site row + redacted audit row
```

Catalog query와 command repository를 분리한다. UI 제어 숨김은 편의를 위한 것이며
Application Service와 PostgreSQL이 각각 독립적으로 권한을 검증한다.

## 2. Command Contracts

| Command | Mutable fields | Permission |
|---|---|---|
| Create | parent scope, name, type, address, timezone, contractVehicleLimit | `site:create` |
| Operational update | name, type, address, timezone | `site:update-operational` |
| Contract update | contractVehicleLimit | `site:update-contract` |
| Status change | status | `site:suspend-approve` or `site:archive-approve` |

## 3. Field Rules

| Field | Rule |
|---|---|
| UUID fields | RFC-compatible UUID |
| name | trim, 1–200 characters |
| siteType | `APARTMENT/OFFICETEL/BUILDING/OTHER` |
| address | optional, trim, at most 500 characters |
| timezone | valid IANA timezone, at most 64 characters |
| contractVehicleLimit | integer, 0–1,000,000 |
| expectedVersion | integer ≥ 1 |
| reason | trim, 3–500 characters |

`escalation_phone_encrypted`와 `settings`는 별도 개인정보·정책 command 전까지 이 UI에서
읽거나 수정하지 않는다.

## 4. Database Security

- `sites` browser table privilege is `SELECT` only.
- Existing `sites_select_scoped` RLS remains the catalog boundary.
- Command functions use `SECURITY DEFINER SET search_path = ''`, fully-qualified objects,
  `auth.uid()`, active membership, role, scope, and role-specific AAL checks.
- `PUBLIC` and `anon` EXECUTE are revoked explicitly.
- Parent Tenant and Management Company are loaded and validated inside create/reactivate.
- Update/status commands load immutable scope from the target row instead of trusting form scope.

## 5. Audit Allowlist

Audit payload contains identifiers only where required and operational fields:
`name`, `siteType`, `timezone`, `hasAddress`, `addressChanged`, `contractVehicleLimit`, `status`,
and `version`.

Full address, escalation phone, Auth claims, tokens, cookies, and secrets are excluded.

## 6. UI

- Canonical route: `/{locale}/admin/sites`
- Platform and scoped dashboards link to the same route.
- Catalog content is produced by RLS, never by frontend filtering.
- Controls are derived from central permission flags.
- Headline uses locale-authored semantic line groups.
- Closed rows remain visible as immutable history.
