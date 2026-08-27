# admin-console-architecture - Plan

> Version: 1.0.0 | Date: 2026-07-18 | Status: Approved
> Level: Enterprise

## 1. Purpose

마스터 명세의 Admin route·RBAC·API 목록을 실제 제품 설계 기준으로 확장한다. Taptolk
내부 운영자가 전체 서비스를 관리하는 Platform Console과 계약 고객이 자신에게 허용된
관리회사·Site를 운영하는 Customer Operations Console을 명확히 분리한다.

이 문서는 화면을 예쁘게 배치하는 계획이 아니라, 각 화면이 어떤 운영 결정을 돕고
어떤 범위의 데이터를 어떤 권한으로 조회·변경하는지 먼저 고정한다.

## 2. Background

현재 저장소에는 Tenant/Admin schema, membership scope, RBAC, RLS와 Site application
service 기반이 있다. 마스터 명세에는 Admin route, navigation, API 목록, KPI와 alert가
있지만 다음 항목은 아직 상세 설계되지 않았다.

- Super Admin 전체 서비스 운영 화면과 고객사 운영 화면의 분리
- 역할별 dashboard 목적, KPI, action과 drill-down
- 도메인별 list/detail/workflow 화면의 책임과 data contract
- loading/empty/error/permission/partial-data 상태
- 관리회사·Site scope 전환과 현재 범위 표시
- API read model, pagination, filter, audit와 PII masking

## 3. Goals

- Platform Console과 Customer Operations Console의 trust boundary를 분리한다.
- 모든 Admin role의 기본 landing page와 navigation을 정의한다.
- 관리회사·계약 Site별 dashboard 및 Super Admin global dashboard를 정의한다.
- Tenant, Contract, Site, Membership, Brand, Sticker, QR, Vehicle, Contact,
  Escalation, Inventory, Analytics, Audit, Settings 도메인의 화면 책임을 정의한다.
- QR 생성 엔진은 중앙화하고 Platform·Company·Site Console의 요청·승인·현장관리
  책임을 분리한다.
- 각 주요 화면의 KPI, read model, filter, drill-down, action과 상태를 정의한다.
- KO/EN 문구와 의미 기반 제목 구조가 함께 구현될 수 있는 content boundary를 둔다.
- UI → Route → Application → Domain → Repository/RLS 경계를 유지한다.

## 4. Scope

### 4.1 In Scope

- 역할·scope·permission matrix
- Platform/Customer console information architecture
- 역할별 route/navigation visibility
- dashboard 목적과 KPI/data freshness
- 도메인별 list/detail/workflow page inventory
- scope switcher와 tenant/site context
- server read model/API contract
- PII masking, audit, export, destructive action policy
- WCJ 상태·접근성·반응형·KO/EN 기준
- 단계별 implementation order와 acceptance

### 4.2 Out of Scope

- 실제 Admin UI·API·repository 구현
- Supabase project·Auth provider·Vercel 연결
- 시각 mockup, Figma, clickable prototype
- QR·Sticker·Contact 등 후속 Phase 업무 로직 구현
- Billing/결제 자동화와 Print Vendor portal
- Production 운영자·고객 데이터 생성

## 5. Admin Surfaces

| Surface | Primary users | Scope | Primary purpose |
|---|---|---|---|
| Platform Console | Super Admin, Platform Operator | 전체 플랫폼 | 고객·계약·운영 건전성·보안·실패 복구 |
| Company Console | Management Admin, Read Only | 관리회사와 산하 Site | 계약 범위 내 단지·QR·운영 성과 관리 |
| Site Console | Site Admin, Site Operator, Read Only | 단일 Site | 현장 배포·차량·세션·미응답 처리 |

동일한 component를 재사용할 수 있지만 global 데이터와 customer-scoped 데이터는 route,
authorization, read model에서 명확히 구분한다.

## 6. Success Criteria

- [ ] 모든 Admin route에 목적, 허용 역할, scope, 주요 data, action이 정의된다.
- [ ] Super Admin dashboard가 고객용 dashboard의 단순 합계 화면이 아니다.
- [ ] Management Company dashboard가 산하 Site 비교와 계약 사용량을 제공한다.
- [ ] Site dashboard가 오늘의 현장 운영과 미처리 작업을 우선한다.
- [ ] Read Only와 Operator가 허용되지 않은 mutation을 볼 수 없고 API도 거부한다.
- [ ] dashboard metric의 계산식·시간창·freshness·drill-down이 정의된다.
- [ ] PII·메시지·export는 최소 권한과 audit 조건을 가진다.
- [ ] 모든 주요 화면에 loading/empty/error/forbidden/partial/success 상태가 정의된다.
- [ ] KO/EN content key와 의미 기반 heading 기준이 설계에 포함된다.
- [ ] 구현 순서가 하나의 vertical slice 단위로 제시된다.

## 7. Delivery Order

| Step | Deliverable | Status |
|---|---|---|
| 1 | Admin role and Site/QR permission matrix | Completed |
| 2 | Console IA and domain page map | Completed |
| 3 | Dashboard/read-model/API contract | Completed |
| 4 | Screen state and KO/EN content contract | Completed |
| 5 | Selected visual direction refinement and journey review | In progress |
| 6 | Supabase Staging/Auth setup | Completed |
| 7 | Authenticated account-approval vertical slice | Completed |
| 8 | Tenant command vertical slice | Next |

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Super Admin과 고객 역할 혼합 | 전체 데이터 노출 | 별도 console boundary와 explicit scope |
| dashboard가 숫자 모음으로 끝남 | 운영 결정 불가 | KPI마다 action/drill-down/owner 지정 |
| 브라우저 직접 mutation 우회 | 권한 상승 | server application service와 DB policy 이중 통제 |
| 메시지·전화번호 과다 노출 | 개인정보 침해 | 기본 masking, break-glass audit |
| 도메인 전체를 한 번에 구현 | 검증 불가 | Site CRUD부터 vertical slice |
| 번역 후 제목 의미 훼손 | 콘텐츠 품질 저하 | locale별 semantic line group |
| 집계 query가 운영 DB를 압박 | 성능 저하 | bounded read model, snapshot/aggregate 전략 |

## 9. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` §1.3, §9.5, §11.4, §19.3–19.4,
  §24–25
- `docs/02-design/features/tenant-admin-foundation.design.md`
- `docs/architecture/wcj-web-compliance-journey-standard.md`
- `design_concept/`
