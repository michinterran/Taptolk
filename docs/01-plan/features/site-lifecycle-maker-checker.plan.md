# site-lifecycle-maker-checker - Plan

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for Phase 1 implementation
> Level: Dynamic

## 1. Purpose

직접 Site 상태 변경 권한이 없는 고객 관리자와 제한된 플랫폼 운영자가 허용된
scope에서 중지·재개·종료를 요청하고, 별도 승인자가 검토해 원자적으로 반영하는
maker-checker vertical slice를 구축한다.

## 2. Scope

### In

- Tenant-owned `site_lifecycle_requests` entity와 RLS
- `SUSPEND`, `REACTIVATE`, `CLOSE` 요청
- `PENDING → APPROVED | REJECTED | CANCELLED` 명시적 상태 전이
- 요청, 승인, 거절, 요청자 취소 command
- Site target version과 요청 row version의 독립적인 낙관적 잠금
- requester/approver 분리, 중앙 RBAC, scope, AAL 재검증
- Site 상태 변경과 request/audit 변경의 단일 PostgreSQL transaction
- KO/EN 요청 controls, pending request 상태, 승인 queue
- pgTAP contract와 authenticated staging tenant-isolation E2E

### Out

- 기존 Super Admin 및 Platform Operator 직접 lifecycle 권한 변경
- Site 생성 요청/승인
- Management Company와 Tenant lifecycle 요청
- QR Batch·Asset approval
- 다단계 승인, delegation, SLA 알림, comment thread
- Production 배포

## 3. Role and action matrix

| Action | Request permission | Approval permission | Valid Site state |
|---|---|---|---|
| Suspend | `site:suspend-request` | `site:suspend-approve` | `ACTIVE` |
| Reactivate | `site:suspend-request` | `site:suspend-approve` | `SUSPENDED` |
| Close | `site:archive-request` | `site:archive-approve` | `ACTIVE`, `SUSPENDED` |

- Super Admin은 기존 direct 권한을 유지한다.
- Platform Operator는 중지·재개를 직접 수행할 수 있고 종료만 요청한다.
- Management Admin은 소속 Management Company Site의 세 action을 요청할 수 있다.
- Site Admin은 자신의 Site 중지·재개만 요청할 수 있다.
- 요청자는 자신이 만든 요청을 승인하거나 거절할 수 없다.
- Terminal request는 다시 처리할 수 없고 history로 보존한다.

## 4. Data and state contract

`site_lifecycle_requests`는 `tenant_id`를 최상위 격리 경계로 가지며
`tenant_id + management_company_id + site_id` composite FK로 Site scope를 고정한다.
요청 당시의 `site_version`을 저장하고 승인 시 현재 Site version과 일치해야 한다.
요청 자체의 `version`도 cancel/review command에 사용한다.

동일 Site에는 한 번에 하나의 `PENDING` lifecycle request만 허용한다. 승인 전 direct
mutation으로 Site version이 바뀌면 승인은 conflict로 거절되고 요청은 pending 상태를
유지해 명시적인 거절 또는 취소를 요구한다.

## 5. Success criteria

- Authenticated browser는 request table을 scoped `SELECT`만 하고 모든 mutation은 RPC로
  진입한다.
- Application Service와 PostgreSQL이 role, permission, AAL, scope, state, version을 각각
  독립 검증한다.
- 요청 성공은 request와 redacted audit을, 승인 성공은 Site + request + audit을 같은
  transaction에서 반영한다.
- 거절과 취소도 request + redacted audit을 같은 transaction에서 반영한다.
- audit payload는 action/status/version만 포함하고 사유, 연락처, Auth claims, token,
  cookie를 JSON payload에 포함하지 않는다.
- Management Admin과 Site Admin은 자신의 scope에서만 요청하고 직접 status mutation은
  계속 거부된다.
- Super Admin 승인 queue에는 모든 pending 요청이 보이고 cross-tenant customer
  화면에는 다른 요청이 렌더링되지 않는다.
- requester self-review, stale Site/request version, invalid transition, duplicate pending,
  AAL/role/scope 위반은 모두 fail closed 한다.
- WCJ, unit, static DB contract, build, Desktop/Mobile smoke, staging Auth E2E가 통과한다.

## 6. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Queue가 기존 direct 권한을 우회 | request/approval permission을 기존 catalog에서 그대로 사용하고 direct RPC는 변경하지 않음 |
| 승인 시 Site가 이미 변경됨 | 요청 당시 Site version을 승인 transaction에서 다시 비교 |
| requester와 approver가 동일 | Application과 DB 양쪽에서 actor ID 비교 |
| cross-tenant request 노출 | composite FK, membership scope RLS, command 내부 scope 재검증 |
| 중복·상충 pending 요청 | Site별 partial unique index |
| 승인 후 감사 불일치 | Site/request/audit을 하나의 SECURITY DEFINER transaction에서 처리 |

## 7. Delivery order

1. Plan, glossary, ERD, schema, Design 계약 확정
2. Domain/Application service와 unit tests
3. Migration, RLS, RPC, pgTAP, Drizzle schema
4. Supabase repositories와 server actions
5. KO/EN UI와 WCJ
6. Staging migration 및 authenticated E2E
7. PDCA gap analysis, report, handoff

## 8. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` sections 9.5.1 and 10
- `docs/01-plan/features/site-management.plan.md`
- `docs/02-design/features/site-management.design.md`
- `docs/architecture/current-state.md`
- `docs/handoff-0719-1146.md`
