# tenant-management - Design

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for Phase 1 implementation
> Plan: `docs/01-plan/features/tenant-management.plan.md`

## 1. Module Flow

```text
Tenant CRUD UI
→ localized Server Action
→ TenantManagementService
→ central RBAC policy
→ Supabase TenantManagementRepository
→ restricted SECURITY DEFINER RPC
→ Tenant mutation + redacted AuditLog in one transaction
```

목록 조회는 기존 `TenantCatalogService`와 RLS `SELECT` 경로를 유지한다. Command와
Query repository를 분리하여 조회 모델이 mutation 권한을 갖지 않게 한다.

## 2. Validation

| Field | Contract |
|---|---|
| name | trim, 1–200자 |
| slug | trim/lowercase, 2–63자, `^[a-z0-9][a-z0-9-]*[a-z0-9]$` |
| reason | trim, 3–500자 |
| tenantId/requestId | UUID |
| expectedVersion | 1 이상의 정수 |

Application Service와 PostgreSQL 함수가 동일한 경계를 검증한다. DB 오류는 repository에서
`CONFLICT`, `FORBIDDEN`, `UNAVAILABLE`로 축약하고 사용자에게 원문 SQL 오류를 노출하지 않는다.

## 3. Database Security

- `authenticated`의 Tenant table 권한은 `SELECT`만 유지한다.
- 기존 Tenant INSERT/UPDATE RLS policy는 제거한다.
- 각 command 함수는 `SECURITY DEFINER SET search_path = ''`를 사용한다.
- 함수는 `auth.uid()`, JWT `aal2`, 활성 PLATFORM SUPER_ADMIN membership을 직접 확인한다.
- `PUBLIC`, `anon`의 EXECUTE를 revoke하고 `authenticated`, `service_role`만 grant한다.
- audit payload에는 name, slug, status, version만 기록하며 이메일/전화/토큰은 기록하지 않는다.

## 4. Concurrency

Update와 status command는 `id + expectedVersion + deleted_at is null` 조건으로 UPDATE한다.
영향 행이 없으면 존재 여부를 확인해 `TENANT_NOT_FOUND` 또는 `VERSION_CONFLICT`를 구분한다.
기존 version trigger가 성공한 UPDATE의 version을 1 증가시킨다.

## 5. UI States

- Super Admin: 생성 form, row별 정보 수정, 상태 전이 controls.
- Platform Operator: 동일 catalog를 read-only로 확인.
- Empty: 첫 Tenant 생성의 목적과 다음 단계 안내.
- Success: PRG query status banner.
- Validation/conflict/forbidden/unavailable: localized alert banner.
- CLOSED row: 정보와 감사 이력은 유지하지만 command controls는 표시하지 않는다.

## 6. Test Matrix

- Domain: Tenant mutation permissions are Super Admin only.
- Application: normalization, invalid input, authorization, repository command mapping.
- pgTAP: table privileges, policies, function privileges and SECURITY DEFINER contract.
- Staging transaction: success+audit, AAL1 denial, Platform Operator denial, stale version rollback.
- UI: KO/EN copy, labels, semantic headings, keyboard-operable details, WCJ.
