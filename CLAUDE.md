# Taptolk — Claude Collaboration Brief

> 이 문서는 Claude가 Taptolk의 제품 의도, 현재 개발 상태, 아키텍처 경계와 작업 규칙을
> 빠르게 이해하기 위한 협업 진입점이다.
>
> **현재 기준일:** 2026-07-20  
> **현재 브랜치:** `codex/phase-1-foundation`  
> **현재 공식 단계:** `DEVELOPMENT_TEST`  
> **서비스 상태:** 개발·공유 테스트 준비 단계이며 실제 서비스 개시 전이다.

## 1. 문서 권한과 읽는 순서

작업 전 아래 문서를 순서대로 확인한다.

1. 사용자의 현재 지시
2. [`TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`](./TAPTOLK_MASTER_DEVELOPMENT_SPEC.md) — 제품과 전체 범위의 최상위 명세
3. [`AGENTS.md`](./AGENTS.md) — 현재 저장소의 필수 엔지니어링 계약
4. 승인된 [`docs/architecture/`](./docs/architecture/) 문서
5. 최신 [`docs/handoff-*.md`](./docs/)와
   [`pilot-readiness-checklist.md`](./docs/deployment/pilot-readiness-checklist.md) — 실제 구현·검증 현황
6. [`docs/04-report/`](./docs/04-report/) — 기능 단위 PDCA 및 검증 근거

Master Spec은 제품 목표와 설계 기준이고, 최신 Handoff·Checklist·Git 상태는 현재 구현
상태의 기준이다. 오래된 `current-state` 또는 `gap-analysis` 문서만 보고 현재 상태를
판단하지 않는다. 문서와 코드가 다르면 먼저 실제 코드와 검증 결과를 확인하고 차이를
보고한다.

## 2. 서비스 한 문장 정의

**Taptolk는 차량에 부착된 고유 QR을 통해 차주의 전화번호를 공개하지 않고도, 방문자가
필요한 차량 연락을 요청하고 차주가 제한된 응답을 보낼 수 있게 하는 프라이버시 중심의
차량 연락 운영 SaaS다.**

Taptolk는 단순 QR 생성기나 익명 채팅 서비스가 아니다. QR의 발급, 재고, 배정, 활성화,
교체, 폐기와 연락 세션, 응답, 미응답 에스컬레이션, 악용 방지, 감사 이력을 하나의 운영
흐름으로 관리한다.

## 3. 문제와 해결 방식

기존 차량 연락 방식은 차량에 전화번호를 그대로 노출한다. 이는 개인정보 노출, 스팸,
목적 외 연락, 번호의 장기 보관 문제를 만든다.

Taptolk는 다음 흐름으로 문제를 해결한다.

1. 관리 주체가 추적 가능한 QR 스티커를 발급하고 차량에 배정한다.
2. 차주는 본인 확인 후 QR을 자신의 차량 연락 수단으로 활성화한다.
3. 방문자는 앱 설치나 회원가입 없이 QR을 스캔한다.
4. 방문자는 정해진 연락 사유를 선택해 요청을 보낸다.
5. 서버가 차주의 실제 전화번호를 숨긴 채 알림을 중계한다.
6. 차주는 제한된 선택지로 응답하고, 방문자는 임시 웹 대기실에서 결과를 확인한다.
7. 세션은 목적을 달성하거나 만료되면 종료되며, 민감 데이터는 보존 정책에 따라 정리된다.

## 4. 제품 철학

### 4.1 Privacy by design

- 방문자와 차주의 전화번호는 서로에게 노출하지 않는다.
- 공개 QR은 최소 정보만 제공하며 내부 식별자나 개인정보를 전달하지 않는다.
- 전화번호, 메시지 본문, OTP, 쿠키, 인증 헤더, QR·활성화·응답 토큰은 로그, 문서,
  Git, 스크린샷, 채팅에 남기지 않는다.
- 민감한 공개 토큰은 원문 대신 해시 기반으로 검증하고 수명과 용도를 제한한다.

### 4.2 목적 제한형 연락

- 자유 채팅보다 주차·이동 요청처럼 명확한 목적의 짧은 연락을 우선한다.
- 연락 세션은 임시이며 상태, 만료 시각, 허용된 요청과 응답이 명확해야 한다.
- 제품 문구는 “익명 대화”보다 “전화번호를 공개하지 않는 필요한 차량 연락”을 말한다.

### 4.3 앱 없이 즉시 사용

- 방문자는 QR 스캔 후 모바일 웹에서 바로 요청할 수 있어야 한다.
- 공개 화면은 한 번에 하나의 주요 행동을 제공한다.
- 로그인이나 앱 설치를 방문자에게 강요하지 않는다.

### 4.4 운영 가능성과 추적 가능성

- QR은 디자인 파일이 아니라 수명주기를 가진 자산이다.
- 발급부터 폐기까지 상태 변경과 승인자를 추적한다.
- 중요 변경은 같은 트랜잭션에서 개인정보를 제거한 감사 이력을 남긴다.
- 미응답, 재시도, 알림 비용, 해결률을 운영 지표로 볼 수 있어야 한다.

### 4.5 Fail closed

- 설정, 권한, Provider 또는 스케줄이 준비되지 않으면 조용히 우회하지 않고 안전하게
  중단한다.
- 링크 보유, 화면 숨김, 브라우저 메타데이터는 권한이 아니다.
- 애플리케이션 RBAC와 PostgreSQL RLS를 독립적으로 모두 통과해야 한다.

### 4.6 개발은 편하게, 서비스는 엄격하게

- 개발·테스트 단계에서는 합성 데이터, Mock Provider, 승인된 테스트 Persona로 전체
  여정을 빠르게 검증한다.
- 서비스 단계에서는 Test Lab, Mock OTP, 역할 전환, 테스트 Fixture를 완전히 차단한다.
- 두 단계의 차이는 프론트엔드 스위치가 아니라 서버 정책과 CI로 강제한다.

## 5. 사용자와 역할

| 주체 | 인증 방식 | 핵심 목적 |
| --- | --- | --- |
| 방문자(Caller) | 로그인 없음, 목적 제한형 임시 세션 | QR 스캔 후 차주에게 연락 요청 |
| 차주(Owner) | 전화 OTP | QR 활성화, 요청 확인, 제한된 응답 |
| Super Admin | 관리자 로그인 + MFA | 플랫폼, Tenant, 승인, 테스트 운영 |
| Management Admin | 관리자 로그인 + MFA | 관리회사와 소속 Site 운영 |
| Site Admin | 관리자 로그인 + MFA | 특정 Site와 운영자 관리 |
| Site Operator | 관리자 로그인 | 현장 QR 재고·배정·연락 운영 |
| Read Only | 관리자 로그인 | 감사·운영 현황 조회 |

`tenant_id`가 고객 데이터의 최상위 격리 경계다. Management Company와 Site는 그 안의
운영 범위이며, 역할만 같아도 다른 Tenant 또는 Site 데이터에는 접근할 수 없다.

## 6. 핵심 서비스 시나리오

### 6.1 방문자가 차주에게 연락

1. 방문자가 차량의 활성 QR을 스캔한다.
2. 서버가 QR 상태, 연결 상태, 악용 제한과 만료 정책을 검사한다.
3. 방문자는 허용된 연락 사유를 선택한다.
4. 요청 생성 트랜잭션이 연락 세션과 발송 작업을 기록한다.
5. 실제 알림은 Queue와 Worker를 통해 Provider로 전달한다.
6. 방문자는 임시 대기실에서 polling으로 상태와 응답을 확인한다.
7. 해결, 신고, 만료 또는 운영 종료 시 세션이 닫힌다.

화면에서 “전송 완료”라고 표시하려면 서버가 실제 발송 접수 상태를 확인했어야 한다.
낙관적인 성공 문구로 Provider 실패를 숨기지 않는다.

### 6.2 차주가 QR을 활성화

1. 차주가 발급된 활성화 진입점을 연다.
2. 서버가 QR이 발급·배정 가능 상태인지 확인한다.
3. 차주가 OTP 본인 확인을 마친다.
4. 활성 Binding을 트랜잭션으로 생성하고 이전 상태를 보존한다.
5. 교체나 폐기 시 과거 QR·Binding 이력은 삭제하지 않고 종료 상태로 남긴다.

### 6.3 차주가 응답

1. 차주가 수신한 목적 제한형 응답 진입점을 연다.
2. 서버가 응답 토큰의 해시, 용도, 만료, 사용 여부를 확인한다.
3. 차주는 정의된 응답 중 하나를 선택한다.
4. 서버가 중복 응답을 방지하고 상태 변경과 감사를 같은 트랜잭션에 기록한다.
5. 방문자의 대기실에 응답 상태가 반영된다.

### 6.4 관리자가 QR Batch를 운영

1. 관리자가 Tenant·Management Company·Site 범위에서 Batch를 요청한다.
2. **한 Batch의 수량은 반드시 `1..100`이다.**
3. 디자인·샘플을 검토하고 승인자가 최종 생성을 승인한다.
4. 생성 작업은 Queue에 적재되고 Worker가 멱등적으로 처리한다.
5. PDF/SVG/CSV/ZIP 산출물과 항목별 생성 상태를 관리한다.
6. 입고, 배정, 활성화, 교체, 폐기까지 자산 이력을 보존한다.

100개를 넘는 수요는 여러 정상 Batch로 처리한다. 단일 1,000개 Batch로 계약을 바꾸지
않으며, 다른 수량 정책이 필요하면 먼저 별도의 quantity-policy 설계 승인을 받는다.

### 6.5 미응답 에스컬레이션

1. 연락 요청 후 정해진 시점에 차주 응답 지연을 안내한다.
2. 계속 미응답이면 승인된 운영 정책에 따라 관리사무소 에스컬레이션 후보가 된다.
3. 중복 알림을 방지하고, 재시도와 최종 실패를 추적한다.
4. 현재 개발 단계에서는 활성 Production Cron 없이 수동·인증된 테스트로 검증한다.

정확한 시간, 재시도 횟수, 보존 기간은 React 컴포넌트나 Route Handler에 직접
하드코딩하지 않고 타입이 있는 정책 모듈에서 관리한다.

## 7. 개발·테스트 단계와 서비스 단계

상세 정책은
[`stage-and-shared-testing-policy.md`](./docs/architecture/stage-and-shared-testing-policy.md)를
기준으로 한다.

### 7.1 현재: `DEVELOPMENT_TEST`

- 로컬과 공유 Staging에서 합성 데이터만 사용한다.
- 링크를 공유받은 사용자는 가입할 수 있지만, 가입만으로 권한이 생기지 않는다.
- 가입 계정은 승인 대기 상태이며 기존 AAL2 Super Admin의 승인이 필요하다.
- 승인된 테스트 Super Admin은 시간 제한형 테스트 접근 권한으로 Test Lab을 사용할 수
  있도록 설계한다.
- Test Lab은 Super Admin, 고객 관리자, 현장 운영자, 방문자, 차주 여정을 제공한다.
- 낮은 역할의 쓰기·RLS 검증은 별도의 실제 Persona identity와 격리된 합성 Tenant에서
  실행한다. Super Admin 세션을 역할 흉내에 재사용하지 않는다.
- 관리자에게는 하나의 명확한 로그인 진입점을 제공하고, 로그인 후 서버가 역할에 따라
  플랫폼 또는 고객 관리 화면으로 이동시킨다.
- SMS/CAPTCHA는 Mock·Sandbox 또는 fail-closed다.
- **현재 활성 Cron은 `0`이다.**

이 정책은 승인된 방향이지만 Test Lab과 공유 테스터 승인 기능은 아직 구현 전이다.
정책 문서가 존재한다는 이유로 기능이 완료됐다고 보고하지 않는다.

### 7.2 향후: `SERVICE`

- Production은 Staging과 계정, 데이터, Secret, Provider, 운영 책임을 분리한다.
- Test Lab, Persona launcher, Mock OTP, Fixture reset, UI role switching을 노출하지 않는다.
- 관리자는 승인된 실제 역할과 범위만 갖고 다른 사용자를 가장할 수 없다.
- 실제 SMS/CAPTCHA Provider와 Production Secret은 사용자 승인 후에만 설정한다.
- Cron은 실제 서비스 개시 시점에 운영자, 모니터링, 롤백, 장애 대응과 요금제 승인을
  함께 받은 뒤 활성화한다.
- Vercel Hobby에서 Cron 때문에 미리 업그레이드하지 않는다. 실제 시간당 Cron 활성화가
  필요한 시점에만 Pro/Enterprise 승인을 요청한다.

## 8. 시스템 아키텍처

### 8.1 요청 처리 계층

모든 기능은 아래 의존 방향을 지킨다.

```text
UI
  -> Route Handler
    -> Application Service
      -> Domain Policy
        -> Repository / Transaction
          -> PostgreSQL
```

- UI는 타입이 있는 content, DTO, policy, token을 소비한다.
- Route Handler는 입력 파싱, 인증 컨텍스트 구성, Application 호출과 응답 변환을 맡는다.
- Application Service는 유스케이스 순서, 권한 검사, 트랜잭션과 외부 Port 호출을 조정한다.
- Domain Policy는 상태 전이, 수량, 만료, 허용 행동 같은 비즈니스 규칙을 소유한다.
- Repository는 모든 Tenant-owned 조회·변경에 `tenant_id`와 필요한 scope를 포함한다.
- PostgreSQL은 FK, CHECK, UNIQUE, 트랜잭션과 RLS로 마지막 방어선을 제공한다.

React 컴포넌트와 Route Handler 안에 비즈니스 규칙, 사용자 문구, URL, Secret, 보존 기간,
rate limit, 상태 전이 또는 Provider 동작을 하드코딩하지 않는다.

### 8.2 런타임 구성

```text
Caller / Owner / Admin browser
              |
              v
       Next.js Web + API
              |
      +-------+--------+
      |       |        |
      v       v        v
 Supabase   Storage   Queue
 Auth +     artifacts   |
 Postgres               v
                      Worker
                        |
                        v
                SMS / Push Provider
```

- Node.js 24, pnpm 10, Turborepo
- Next.js 16 App Router, React 19, strict TypeScript
- Supabase Postgres, Auth, Storage, Queue
- Drizzle 기반 데이터 접근
- Vitest, pgTAP, Playwright
- QR 생성은 Queue + Worker 기반이며 at-least-once 전달을 전제로 멱등성을 보장한다.
- 공개 연락 상태 갱신은 현재 polling-first다.
- 핵심 트랜잭션과 QR 렌더링은 Node runtime을 사용한다.
- Server Component가 기본이며 상호작용에 필요한 경계만 Client Component로 둔다.

### 8.3 저장소 구조

| 경로 | 책임 |
| --- | --- |
| `apps/web` | 공개·차주·관리자 웹 UI와 Route Handler |
| `apps/worker` | Queue 소비, QR 생성, 비동기 작업 |
| `packages/application` | 유스케이스와 Application Service |
| `packages/auth` | 인증 컨텍스트, RBAC 정책 |
| `packages/config` | 타입이 있는 서버 설정 |
| `packages/db` | schema, repository, transaction, RLS 연계 |
| `packages/domain` | 엔티티, 상태, 정책, 불변 조건 |
| `packages/observability` | redaction, logging, tracing 경계 |
| `packages/qr-engine` | QR·인쇄 산출물 생성 |
| `packages/test-utils` | 안전한 합성 fixture와 테스트 도구 |
| `packages/ui` | 공유 UI primitive와 token |
| `supabase/migrations` | 순차 PostgreSQL migration |
| `supabase/tests` | pgTAP 보안·정책 검증 |
| `e2e` | 실제 사용자 여정 Playwright 검증 |

### 8.4 인증과 권한

- 관리자 로그인 시스템은 하나이며 로그인 후 서버가 역할과 scope로 화면을 분기한다.
- 관리자 권한은 승인된 profile, membership, Tenant/Site scope, 필요한 AAL을 모두 확인한다.
- 차주는 OTP로 확인하되 전화번호를 브라우저 로그나 운영 로그에 노출하지 않는다.
- 방문자는 회원가입 대신 만료되는 목적 제한형 HttpOnly 세션을 사용한다.
- Service-role credential은 서버 전용이며 브라우저 bundle이나 `NEXT_PUBLIC_`에 넣지 않는다.
- Browser-accessible table에는 명시적 RLS와 policy test가 있어야 한다.
- 프론트엔드 메뉴 숨김은 편의 기능일 뿐 권한 검사가 아니다.

### 8.5 외부 Provider와 비동기 처리

- SMS, CAPTCHA, Push, Storage는 Port/Adapter 경계 뒤에 둔다.
- 개발 단계에서는 Mock 또는 Sandbox adapter를 사용하고 실발송을 기본값으로 두지 않는다.
- Provider 요청은 idempotency key, 재시도 분류, 최종 실패 상태를 가진다.
- Worker는 같은 작업을 두 번 받아도 자산이나 메시지를 중복 생성하지 않아야 한다.
- Secret, Provider token, Cron bearer, DB credential은 파일이나 명령 출력에 남기지 않는다.

## 9. 웹 경험 원칙

### 9.1 화면 영역 분리

- Public landing/onboarding: 서비스 소개, 방문자·차주 진입, 관리자 로그인 안내
- Caller: QR 연락 요청과 임시 대기실
- Owner: QR 활성화, 요청 확인, 응답
- Customer Admin: Management Company와 Site 운영
- Platform Admin: Tenant, 승인, 플랫폼 운영

Public, Customer Admin, Platform Admin은 목적과 권한이 다르다. 로그인 계정 체계는 하나로
단순화하되 로그인 이후 화면과 권한 경계는 합치지 않는다.

### 9.2 국제화와 문구

- 모든 사용자 경로는 `/ko` 또는 `/en` locale segment를 사용한다.
- 사용자 문구는 타입이 있는 locale dictionary에 한국어와 영어를 함께 작성한다.
- Headline은 언어별 의미 단위로 작성하고 `SemanticHeading`을 사용한다.
- 한국어 줄바꿈 위치를 영어에 복사하거나 화면 폭에 맞춰 임의 `<br>`를 넣지 않는다.
- 개발 단계, 기술 스택, 내부 gate 같은 개발자 문구를 사용자 랜딩의 가치 제안으로 쓰지
  않는다.

### 9.3 WCJ

WCJ는 `Web Compliance & Journey`다.

- 웹 페이지 또는 컴포넌트 변경 후 `corepack pnpm validate:wcj`
- phase 완료 보고 전 `corepack pnpm verify`
- 자동 통과와 별도로 keyboard, screen reader, computed contrast, responsive,
  real-device, 실제 사용자 journey를 수동 검증한다.
- 320, 768, 1280, 1920 CSS px에서 headline 의미와 리듬을 확인한다.

## 10. 현재 개발 현황

### 10.1 완료·검증된 기반

- 현재 브랜치: `codex/phase-1-foundation`
- 최신 구현·Production 배포 기준 커밋: `0e2a15e`
- Public landing/onboarding 분리 구현 기준 커밋: `6a78fd9`
- 현재 문서 기준점 이전 HEAD: `4beeb80`
- GitHub Actions 최근 기준: `29738889705` PASS
- Production URL: <https://taptolk.vercel.app>
- 사용자 Landing, 방문자·차주 onboarding, 관리자 로그인 진입 분리 구현
- Tenant, Management Company, Site, 관리자 승인, RBAC/RLS 기반
- QR Batch, sample approval, queue dispatch, final generation, inventory 기반
- Owner activation, public contact, owner notification reply
- escalation, abuse control, analytics, privacy cleanup route 기반
- clean local Supabase reset 2회 PASS
- local pgTAP 23 files / 587 tests PASS
- linked Staging pgTAP 23 files PASS
- authenticated Staging focused E2E 28 PASS
- 별도 승인된 QR `10 Batch × 100 items` acceptance PASS
- lint, typecheck, unit, DB static check, secret scan, logo integrity, WCJ, production build PASS
- Production Cron은 의도대로 비활성 `0`, endpoint는 fail-closed

세부 증거는 최신 [`handoff-0720-1531.md`](./docs/handoff-0720-1531.md)와
[`phase-0-9-development-closeout.report.md`](./docs/04-report/phase-0-9-development-closeout.report.md)를
확인한다.

### 10.2 설계 완료, 구현 대기

- 개발·테스트 단계와 서비스 단계의 명시적 server-only stage policy
- 공유 링크 가입자의 승인 대기와 시간 제한형 test access grant
- 승인된 Super Admin용 Test Lab
- 실제 scope를 가진 낮은 역할 Persona 세션
- 방문자·차주 합성 scenario 생성·reset·종료·결정적 cleanup
- Service build에서 test-only surface가 누출되지 않게 하는 CI guard
- 하나의 관리자 로그인 진입과 역할 기반 post-login routing의 최종 정리

### 10.3 사용자 결정 또는 외부 권한 대기

다음 항목은 임의로 선택하거나 생성하지 않는다.

- Production Supabase 프로젝트와 Region
- Production SMS Provider
- Production CAPTCHA Provider
- Production Secret과 credential
- 실제 Cron 활성화와 필요한 Vercel 요금제
- 모니터링, 롤백, 장애 대응 담당자
- 실기기, 스크린리더, 인쇄·스캔 현장 검수 담당자

현재 Free/Hobby 사용 자체가 개발을 막는 것은 아니다. Docker Desktop은 유료 Production
인프라가 아니라 Supabase 로컬 스택을 격리해 clean reset과 전체 pgTAP을 재현하기 위한
개발 도구다. 이미 승인·설치되어 로컬 검증에 사용 중이다.

## 11. 다음 개발 우선순위

외부 설정 승인이 필요 없는 범위에서 다음 순서를 따른다.

1. 타입이 있는 server-only stage policy와 Service 누출 방지 CI guard
2. 하나의 관리자 로그인 진입과 서버 역할 routing
3. staging test access grant schema, 승인 UI, 만료·회수·감사
4. 격리된 합성 scenario fixture와 Test Lab
5. 실제 낮은 역할 Persona, Caller, Owner test launcher
6. 결정적 cleanup, pgTAP, authenticated Staging E2E
7. WCJ, `pnpm verify`, clean local reset, 전체 pgTAP 재검증
8. Checklist, PDCA report, 새 handoff 갱신

새 기능을 시작하기 전 최신 Handoff의 `Exact next step`과 Git 상태를 다시 확인한다.

## 12. Claude 작업 규칙

### 시작할 때

1. `git status --short`, 현재 branch, HEAD를 확인한다.
2. `AGENTS.md`, Master Spec의 관련 절, 최신 Handoff의 `Exact next step`을 읽는다.
3. 현재 기능이 `DEVELOPMENT_TEST` 전용인지 `SERVICE`에도 필요한지 선언한다.
4. 관련 Domain Policy, Application Service, Repository, migration, pgTAP, E2E를 먼저 찾는다.
5. 기존 사용자 변경과 unrelated dirty file을 보존한다.

### 구현할 때

- 가장 작은 안전한 수직 slice를 구현한다.
- UI에서 DB나 Provider를 직접 호출하지 않는다.
- 데이터 격리는 화면 필터가 아니라 RBAC + repository scope + RLS로 검증한다.
- 보안 관련 mutation은 redacted audit과 같은 트랜잭션에 둔다.
- 공개 응답 DTO는 최소화한다.
- 오류, empty, loading, forbidden, expired, retry 상태를 함께 설계한다.
- user-facing copy는 KO/EN dictionary에 동시에 추가한다.
- 새 package는 실제 책임, public API, test가 있을 때만 만든다.
- 기존 상태 이력은 삭제보다 종료·폐기 상태로 보존한다.

### 절대 임의로 하지 말 것

- Production 프로젝트, Region, Provider, Secret, 요금제 선택
- 활성 Cron 추가
- 자동 Super Admin 부여
- 링크를 권한으로 사용
- frontend metadata로 역할 승인
- 단일 1,000-item Batch 또는 `1..100` 계약 변경
- 실제 전화번호, 메시지, OTP, QR·activation·response token을 테스트에 사용
- credential이나 민감값을 Git, 문서, 로그, 스크린샷, 채팅에 출력
- 테스트 UI가 있다는 이유로 실제 RBAC/RLS 검증을 생략
- 문서만 작성한 상태를 구현 완료라고 보고

### 보고할 때

- 먼저 결과와 사용자에게 남은 결정 사항을 말한다.
- 구현 완료, 자동 검증 완료, 수동 검증 대기를 구분한다.
- PASS 주장에는 명령, 범위, 테스트 수 또는 CI run을 붙인다.
- Production이라는 단어는 실제 Production에 배포·검증된 경우에만 사용한다.
- major feature 완료 또는 반복 오류 시 `docs/handoff-MMDD-HHmm.md`를 작성한다.
- Handoff에는 branch/commit, 완료 범위, 검증, 위험, 사용자 외부 설정, `Exact next step`을
  포함하고 Secret은 포함하지 않는다.

## 13. 표준 검증 명령

```bash
# 저장소 전체 자동 gate
corepack pnpm verify

# 웹 변경 직후
corepack pnpm validate:wcj

# 로컬 Supabase
corepack pnpm db:start
corepack pnpm db:reset:local
corepack pnpm exec supabase test db --local

# 연결 대상이 승인된 Staging임을 확인한 후
corepack pnpm db:test:linked

# 필요한 인증 환경이 안전하게 주입된 Staging에서
corepack pnpm e2e:staging

# 문서와 코드의 민감값 검사
corepack pnpm verify:secrets
```

QR 대량 acceptance는 일반 E2E와 분리되어 있다. 실행 전 격리된 Staging인지 확인하고
`10 × 100`처럼 계약 안의 여러 Batch로 실행한다.

## 14. 완료 정의

기능 완료는 코드가 존재한다는 뜻이 아니다. 최소한 다음이 충족돼야 한다.

- typed input validation
- authentication과 authorization
- Tenant/Site scope와 RLS
- transaction과 idempotency
- redacted audit
- unit, integration/pgTAP, 필요한 E2E
- loading, empty, error, forbidden, expired 상태
- 모바일·접근성·KO/EN
- 안전한 observability와 Secret redaction
- 관련 문서, checklist, PDCA report, handoff
- CI PASS

Phase 1 데이터 기반은 clean migration reset, 전체 pgTAP, authenticated Site CRUD,
tenant-isolation E2E 없이 완료라고 부르지 않는다.

## 15. Claude가 처음 답해야 할 질문

작업 요청을 받으면 내부적으로 다음을 확인한 뒤 진행한다.

1. 이 변경은 방문자, 차주, 고객 관리자, 플랫폼 관리자 중 누구를 위한 것인가?
2. 현재 단계 전용인가, 서비스 단계에도 배포되는가?
3. 어떤 Tenant/Site/역할 경계를 통과해야 하는가?
4. 비즈니스 규칙의 소유 모듈은 어디인가?
5. 실패 시 안전한 기본값은 무엇인가?
6. 어떤 pgTAP·E2E가 권한과 실제 여정을 증명하는가?
7. 사용자 승인이나 외부 권한이 필요한 지점은 어디인가?

답을 찾을 수 있는 항목은 저장소에서 확인하고 진행한다. Production 선택, Secret,
Provider, 요금제, 운영 담당자처럼 권한이 필요한 항목만 정확한 승인 지점에서 사용자에게
요청한다.
