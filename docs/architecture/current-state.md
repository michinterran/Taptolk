# Taptolk Current State

- 기준일: 2026-07-18
- 프로젝트 루트: `/Users/benjaminsong/Documents/Taptolk`
- 최상위 기준: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` v1.1
- 현재 단계: Phase 0 소스 기반 및 i18n 완료, Phase 1 Tenant/Admin 기반과
  Admin Auth/MFA 소스 구현 완료, Supabase Staging 실인증 acceptance 대기

## 1. 구현 상태

저장소는 pnpm/Turborepo 모노레포로 초기화되었다.

```text
apps/
  web/                 Next.js 16, /ko·/en i18n, locale 선택, health API
  worker/              Queue consumer와 lifecycle 계약
packages/
  application/         Site mutation service와 transaction/audit 계약
  auth/                Supabase SSR, 서버 session/membership/AAL 판정과 Admin MFA action
  config/              client/server 환경변수 검증
  db/                  Drizzle/postgres-js 및 Phase 1 tenant schema
  domain/              중앙 RBAC, scope, MFA policy
  observability/       PII redaction, logger, Node Sentry adapter
  test-utils/          deterministic test helper
  ui/                  token, Button, SemanticHeading, JourneyStatus
supabase/              Phase 0·1 migration, RLS, seed, pgTAP test
scripts/wcj/           TAPTOLK WCJ 1.0 정적 검증기
e2e/                   axe, health, 320px, locale·Admin Auth browser smoke
.github/workflows/     동일 품질 게이트 CI
```

Tenant/Admin 데이터·권한·application service와 Admin 로그인/MFA 등록·챌린지
소스까지 구현했다. 스테이징 Auth 사용자와 환경변수를 사용한 실제 AAL2 acceptance,
인증된 Site CRUD 화면과 API, QR, SMS, 스티커 렌더링은 아직 구현하지 않았다.

## 2. 고정 기술 기준

| 영역 | 현재 구성 |
|---|---|
| Runtime | Node.js 24.18.0 |
| Package manager | Corepack + pnpm 10.34.5 |
| Monorepo | Turborepo 2.10.5 |
| Web | Next.js 16.2.10, React 19.2.7 |
| Language | TypeScript 5.9.3 strict + exact optional properties |
| UI | Tailwind CSS 4.3.3, 소유형 `@taptolk/ui` |
| Validation | Zod 4.4.3 |
| Database | Supabase Staging(Postgres 17.6, Seoul) + Local 계약, Drizzle 0.45.2, postgres-js 3.4.9 |
| Auth client | Supabase JS 2.110.7, Supabase SSR 0.12.3 |
| Test | Vitest 4.1.10, Playwright 1.61.1, axe |
| Quality | Biome 2.5.4, TAPTOLK WCJ 1.0 |
| Observability | Sentry Node 10.66.0 adapter, 구조화 redacted logger |

정확한 버전은 `pnpm-lock.yaml`에 고정되었다. 전역 pnpm 11이 하위 명령에 섞이지
않도록 중첩 workspace 명령도 `corepack pnpm`으로 실행한다.

## 3. 모듈 경계

현재 공통 경계는 다음 원칙을 코드로 반영한다.

```text
UI
→ Route Handler / Server Action
→ Application Service
→ Domain Policy
→ Repository / Transaction
```

- 환경변수: `config/client`와 server schema 분리
- UI 문구: `apps/web/content/messages.ts`의 한·영 타입 계약
- i18n: `/ko`·`/en` URL 기준, cookie → `Accept-Language` 최초 판정
- 인증: browser/server Supabase client와 MFA assurance 정책 분리
- 관리자 컨텍스트: verified JWT → active profile → 단일 membership → MFA AAL 순서로
  서버에서 fail-closed 판정
- 업무 권한: `@taptolk/domain`의 role/scope/permission 단일 기준
- mutation: `@taptolk/application`의 transaction 안에서 mutation과 audit 동시 처리
- 이용자 구분: Caller/Owner/Admin route policy
- 비동기 상태: idle/loading/waiting/empty/success/error/retrying/completed
- 오류: error 상태는 recovery action 필수
- 관측성: Sentry의 Node 전용 export와 공통 redaction 분리
- DB: transaction pool에서 prepared statement 비활성화

Phase 1부터 실제 기능을 추가할 때도 이 레이어를 건너뛰는 Route→DB 직접 접근을
허용하지 않는다.

## 4. i18n, WCJ와 의미 기반 줄바꿈

`TAPTOLK WCJ 1.0`은 W 8개, C 6개, J 5개로 총 19개 규칙을 검사한다.

- Web Compliance: 언어, landmark, native control, 대체 텍스트, 안전한 HTML,
  focus/reduced motion
- Content & Consistency: 중앙 문구 사전, 한·영 계약, 의미 단위 제목 줄, 언어별
  wrapping, token 경계, 로고 checksum
- Journey: route policy, 상태 완전성, live status, 오류 복구, 공통 primitive,
  locale 자동 판정과 선택 유지

공개 Foundation route는 `/ko`와 `/en`을 canonical 기준으로 사용한다. 최초 `/`
요청은 `taptolk_locale` cookie를 먼저 확인하고, 없으면 브라우저/OS가 전달한
`Accept-Language`를 해석한다. 한국어 선호는 `/ko`, 그 외 모든 언어와 헤더 누락은
`/en`으로 이동한다. KO/ENG 선택은 HttpOnly, SameSite=Lax cookie로 1년간 유지된다.

제목은 임의 `<br>` 대신 `SemanticHeading.lines`에 완결된 의미 덩어리를 전달한다.
영어는 한국어 줄 위치를 복사하지 않고 번역한 문장의 의미에 따라 별도 line group을
사용한다. 본문은 브라우저가 자연스럽게 배치하고, 버튼·짧은 상태 라벨만 줄바꿈을
막는다.

브라우저 WCJ 실행 중 실제로 다음 문제가 검출·수정되었다.

- 작은 오렌지 텍스트 대비 2.42:1 → 고대비 브랜드 색 적용
- 320px 헤더 가로 넘침 11px → 의미 단위 두 행 배치
- KO/ENG 추가 후 320px 헤더 넘침 → locale/phase control을 의미 단위 세로 배치

세부 기준은 `docs/architecture/wcj-web-compliance-journey-standard.md`에 있다.

## 5. 디자인 자산

원본 `design_concept/taptolk로고.png`는 변형하지 않았다.

- 원본과 공개 자산 크기: 1000×405
- SHA-256:
  `971b7d919208f172a96dbc25c8ec9f641fc01522a1aa7a35fc90feb86f2e546f`
- `apps/web/public/brand/taptolk-logo.png`는 byte-for-byte 복사
- 매 `pnpm verify`에서 원본과 공개 자산을 함께 검증
- Next Image 최적화 변환을 우회해 원본 PNG를 직접 표시

`스티커.png`의 외부 QR은 Taptolk 운영 자산으로 사용하지 않고 형태·재질 참고로만
유지한다. 나머지 컨셉은 밝은 배경, 넓은 터치 영역, 둥근 카드, 상태 중심 흐름만
참고하며 IA와 개인정보 정책은 마스터 명세가 우선한다.

## 6. Phase 1 Tenant/Admin 기반

- `Tenant`, `ManagementCompany`, `Site`, `Contract`, `AdminProfile`,
  `AdminMembership`, `AuditLog` Drizzle schema와 Supabase migration
- tenant/company/site 교차 참조를 막는 composite unique/FK와 scope check
- 모든 Phase 1 table의 RLS enable + force, 고정 `search_path`의 비재귀 scope helper
- browser의 audit insert 금지와 민감한 audit JSON key 거부
- 중앙 role/permission/scope/MFA 정책과 교차 tenant 거부 unit test
- Site lifecycle을 direct/request/approve/operational/contract 권한으로 분리
- QR Batch·Asset을 request/sample approval/generation approval/retry/assignment/revoke
  권한으로 분리하고 MVP 대량 생성 최종 승인을 Super Admin에 중앙화
- Site create/update/archive application service와 동일 transaction audit 계약
- authenticated browser의 Site 직접 insert/update 권한과 mutation RLS policy 제거
- Supabase 기본 table privilege를 초기화하고 역할별 최소 권한만 재부여
- `app_private`와 자동 RLS helper의 browser role 직접 접근 차단
- RLS `auth.uid()` 초기화와 계약 policy 분리로 Advisor 경고 제거
- FK covering index를 추가해 tenant 연관 조회·삭제 검사 경로 보호
- `/ko|en/admin/login` Email/Password 로그인과 locale 유지
- TOTP MFA 등록 QR·수동 키와 AAL2 challenge 화면
- `SUPER_ADMIN`, `MANAGEMENT_ADMIN`, `SITE_ADMIN`의 MFA 강제 및
  `SITE_OPERATOR`, `READ_ONLY`, `PLATFORM_OPERATOR`의 현재 명세 정책 적용
- 활성 profile과 membership을 서버에서 확인하고 여러 membership 권한은 합치지
  않은 채 하나의 안정적인 active context만 선택
- 플랫폼 역할은 `/admin/platform`, 고객 역할은 `/admin/dashboard`로 분리하고
  양쪽 모두 서버에서 역할을 재검증
- 모든 Admin route를 `force-dynamic`으로 지정해 사용자별 인증 결과 정적 캐시 금지

이는 Phase 1의 안전한 기반이며 전체 Phase 1 완료가 아니다. Docker PostgreSQL에서
pgTAP을 실행하고, Staging Auth/MFA와 인증된 Site CRUD E2E까지 통과해야 Phase 1
acceptance로 판정한다. Staging에서는 extension 설치 없이 catalog와 transaction
rollback 기반으로 동등한 RLS·권한·제약 검증을 수행했다.

## 7. 환경변수와 외부 서비스

`.env.example`에는 명세의 키만 있고 실제 값은 없다. 브라우저 허용 키는 다음
두 개뿐이다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

DB URL, Supabase Secret Key, 암호화·서명 키, SMS, Queue, Cron, Sentry token은 서버
전용이다.

Supabase Staging `taptolk-staging`은 2026-07-18 연결했다.

- Project ref: `evpwzjkhfppdjivkyokh`
- Region: Northeast Asia (Seoul), `ap-northeast-2`
- Data API: enabled
- Automatically expose new tables: disabled
- Automatic RLS: enabled
- Migration: 로컬/원격 7개 일치
- Secret/API key: 저장소와 문서에 저장하지 않음

Supabase Production, Vercel, SMS, Sentry 계정은 아직 연결하지 않았다.

## 8. 검증 결과

프로젝트 target은 Node 24.18.0이며, 현재 Codex Node 24.14.0 호환 runtime과
pnpm 10.34.5에서 확인한 결과:

| 검증 | 결과 |
|---|---|
| Frozen lockfile install | 통과 |
| Production dependency audit | 알려진 취약점 0건 |
| Biome lint | 118 files, 통과 |
| TypeScript | 10 workspace packages / 15 tasks, 통과 |
| Vitest | 10 files / 38 tests, 통과 |
| Migration static check | 7 migrations / 2 DB tests, 통과 |
| Secret scan | 163 text files, 통과 |
| Logo integrity | 원본·공개 자산 일치 |
| WCJ static | W/C/J 100/100/100, 36 sources |
| Next production build | `/ko`, `/en`, Admin Auth/MFA, locale API와 proxy 포함 통과 |
| Playwright | Desktop/Mobile 16 tests, 통과 |
| axe | 위반 0건 |

## 9. 아직 완료되지 않은 acceptance

- Supabase Local 실제 reset 및 pgTAP 실행: Docker daemon이 없어 실행 불가
- Staging pgTAP: `pgtap` extension이 없어 미실행; catalog/rollback 검증은 통과
- Supabase CLI `db push --dry-run`: 임시 login role 발급 지연; migration list는 정상
- Vercel Preview: 프로젝트 생성·외부 연결 승인 전이므로 미실행
- Sentry/SMS 실제 연결: 후속 승인 및 자격증명 필요
- Production Worker runtime: ADR 결정 필요
- Admin Auth/MFA 소스는 구현됐으나 Staging 공개 환경변수와 실제 관리자 계정으로
  로그인→등록→AAL2→role route acceptance 필요
- MFA recovery와 Admin idle timeout 운영 정책은 후속 구현 필요
- 인증된 Site CRUD repository/API/UI/E2E: Phase 1 후속 구현
- Phase 1 migration/tenant isolation pgTAP runtime: Docker DB에서 실행 필요
- 선택된 3번 Customer Portfolio 방향의 Platform/Company/Site별 화면 refinement

Admin Console은 Platform/Company/Site 관점의 IA, route, dashboard, read model, API,
Site/QR 권한과 상태 계약까지 설계됐다. Customer Portfolio 기반 3번 시각 방향도
선택됐다. 현재 role별 Auth entry와 보안 컨텍스트 UI는 구현됐지만 실제 Site/QR 운영
화면 refinement와 API는 아직 없다. 따라서 i18n과 Auth 소스 acceptance는 통과했고
Phase 1은 인증 기반까지 진행됐지만, Staging 실인증과 Site CRUD tenant isolation
E2E 전에는 Phase 1 전체 완료로 판정하지 않는다.
