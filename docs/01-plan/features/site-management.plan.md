# site-management - Plan

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for Phase 1 implementation
> Level: Enterprise

## 1. Purpose

Tenant와 Management Company 아래 실제 운영 장소인 Site를 역할·scope에 맞게 조회하고
생성, 운영정보 수정, 계약 차량 한도 변경, 상태 전이할 수 있는 Phase 1 vertical slice를
구축한다.

## 2. Scope

### In

- RLS가 적용된 역할별 Site catalog
- Super Admin의 ACTIVE Management Company 아래 직접 생성
- 운영정보: 이름, 유형, 주소, timezone
- Super Admin 전용 계약 차량 한도 변경
- Super Admin의 중지·재개·종료
- Platform Operator의 중지·재개
- Management Admin과 Site Admin의 허용 scope 운영정보 수정
- 낙관적 잠금, 원자적 감사로그, KO/EN UI

### Out

- Site 생성·중지·종료 요청/승인 큐
- Site Admin 초대와 membership 변경
- 메시지 정책과 escalation 전화번호
- Contract 원장 생성·과금
- QR Batch 발행
- Production 배포

요청 권한은 중앙 RBAC에 유지하되 요청 레코드와 maker-checker 상태 모델이 도입되기
전까지 직접 mutation으로 대체하지 않는다.

## 3. Role Matrix

| Action | Super | Platform Operator | Management Admin | Site Admin | Site Operator | Read Only |
|---|---:|---:|---:|---:|---:|---:|
| Scoped catalog | O | O | Company | Own Site | Own Site | Allowed scope |
| Direct create | O | X | X | X | X | X |
| Operational update | O | O | Company | Own Site | X | X |
| Contract vehicle limit | O | X | X | X | X | X |
| Suspend/reactivate | O | O | Request only | Request only | X | X |
| Close | O | Request only | Request only | X | X | X |

## 4. Lifecycle

- `ACTIVE → SUSPENDED | CLOSED`
- `SUSPENDED → ACTIVE | CLOSED`
- `CLOSED` is terminal.
- Create/reactivate requires ACTIVE Tenant and ACTIVE Management Company.
- `tenant_id` and `management_company_id` are immutable after creation.
- Physical delete and lifecycle cascade are prohibited.

## 5. Acceptance Criteria

- `authenticated` has `SELECT` only on `sites`; all mutation enters reviewed RPC commands.
- Role, AAL, Tenant, Management Company, and Site scope are rechecked inside PostgreSQL.
- Cross-tenant parent combinations are rejected by composite FK and command validation.
- Operational update cannot modify contract limit, status, parent scope, settings, or encrypted data.
- Every successful command appends exactly one redacted audit row in the same transaction.
- Stale versions, inactive parents, invalid timezone, and forbidden roles are rejected.
- Scoped SQL runtime tests prove Management/Site membership isolation with rollback residue `0`.
- Unit, WCJ, build, E2E, DB contract, logo, and secret gates pass.
