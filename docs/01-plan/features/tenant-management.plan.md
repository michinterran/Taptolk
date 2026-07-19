# tenant-management - Plan

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for Phase 1 implementation
> Level: Enterprise

## 1. Purpose

슈퍼어드민이 Tenant를 생성하고 기본 정보를 수정하며 운영 상태를 변경하는 첫 번째
end-to-end 관리 흐름을 구축한다. 모든 변경은 Application Service와 단일 PostgreSQL
transaction을 통과하고 감사 로그와 함께 원자적으로 저장한다.

## 2. Scope

### In

- 슈퍼어드민 전용 Tenant 생성, 이름/slug 수정, 상태 변경
- `ACTIVE`, `SUSPENDED`, `CLOSED` 상태 전이 정책
- 낙관적 잠금(`expectedVersion`)
- KO/EN 관리 UI와 의미 단위 제목 줄바꿈
- 직접 테이블 mutation 차단 및 RPC 최소 권한
- pgTAP, domain/application unit test, WCJ 검증

### Out

- Tenant 물리 삭제
- Management Company/Site 자동 생성
- 계약 및 과금 정보 변경
- Production 배포

## 3. Command Contract

| Command | Permission | Required input | Result |
|---|---|---|---|
| Create Tenant | `tenant:create` | name, slug, reason, requestId | ACTIVE Tenant |
| Update Tenant | `tenant:update` | tenantId, expectedVersion, name, slug, reason, requestId | incremented version |
| Change Status | `tenant:suspend` or `tenant:close` | tenantId, expectedVersion, nextStatus, reason, requestId | incremented version |

`PLATFORM_OPERATOR`는 목록 조회만 가능하다. 모든 command는 `PLATFORM` 범위,
`SUPER_ADMIN`, AAL2를 서버와 데이터베이스에서 각각 재검증한다.

## 4. Status Policy

- `ACTIVE → SUSPENDED | CLOSED`
- `SUSPENDED → ACTIVE | CLOSED`
- `CLOSED`는 종결 상태이며 다른 상태로 전환할 수 없다.
- 상태 변경은 물리 삭제나 `deleted_at` 변경을 수행하지 않는다.

## 5. Acceptance Criteria

- 브라우저 세션은 `public.tenants`에 직접 INSERT/UPDATE할 수 없다.
- 정상 command는 Tenant row와 Audit row를 같은 transaction에서 기록한다.
- 권한 부족, AAL1, 잘못된 상태 전이, version conflict는 변경 없이 실패한다.
- slug는 소문자 ASCII, 숫자, 하이픈만 허용하고 활성 Tenant 간 유일하다.
- KO/EN UI, WCJ, unit test, pgTAP contract, build가 통과한다.

## 6. Risks and Controls

| Risk | Control |
|---|---|
| SECURITY DEFINER 권한 상승 | 빈 search path, schema-qualified object, 내부 actor 재검증, EXECUTE 최소 grant |
| 동시 수정 유실 | expectedVersion 조건부 UPDATE |
| 상태 오작동 | 명시적 전이 행렬, CLOSED terminal |
| 감사 누락 | mutation과 audit insert를 동일 함수 transaction에 포함 |
| 개인정보 기록 | audit payload allowlist와 기존 redaction constraint 유지 |
| UI 권한 숨김 의존 | Domain policy, DB actor check, table privilege의 3중 통제 |

## 7. References

- Master Spec §6.1, §8.1–8.3, §9.4–9.5, Phase 1
- `docs/01-plan/schema.md`
- `docs/02-design/features/tenant-admin-foundation.design.md`
