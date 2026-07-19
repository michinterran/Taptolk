# management-company-management - Plan

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for Phase 1 implementation
> Level: Enterprise

## 1. Purpose

슈퍼어드민이 활성 Tenant 아래 관리업체를 생성하고 기본 정보와 운영 상태를 관리하는
tenant-scoped vertical slice를 구축한다.

## 2. Scope

### In

- 전체 관리업체 catalog와 활성 Tenant 선택 목록
- 슈퍼어드민 전용 생성, 이름/사업자번호 수정, 상태 변경
- `ACTIVE`, `SUSPENDED`, `CLOSED` 전이와 낙관적 잠금
- Tenant 재배정 금지
- 원자적 감사로그, KO/EN UI, RLS/권한 검증

### Out

- 연락 담당자, 전화번호, 청구 이메일 입력
- Site 자동 생성이나 상태 cascade
- 계약·과금 설정
- Production 배포

연락처 필드는 암호화·보존·열람 정책이 확정된 뒤 별도 개인정보 command로 연결한다.

## 3. Command Contract

| Command | Permission | Input | Invariant |
|---|---|---|---|
| Create | `management-company:create` | tenantId, name, optional businessNumber, reason | Tenant ACTIVE |
| Update | `management-company:update` | companyId, expectedVersion, name, optional businessNumber, reason | tenantId immutable |
| Change Status | target별 `management-company:update`, `management-company:suspend`, `management-company:close` | companyId, expectedVersion, current/next status, reason | no ACTIVE Site |

## 4. Status Policy

- `ACTIVE → SUSPENDED | CLOSED`
- `SUSPENDED → ACTIVE | CLOSED`
- `CLOSED` is terminal.
- Reactivation requires an ACTIVE parent Tenant.
- Suspension/closure fails while an ACTIVE Site remains.

## 5. Acceptance Criteria

- `authenticated` cannot directly INSERT/UPDATE `management_companies`.
- Every successful command appends one redacted audit row in the same transaction.
- Cross-tenant reassignment is impossible because update has no `tenant_id` input.
- AAL1, Platform Operator, stale version, inactive Tenant, active child Site are rejected.
- WCJ, unit, DB contract, build, staging rollback verification pass.
