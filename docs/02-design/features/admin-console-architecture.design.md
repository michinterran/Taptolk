# admin-console-architecture - Design

> Version: 1.1.0 | Date: 2026-07-18 | Status: Approved
> Level: Enterprise | Plan:
> `docs/01-plan/features/admin-console-architecture.plan.md`

## 1. Product Boundary

### 1.1 Console model

```text
Admin authentication + assurance
→ resolve active membership and allowed scopes
→ select one explicit operating scope
→ render role-specific navigation and dashboard
→ Route Handler
→ Application query/command service
→ Domain permission and transition policy
→ tenant-scoped repository
→ PostgreSQL RLS/constraint
→ redacted audit
```

Taptolk는 세 개의 운영 관점을 가진다.

| Console view | Users | Data boundary | Decision focus |
|---|---|---|---|
| Platform | SUPER_ADMIN, PLATFORM_OPERATOR | 전체 플랫폼 | 고객·계약·장애·보안·비용·복구 |
| Company | MANAGEMENT_ADMIN, READ_ONLY | 관리회사와 산하 Site | 계약 사용량·Site 비교·승인·성과 |
| Site | SITE_ADMIN, SITE_OPERATOR, READ_ONLY | 단일 Site | 배포·배정·연락·미응답·재고 |

공통 shell과 component는 재사용하되, Platform view와 customer view의 read model과
authorization은 분리한다. 고객 역할에게 global aggregate를 내려보낸 뒤 프론트에서
숨기는 구현은 금지한다.

### 1.2 Entry and scope

- `/admin`은 인증 후 역할과 membership을 확인하는 entry route다.
- Platform role은 Platform Dashboard로 이동한다.
- Management role은 마지막으로 선택한 Management Company Dashboard로 이동한다.
- Site role은 자신의 Site Dashboard로 이동한다.
- 여러 membership을 가진 사용자는 서버가 내려준 허용 scope만 선택할 수 있다.
- URL에는 선택 scope를 표현할 수 있지만 `tenant_id`를 authorization 근거로 신뢰하지
  않는다.
- 현재 scope 이름과 유형을 모든 Admin 화면 header에 항상 표시한다.
- scope 변경 시 query cache, breadcrumb와 navigation 상태를 함께 교체한다.

## 2. Role and Permission Design

### 2.1 Role responsibility

| Role | Responsibility | Explicit exclusions |
|---|---|---|
| SUPER_ADMIN | 고객·계약·보안 정책과 파괴적 승인 | 없음, 단 모든 행동 audit |
| PLATFORM_OPERATOR | 전체 서비스 일상 운영·실패 복구 | 고객 생성, 계약 변경, 최종 폐기 승인 |
| MANAGEMENT_ADMIN | 계약 범위 내 관리회사와 산하 Site 운영 | 다른 회사, 계약 원장, global 운영 |
| SITE_ADMIN | 단일 Site 설정·담당자·현장 운영 | Site 생성·종료, 계약 변경 |
| SITE_OPERATOR | QR 배포·차량 배정·미응답 처리 | Site 설정, membership, audit |
| READ_ONLY | 허용 scope의 마스킹된 조회·감사 | 모든 mutation, 원문 메시지 |

### 2.2 Site lifecycle matrix

| Action | Super | Platform Operator | Mgmt Admin | Site Admin | Operator | Read Only |
|---|---:|---:|---:|---:|---:|---:|
| Site list/detail | All | All | Company | Own Site | Own Site | Allowed scope |
| Direct create | Yes | No | No | No | No | No |
| Create request | Yes | No | Company | No | No | No |
| Create approval | Yes | No | No | No | No | No |
| Operational profile update | All | All | Company | Own Site | No | No |
| Contract/capacity update | Yes | No | No | No | No | No |
| Suspend | Yes | Recommend | Request | Request | No | No |
| Archive/close | Yes | Request | Request | No | No | No |
| Membership invite | All | Operational | Company roles | Site roles | No | No |
| Audit read | All | All | Company | Site | No | Masked |

`site:create`, `site:create-request`, `site:create-approve`를 분리한다.
`site:update-operational`과 `site:update-contract`도 별도 권한으로 관리한다.

### 2.3 Domain permission groups

```text
platform.customer.*
platform.contract.*
platform.operations.*
platform.security.*

company.read
company.update-operational
site.read
site.create-request
site.create-approve
site.update-operational
site.update-contract
site.suspend-request
site.suspend-approve
site.archive-request
site.archive-approve

membership.read
membership.invite-company
membership.invite-site
membership.change-role
membership.revoke

brand.*
sticker.*
qr-batch:read
qr-batch:request
qr-batch:sample-approve
qr-batch:generation-approve
qr-batch:retry-request
qr-batch:retry
qr-asset:read
qr-asset:assign
qr-asset:revoke-request
qr-asset:revoke-approve
qr-asset:revoke
vehicle.*
contact-session.*
escalation.*
inventory.*
analytics.read
audit.read
settings.*
```

UI visibility와 API authorization은 동일한 domain permission catalog를 사용한다.
RLS는 scope 격리를 담당하고 application policy는 업무 행동과 상태 전이를 담당한다.

### 2.4 QR issuance and lifecycle matrix

QR 생성 엔진은 플랫폼 공통 Application Service와 Worker가 한 번만 소유한다.
Platform·Company·Site Console은 같은 엔진을 직접 호출하지 않고 각자의 권한으로
요청·승인·조회·현장관리 command를 보낸다.

| Action | Super | Platform Operator | Mgmt Admin | Site Admin | Operator | Read Only |
|---|---:|---:|---:|---:|---:|---:|
| Batch read | All | All | Company | Site | Site | Allowed scope |
| Batch request | All | Operational | Company | Site | No | No |
| Sample approve | All | Operational | Company | Site | No | No |
| Production generation approve | Yes | No | No | No | No | No |
| Failed job retry | Yes | Yes | Request | Request | No | No |
| QR asset read | All | All | Company | Site | Site | Masked scope |
| Vehicle assignment | All | Operational | Company | Site | Site | No |
| Revoke request | Direct | Request | Company approval | Site request | No | No |
| Final revoke | Yes | No | No | No | No | No |

MVP는 고객 역할의 발행 요청과 샘플 승인을 분산하고 실제 대량 생성 시작은 Super
Admin이 승인하는 중앙 release gate를 사용한다. 운영 안정화 후 계약 잔여 수량,
활성 Site, 승인된 Design Version과 수량 임계치를 모두 만족하는 표준 Batch만
Management Admin에게 위임할 수 있다. 위임 정책은 명시적인 버전과 audit를 가져야
하며 기본 허용으로 구현하지 않는다.

같은 actor가 파괴적 요청을 만들고 승인할 수 없도록 maker-checker 규칙을 적용한다.
Site Operator는 QR을 생성하거나 폐기하지 않고 입고·배포·차량 배정만 수행한다.

## 3. Information Architecture

### 3.1 Shared route inventory

| Route | Screen purpose | Primary scope |
|---|---|---|
| `/admin` | 역할별 landing redirect | Resolved |
| `/admin/dashboard` | 현재 scope의 운영 결정 | Current |
| `/admin/management-companies` | 고객/관리회사 목록 | Platform |
| `/admin/management-companies/[id]` | 회사 360과 계약·Site 비교 | Platform/Company |
| `/admin/contracts` | 계약 상태·용량·만료 | Platform/Company |
| `/admin/sites` | 허용 Site 목록과 action queue | Platform/Company |
| `/admin/sites/[siteId]` | Site 360과 현장 운영 | Site |
| `/admin/access` | 관리자·membership·초대 | Current |
| `/admin/qr/batches` | 발행 batch 목록·진행률 | Company/Site |
| `/admin/qr/batches/new` | 발행 wizard | Company/Site |
| `/admin/qr/batches/[batchId]` | 생성·렌더·export 상태 | Company/Site |
| `/admin/qr/assets` | 개별 QR 수명주기 | Site |
| `/admin/sticker/templates` | 승인 template | Platform |
| `/admin/sticker/designs` | 고객 design·sample·approval | Company/Site |
| `/admin/brand-assets` | logo/background 자산 | Company/Site |
| `/admin/vehicles` | 차량 import·배정·상태 | Site |
| `/admin/owners` | 마스킹된 차주 연결 상태 | Site |
| `/admin/contact-sessions` | 연락 세션 운영 | Site |
| `/admin/escalations` | 관리사무소 전달 queue | Site |
| `/admin/inventory` | sticker 입고·재고·배포 | Site |
| `/admin/analytics` | scope별 KPI와 추세 | Current |
| `/admin/audit-logs` | 권한·변경 이력 | Allowed |
| `/admin/settings` | scope별 운영 설정 | Current |

### 3.2 Platform-only routes

| Route | Purpose |
|---|---|
| `/admin/platform` | 전체 서비스 command center |
| `/admin/platform/tenants` | Tenant 상태·격리·suspension |
| `/admin/platform/contracts` | 계약 원장·용량·만료 |
| `/admin/platform/qr` | 전체 고객 QR 발행 승인·품질·폐기 관제 |
| `/admin/platform/jobs` | Queue/SMS/render/cleanup 실패 복구 |
| `/admin/platform/security` | RLS deny·rate limit·신고·차단 |
| `/admin/platform/providers` | SMS/Sentry/Storage 상태와 비용 |
| `/admin/platform/system` | build, DB, worker, cron health |

Platform route는 Platform role이 아니면 존재 자체를 navigation이나 response metadata로
노출하지 않는다.

### 3.3 Navigation by role

| Navigation | Super | Platform Op | Mgmt Admin | Site Admin | Operator | Read Only |
|---|---:|---:|---:|---:|---:|---:|
| Platform | O | O | - | - | - | - |
| Dashboard | O | O | O | O | O | O |
| 고객·계약 | O | Read/Operate | O | Site only | - | Read |
| QR 발행 | O | O | O | O | Read | Read |
| 스티커·브랜드 | O | O | O | O | Read | Read |
| QR 자산 | O | O | O | O | O | Read |
| 차량·차주 | O | O | O | O | O | Masked |
| 연락·알림 | O | O | Company | Site | Site | Masked |
| 재고·배송 | O | O | Company | Site | Site | Read |
| 통계 | O | O | Company | Site | Limited | Read |
| 감사로그 | O | O | Company | Site | - | Masked |
| 설정 | O | Operational | Company | Site | - | - |

## 4. Dashboard Design

Dashboard는 보고서가 아니라 action queue를 포함하는 운영 시작점이다. 모든 metric은
정의, 시간창, 단위, freshness, scope와 drill-down route를 가진다. 값이 집계되지
않았을 때 `0`으로 표시하지 않고 `UNAVAILABLE` 또는 `PARTIAL`로 표시한다.

### 4.1 Platform Dashboard

목적: 전체 플랫폼의 고객·계약 건전성, 장애, 보안, 비용과 복구 우선순위를 결정한다.

| Section | Metrics / data | Primary action |
|---|---|---|
| Customer health | active/suspended tenant, active Site, expiring contract | 고객/Site 검토 |
| Capacity | contracted vs assigned vehicle, over-capacity risk | 계약 검토 |
| Journey health | QR lookup, session create, SMS, read, response, resolution | funnel drill-down |
| Operations | unresolved escalation, lost/replacement, stock risk | owner 할당 |
| Job health | queue age, failed SMS/render/cleanup, retry exhausted | retry/quarantine |
| Security | RLS deny, rate-limit, abuse report, blocked caller | incident review |
| Cost | SMS count/cost, render/storage volume | tenant/provider 분석 |
| Deployment | web/worker/cron/db status, latest release | runbook 이동 |

SUPER_ADMIN은 고객·계약·정책·최종 승인을 수행한다. PLATFORM_OPERATOR는 실패 복구와
운영 triage를 수행하지만 계약·파괴적 action은 요청까지만 가능하다.

### 4.2 Management Company Dashboard

목적: 계약 범위와 산하 Site의 운영 차이를 보고 지원이 필요한 Site를 결정한다.

| Section | Metrics / data | Primary action |
|---|---|---|
| Contract | plan, dates, capacity, assigned, remaining | 계약 확인 |
| Site portfolio | Site status, activation, response, escalation, stock | Site 비교 |
| Issuance | requested/generated/shipped/received QR batches | batch 추적 |
| Adoption | assigned QR, activated QR, active vehicle | 낮은 Site 지원 |
| Contact quality | response/resolution/escalation rate | Site 상세 |
| Approvals | Site create, design sample, QR revoke/replace requests | approve/request |
| QR issuance | requested/approved/generated/received, contract remaining | request/track |
| Access | active/invited/suspended admins | membership 관리 |

회사 간 비교, global provider 비용과 다른 고객의 순위는 제공하지 않는다.

### 4.3 Site Dashboard

목적: 오늘 현장에서 처리할 QR·차량·연락·미응답·재고 작업을 빠르게 끝낸다.

| Section | Metrics / data | Primary action |
|---|---|---|
| Today | new activation, open session, waiting owner, escalation | 작업 queue |
| QR readiness | in-stock, unassigned, assigned, active, lost, revoked | assign/replace |
| QR issuance | draft/requested/generating/shipped/received | request/receive |
| Vehicle | imported, validation error, unbound, over-capacity risk | import/assign |
| Contact | sent/read/replied/resolved, median response time | session detail |
| Escalation | new/acknowledged/assigned/closed, oldest age | accept/close |
| Inventory | received/distributed/remaining/low-stock | receive/request |
| Recent activity | redacted audit/activity feed | 관련 상세 |

Site Operator landing은 action queue를 첫 영역으로 보여준다. Site Admin landing은
운영 지표와 설정 위험을 함께 보여준다. Read Only는 action CTA 대신 drill-down만
제공한다.

## 5. Domain Page Contracts

| Domain | List decisions | Detail/workflow decisions |
|---|---|---|
| Tenant/Company | 상태, 계약 위험, 지원 우선순위 | profile, contract, Site, access, audit |
| Contract | 만료, 용량, 상태 | term, plan, capacity history, change audit |
| Site | 운영 상태, 승인 요청 | overview, settings, access, QR, vehicle, contact |
| Membership | 초대·미수락·정지 | role/scope, MFA, revoke reason, audit |
| Brand | 사용 가능 자산·검증 상태 | checksum, dimensions, ownership, usage |
| Sticker | draft/sample/approved/immutable | preview, QR decode, approval history |
| QR Batch | 진행률·실패·취소 가능 | job stages, error bucket, export manifest |
| QR Asset | lifecycle·배정·분실 | binding history, replacement chain, audit |
| Vehicle/Owner | validation·binding 상태 | masked vehicle/owner, active binding |
| Contact | queue·SLA·abuse | status timeline, masked participants, action |
| Escalation | age·priority·assignee | acknowledgement, resolution, reason |
| Inventory | stock·movement·risk | receipt/distribution history |
| Analytics | trend·comparison·anomaly | definition, filters, export |
| Audit | actor/action/resource/time | redacted before/after, request trace |
| Settings | effective policy·inheritance | override, validation, change reason |

모든 list는 server-side pagination과 deterministic sort를 사용한다. 모든 detail은
resource scope, current status, allowed actions, version과 request ID를 포함한다.

## 6. Read Model and API Contract

### 6.1 Admin context

```ts
interface AdminContextReadModel {
  actor: {
    userId: string;
    displayName: string;
    assurance: "AAL1" | "AAL2";
  };
  activeContext: {
    membershipId: string;
    role: AdminRole;
    scopeType: "PLATFORM" | "MANAGEMENT_COMPANY" | "SITE";
    scopeId: string | null;
    displayName: string;
  };
  availableContexts: AllowedContextSummary[];
  permissions: AdminPermission[];
  locale: "ko" | "en";
}
```

Client가 role, tenant, company 또는 Site를 임의로 선언하지 않는다. Server가 session과
active membership으로 context를 생성한다.

### 6.2 Dashboard read model

```ts
interface AdminDashboardReadModel {
  scope: {
    type: "PLATFORM" | "MANAGEMENT_COMPANY" | "SITE";
    id: string | null;
    displayName: string;
  };
  window: "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS";
  generatedAt: string;
  freshness: "LIVE" | "FRESH" | "STALE" | "PARTIAL";
  metrics: DashboardMetric[];
  actionQueue: AdminActionQueueItem[];
  trends: DashboardTrend[];
  notices: DashboardNotice[];
}

interface DashboardMetric {
  code: string;
  labelKey: string;
  value: number | null;
  unit: "COUNT" | "PERCENT" | "SECONDS" | "KRW";
  status: "AVAILABLE" | "UNAVAILABLE" | "PARTIAL";
  comparedWithPrevious: number | null;
  drillDownPath: string | null;
}
```

### 6.3 Admin endpoints

마스터 명세의 `/api/v1/admin/dashboard`를 유지하면서 scope query를 확장한다.

```text
GET  /api/v1/admin/context
POST /api/v1/admin/context/select

GET  /api/v1/admin/dashboard
     ?scopeType=PLATFORM|MANAGEMENT_COMPANY|SITE
     &scopeId={allowedScopeId}
     &window=TODAY|LAST_7_DAYS|LAST_30_DAYS

GET  /api/v1/admin/action-queue
GET  /api/v1/admin/management-companies/{id}/overview
GET  /api/v1/admin/sites/{id}/overview
GET  /api/v1/admin/platform/health
GET  /api/v1/admin/platform/jobs
GET  /api/v1/admin/platform/security-events
```

- `scopeId`는 조회 대상 힌트이며 authorization 근거가 아니다.
- server는 actor의 allowed context와 scope가 일치하지 않으면 `403`을 반환한다.
- Platform endpoint는 customer membership에 존재를 노출하지 않는다.
- mutation은 `Idempotency-Key`, expected version, request ID와 reason을 요구한다.
- export는 별도 job과 짧은 TTL의 signed URL을 사용하고 audit를 남긴다.

### 6.4 Error envelope

```json
{
  "error": {
    "code": "ADMIN_SCOPE_FORBIDDEN",
    "messageKey": "errors.adminScopeForbidden",
    "retryable": false,
    "requestId": "uuid"
  }
}
```

사용자에게 stack, SQL, provider payload, tenant ID 또는 PII를 노출하지 않는다.

## 7. Screen State and Content Contract

### 7.1 Required states

| State | Meaning | User action |
|---|---|---|
| Loading | 현재 scope data 조회 중 | skeleton, duplicate action 금지 |
| Empty | 허용 resource가 없음 | role에 맞는 create/request 안내 |
| Unavailable | metric source가 아직 없음 | 0 대신 설명과 retry |
| Partial | 일부 집계 지연/실패 | timestamp와 누락 영역 표시 |
| Stale | freshness 기준 초과 | refresh와 마지막 성공 시간 |
| Forbidden | membership/permission 없음 | 안전한 dashboard로 이동 |
| Conflict | optimistic version 충돌 | 최신 상태 재조회 |
| Error | 복구 가능한 실패 | retry와 request ID |
| Success | mutation 완료 | 결과, 다음 행동, audit reference |

### 7.2 KO/EN

- 모든 label, heading, empty/error/recovery copy는 typed KO/EN dictionary를 사용한다.
- 한국어와 영어 heading은 동일한 줄 위치가 아니라 각 언어의 의미 단위로 나눈다.
- 내부 enum, role, error code를 사용자에게 그대로 노출하지 않는다.
- metric label과 definition은 locale key를 사용하고 계산식은 언어와 분리한다.
- 날짜·시간·수량·통화는 locale formatter를 사용하되 DB 시간은 UTC로 저장한다.

## 8. Security and Privacy

- Platform role과 customer membership을 별도 trust boundary로 검증한다.
- Admin privileged role은 AAL2가 아니면 mutation과 PII 조회를 거부한다.
- active context는 HttpOnly session state 또는 server lookup으로 관리한다.
- role permission을 여러 tenant 사이에서 합산하지 않는다.
- dashboard는 전화번호, 메시지 원문, token, vehicle plate 전체를 포함하지 않는다.
- 메시지 원문은 신고·분쟁 등 승인된 운영 건에서만 break-glass로 조회하고 reason과
  audit를 남긴다.
- destructive action은 reason, re-authentication 또는 second approval을 정책에 따라
  요구한다.
- browser table mutation을 허용할 경우 RLS만으로 field transition을 우회할 수 없는지
  DB test를 추가한다. 증명하지 못하면 server-only mutation으로 제한한다.
- Service Role repository는 request의 tenant/site ID를 신뢰하지 않고 trusted context를
  다시 계산한다.

## 9. Performance and Freshness

| Data class | Target freshness | Strategy |
|---|---:|---|
| Action queue | 30 seconds | bounded operational query |
| Session/escalation status | 30 seconds | indexed current-state query |
| Inventory/activation | 5 minutes | aggregate read model |
| Business KPI | 15 minutes | snapshot table/materialized aggregate |
| Cost/provider metrics | 1 hour | provider usage snapshot |
| Audit list | near-real-time | indexed append-only query |

- Dashboard initial response target: p95 1.5 seconds excluding external provider lookup.
- 한 request에서 provider API를 fan-out 호출하지 않는다.
- list page default size는 25, 최대 100이다.
- aggregate는 `(scope_type, scope_id, metric_code, window_start)` 기준으로 저장한다.
- stale cache는 명시적으로 표시하며 다른 scope data로 대체하지 않는다.

## 10. Observability

- query log: requestId, actorId, membershipId, scopeType, scopeId, route, duration, result count
- authorization deny: permission, role, scope type, reason만 기록하고 PII는 제외
- dashboard metric: freshness, unavailable count, query duration
- mutation: action, resource, before/after allowlist, reason, version
- alert: cross-scope deny 급증, dashboard partial 지속, job retry exhausted, PII
  break-glass 조회, export 급증

## 11. Implementation Sequence

### Slice 0 — Contract correction

1. Site lifecycle permission을 request/approve/operational/contract로 분리
2. QR 발행 권한을 request/sample-approve/generation-approve/retry로 분리
3. QR 자산 권한을 read/assign/revoke-request/revoke-approve/revoke로 분리
4. 중앙 permission catalog와 server-only mutation policy를 재검토
5. role matrix unit/DB test

### Slice 1 — Authenticated Admin context

1. Supabase Auth email/password and MFA
2. server session and active membership resolution
3. `/admin` role redirect and scope switcher
4. KO/EN Admin shell, loading/error/forbidden

### Slice 2 — Site vertical slice

1. Site repository and overview read model
2. list/detail/create-request/update-operational API
3. Site Dashboard and Site CRUD UI
4. audit and optimistic conflict
5. role/tenant E2E

### Slice 3 — Company portfolio

1. Company overview and contract capacity
2. Site comparison and approval queue
3. company membership management

### Slice 4 — Platform command center

1. Tenant/contract overview
2. job/security/provider health
3. approval and recovery workflows

### Slice 5 — Later domain modules

Brand/Sticker → QR Batch/Asset → Vehicle/Owner → Contact/Escalation →
Inventory → Analytics/Audit/Settings 순으로 각각 vertical slice를 반복한다.

## 12. Acceptance

- permission matrix unit test
- allowed/forbidden scope integration test
- browser direct mutation bypass test
- Platform endpoint customer-role 404/403 test
- Super, Management Admin, Site Admin, Operator, Read Only route E2E
- KO/EN route, heading, state and selector test
- 320/768/1280/1920 responsive review
- keyboard, VoiceOver, 200% zoom, contrast review
- dashboard metric definition/freshness/drill-down contract test
- cross-tenant query and export isolation
- audit redaction and break-glass audit

## 13. Visual Direction from `design_concept`

현재 컨셉은 사용자용 mobile flow지만 Admin console에도 다음 시각 원칙을 계승한다.

- 밝은 회백색 배경과 흰색 surface
- Purple은 active scope, 선택, primary action, live status에 사용
- Orange는 경고·주의·브랜드 accent에 제한
- 큰 radius와 명확한 border로 상태 group을 구분
- 페이지마다 가장 중요한 상태와 다음 행동을 먼저 제시
- 문구는 짧고 직접적으로 작성하고 충분한 여백을 유지
- 원본 Taptolk 로고는 변형 없이 header에서 사용

Admin console은 정보량이 많으므로 mobile bottom navigation을 복제하지 않는다.
Desktop에서는 collapsible side navigation, tablet/mobile에서는 현재 scope와 action queue를
우선하는 compact navigation을 사용한다. generic KPI card를 반복하지 않고 상태,
우선순위, owner와 다음 행동이 한 카드 안에서 연결되도록 한다.

## 14. Selected Visual Direction and Remaining Gate

사용자는 세 가지 시각 방향 중 Customer Portfolio 기반의 3번 스타일을 선택했다.
최종 Admin Console은 3번의 고객·계약·Site portfolio 구조와 시각 시스템을 기본으로
하고, 상단에는 1번의 우선 처리 action queue를 결합한다. 2번의 journey health는
Dashboard hero가 아니라 별도 운영 분석 drill-down에 사용한다.

이 시각 원칙으로 다음 세 화면의 role-specific hierarchy를 확정한다.

1. Platform Dashboard
2. Management Company Dashboard
3. Site Dashboard

Platform Dashboard는 전체 QR release gate와 실패 복구를, Management Company
Dashboard는 소속 Site의 발행 요청과 계약 잔여량을, Site Dashboard는 입고·배정·교체
등 현장 action을 우선한다. 이 hierarchy와 responsive 동작을 검토한 뒤 Supabase
Staging/Auth 연결 단계로 이동한다.
