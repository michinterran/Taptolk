# management-company-management - Design

> Version: 1.0.0 | Date: 2026-07-19
> Plan: `docs/01-plan/features/management-company-management.plan.md`

## 1. Module Flow

```text
Management Company UI
→ localized Server Action
→ ManagementCompanyManagementService
→ central RBAC
→ Supabase command repository
→ restricted SECURITY DEFINER RPC
→ company row + redacted audit row
```

Catalog query와 command repository를 분리한다. UI 권한 숨김은 편의 기능이며 실제 권한은
Application Service와 PostgreSQL 함수에서 각각 재검증한다.

## 2. Field Contract

| Field | Contract |
|---|---|
| tenantId/companyId/requestId | UUID |
| name | trim, 1–200자 |
| businessNumber | optional, 숫자 10자리로 정규화 |
| expectedVersion | integer ≥ 1 |
| reason | trim, 3–500자 |

사업자번호는 표시 시 `000-00-00000` 형식으로 변환하되 DB에는 숫자만 저장한다.

## 3. Database Security

- browser table privilege: `SELECT` only
- table policy: `management_companies_select_scoped` only
- command function: `SECURITY DEFINER SET search_path = ''`
- `PUBLIC`, `anon` EXECUTE revoked
- authenticated entrypoint internally checks `auth.uid()`, AAL2, active PLATFORM SUPER_ADMIN
- Tenant is loaded from the target company for update/status; client cannot reassign it.

## 4. Audit Allowlist

Audit payload contains only `tenantId`, `name`, `businessNumber`, `status`, `version`.
Contact names, email addresses, phone numbers, Auth claims, secrets are excluded.

## 5. UI

- Platform console adds a Management Companies entry point.
- Create card requires active Tenant selection.
- Row details show tenant, normalized business number, status, created date.
- Super Admin receives edit/lifecycle forms; Platform Operator receives read-only catalog.
- `CLOSED` rows retain history and expose no mutation controls.
