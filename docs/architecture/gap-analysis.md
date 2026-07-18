# Taptolk Gap Analysis

- 기준 문서: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` v1.1
- 비교 대상: 2026-07-18 현재 저장소
- 판정: 완료 / 부분 / 후속 Phase / 외부 의존 / 결정 필요

## 1. 총평

Phase 0 소스 기반은 구현됐다. 모노레포, Web/Worker, 환경 검증, DB migration 골격,
UI system, 관측성, 테스트, CI, WCJ가 존재하고 로컬 웹 검증은 통과한다.

Phase 0 전체 acceptance와 비교하면 다음 두 항목이 남아 있다.

1. Docker 환경에서 Supabase Local reset 및 pgTAP 실행
2. Vercel Preview 배포와 실제 route 검증

i18n은 로컬 검증까지 완료했다. Phase 1은 Tenant/Admin schema, RBAC, RLS, audit,
Supabase SSR, 서버 기반 Admin context, KO/EN 로그인과 TOTP MFA 실인증까지 진행했다.
이메일/Google 계정 생성과 RLS Tenant Catalog도 구현했으며 Google provider 연결,
관리자 승인 mutation과 Site CRUD 제품 journey가 남아 있다.

## 2. Phase 0 차이

| 영역 | 목표 | 현재 | 판정 | 다음 조치 |
|---|---|---|---|---|
| Node/pnpm | Node 24, pnpm 10 | 24.18.0/10.34.5 고정 | 완료 | 유지 |
| Monorepo | pnpm + Turbo | 10 package workspace | 완료 | 유지 |
| Web | Next App Router | `/ko`·`/en`, locale 선택, Admin Auth states, health | 완료 | Site CRUD route 추가 |
| Worker | 별도 Node 계약 | validation/lifecycle/health | 완료 | 운영 runtime ADR |
| Env | client/server Zod | allowlist와 production 조건 | 완료 | 실제 env는 환경별 입력 |
| DB | Supabase Local + Drizzle | Phase 0·1 migration/pgTAP 작성 | 부분 | Docker에서 reset/test |
| UI | token과 기본 component | Button, heading, journey status | 완료 | 실제 feature와 함께 확장 |
| Observability | Sentry + logs | Node adapter와 redaction | 완료 | DSN 입력은 별도 승인 |
| Test | unit/DB/browser | 48 unit·20 browser 통과, DB runtime 미실행 | 부분 | Local DB test |
| CI | PR pipeline | GitHub Actions 통과 | 완료 | 변경마다 유지 |
| Preview | Vercel URL | 미연결 | 외부 의존 | 별도 승인 후 import/deploy |
| 문서 | setup/security/deploy | 작성 완료 | 완료 | 변경과 함께 유지 |

## 3. 후속 Phase Gap

| 영역 | 목표 | 현재 | 판정 |
|---|---|---|---|
| i18n | KO/EN, 자동 판정, 명시 선택, locale URL | 구현·E2E 완료 | 완료 |
| Tenant/Admin | Tenant, Site, Membership, RBAC, RLS, Audit | schema, granular permission, server-only Site mutation 기반 | Phase 1 부분 |
| Auth | Admin MFA, Owner OTP, Caller session | Admin Email/Password·TOTP AAL2 실인증, 이메일/Google 가입 코드 | Phase 1 부분 |
| Admin Console | Platform/Company/Site dashboard와 domain pages | role entry/context UI와 RLS Tenant Catalog, 3번 visual direction | Phase 1 부분 |
| QR/Sticker | asset, binding, SVG, render, PDF/ZIP | 역할별 발행·관리 권한 계약만 구현 | Phase 2–3 |
| Contact | public scan, session, rate limit | 없음 | Phase 4 |
| Messaging | SMS, response token, polling | provider env만 | Phase 5 |
| Escalation | report/management flow | 없음 | Phase 6 |
| Operations | retention, metrics, alerts | defaults와 logger만 | Phase 7 |

## 4. Phase 1 잔여 Gap

| 항목 | 현재 증명 | 완료에 필요한 증명 |
|---|---|---|
| Migration | 정적 transaction/RLS/constraint 검사 | Supabase Local reset |
| Tenant isolation | RBAC unit 및 pgTAP SQL 작성 | 실제 PostgreSQL pgTAP |
| Admin Auth | KO/EN 로그인, TOTP 등록·챌린지와 staging AAL2 실인증 | Google provider 실연결, recovery, idle timeout |
| Account approval | 신규 Auth identity의 권한 자동 부여 금지 | profile/membership 승인 transaction과 audit |
| Site CRUD | granular permission과 server-only application service 계약 | request model, route/UI/repository/authenticated E2E |
| Audit | same-transaction interface와 DB key constraint | 실제 mutation 후 append-only 검증 |
| UI | bilingual Foundation와 role별 Admin Auth/context shell | Site CRUD 상태와 실제 운영 dashboard |

## 5. 결정이 필요한 아키텍처 Gap

### G-01 Production Worker runtime

Vercel Function은 장기 상주 Queue consumer가 아니다. Queue 작업시간과 처리량을
측정한 뒤 Vercel Cron batch drain 또는 별도 container worker를 ADR로 결정해야
한다.

### G-02 로고 Vector-first 예외

공식 자산은 변형 금지 PNG뿐이다. 현재는 원본 PNG를 byte 보존한다. 인쇄 Phase 전에
공식 SVG를 제공받거나 PNG 사용 예외를 승인해야 한다. 자동 vectorize는 하지 않는다.

### G-03 UI token과 로고 원색

명세 UI token은 Purple `#8066FF`, Orange `#FF7A00`이고 로고 원본은
`#8A6EFF`, `#FF8500`이다. UI token은 명세값을, 로고는 원본값을 유지한다. 변경이
필요하면 브랜드 결정으로 처리한다.

### G-04 Retention과 legal hold

Local default는 존재하지만 Production 보유·파기 기간, 신고 증거의 legal hold,
외부 처리자 위탁 조건은 운영·법률 승인이 필요하다.

### G-05 Serverless rate-limit 저장소

Function 메모리를 사용할 수 없다. Phase 4 전에 PostgreSQL 원자 카운터 또는 승인된
외부 저장소와 TTL/동시성 정책을 결정해야 한다.

### G-06 Migration 소유권

현재 결정은 Supabase migrations를 실행의 단일 기준으로 사용하고 Drizzle을
schema/type 및 migration 생성 보조로 사용하는 것이다. Phase 1 첫 schema 작업에서
생성→review→Supabase migration 반영 흐름을 실제로 검증해야 한다.

## 6. 주요 위험

### 데이터 정합성

- Tenant/Site/Management Company 교차 참조는 복합 FK 또는 DB invariant로 강제
- QR asset/current binding은 하나의 transaction과 unique constraint로 보호
- Token 사용 횟수와 만료·폐기는 원자적으로 처리
- Queue/SMS/Render는 `(tenant_id, idempotency_key)` 중복 방지
- 상태 전이는 Application state machine과 optimistic version으로 제한
- CSV preview/commit은 checksum과 idempotent commit 필요

### 보안

- 전화번호 hash는 단순 SHA-256이 아닌 keyed HMAC 사용
- encryption/HMAC/cookie 키는 목적별 분리 및 rotation
- service role scope는 사용자 입력 tenant ID를 신뢰하지 않음
- cookie mutation은 SameSite 외 Origin/CSRF 통제 필요
- Queue에는 PII/secret 대신 내부 ID만 전달
- SVG 업로드는 script/external reference 제거 후 재렌더
- Cron/Worker endpoint는 secret, replay 방지, 최소 권한 적용

### 멀티테넌트

- 프론트 필터가 아닌 membership scope + RLS 이중 통제
- browser-accessible table은 RLS와 CI policy test 필수
- Storage path와 signed URL 발급에도 tenant 검증
- 통계, audit, idempotency key도 tenant 범위 적용
- Service Role은 RLS 우회 능력을 가진 별도 trust boundary로 취급

### 개인정보

- 전화번호, 차량번호, message, token, cookie, authorization은 로그 금지
- 공개 DTO는 명세 allowlist와 차량번호 끝 4자리만 허용
- audit before/after JSON은 PII field allowlist/redaction 필요
- IP/device hash는 rotating keyed hash와 짧은 retention 적용
- Sentry/SMS/Vercel/Supabase 처리지역과 위탁 조건은 Production 전 검토

## 7. 외부 의존성

| 시스템 | 현재 | 필요한 것 |
|---|---|---|
| Docker | daemon 없음 | Docker Desktop 설치·실행 |
| Supabase Local | config만 존재 | reset, pgTAP, migration runtime 증명 |
| Supabase Staging/Prod | Staging schema 연결, Production 미생성 | Auth 공개 env와 bootstrap admin, 추후 Production |
| GitHub | remote/PR/Actions 연결 | 현재 변경 push와 CI 재확인 |
| Vercel | 미연결 | Git import, root/build/env 설정, Preview |
| SMS | mock 계약만 | 사업자, 발신번호 승인, callback, 비용 |
| Sentry | adapter만 | 환경별 DSN/token과 개인정보 설정 |

## 8. 다음 개발 순서

1. Google Cloud/Supabase staging provider와 callback URL 연결
2. 이메일·Google 신규 계정의 access-pending 실인증 acceptance
3. 관리자 profile/membership 승인 transaction과 audit 구현
4. Site create request/approval model과 tenant-scoped repository 구현
5. Site route, KO/EN Admin CRUD UI와 authenticated tenant-isolation E2E 구현
6. 선택된 3번 visual direction으로 Platform/Company/Site 화면 refinement
7. Vercel Preview env 연결과 동일 Auth journey 검증

외부 연결 없이 가능한 Phase 1 소스 구현은 계속할 수 있지만, DB runtime과 인증된
journey가 없는 상태를 전체 Phase 완료로 오인하지 않는다.
