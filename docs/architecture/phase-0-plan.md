# Taptolk Phase 0 Plan

- 상태: **승인됨 · 로컬 소스 구현 완료 · 외부 acceptance 대기**
- 구현 시작: **2026-07-18**
- 기준: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`의 Phase 0 — Foundation
- 목표: 구현 Phase들이 안전하게 누적될 수 있는 재현 가능한 Monorepo, Local DB, CI, 관측성, 환경 검증, 기본 UI 기반을 만든다.

## 1. 승인 기록과 Hard Gate

사용자가 2026-07-18 다음 원칙과 함께 Phase 0 진행을 승인했다.

- 하드코딩하지 않고 모듈화
- WCJ 웹표준 검증기를 만들고 지속 검증
- Hero, 제목, 본문의 줄바꿈을 의미·맥락 단위로 처리

승인 전 금지했던 다음 항목 중 로컬 Phase 0 범위만 실행했다.

- Phase 0 패키지 설치와 lockfile 생성
- Next.js/Turborepo와 애플리케이션 Foundation 생성
- 로컬 DB migration 작성과 정적 검사

다음 외부 작업은 여전히 별도 승인 전 금지한다.

- Supabase/Vercel/SMS/Sentry 연결
- Git remote/branch/commit/push 생성
- Production Worker host 확정

기존 디자인 자산은 수정하지 않았고 `.gitignore`의 사용자 규칙을 보존·확장했다.

## 2. Phase 0 범위

### 포함

- Node 24, pnpm 10 프로젝트 고정
- pnpm/Turborepo workspace
- 최소 Next.js 16 App Router shell
- 별도 Worker package의 실행 계약
- TypeScript strict와 package boundary
- 환경변수 client/server 분리 검증
- Supabase Local과 Drizzle 기반
- 최소 DB migration 자동화와 DB smoke test
- 기본 UI token과 접근 가능한 Button/상태 shell
- 원본 Taptolk 로고의 무결성 보존
- Sentry/구조화 로그의 PII redaction 기본값
- Vitest, Playwright smoke, CI
- Local one-command start와 운영 문서

### 제외

- Tenant/Admin 업무 Schema와 CRUD
- 실제 Auth/MFA/Phone OTP
- 실제 SMS Provider 연결
- QR 생성, Binding, Contact Session
- Sticker render/PDF/ZIP
- Storage bucket과 실데이터 업로드
- Production RLS 정책
- 원격 Supabase project 생성/연결
- Vercel project 생성/Production 배포
- 디자인 화면 전체 구현

Phase 0에서 빈 도메인 package를 대량 생성하지 않는다. 각 업무 package는 실제 소유 기능이 시작되는 Phase에서 추가한다.

## 3. 제안 결정

| ID | 제안 | 이유 | 승인 전 상태 |
|---|---|---|---|
| P0-D1 | `packageManager`와 Corepack으로 pnpm 10 고정 | 로컬 pnpm 11 오사용 방지 | 대기 |
| P0-D2 | `.node-version`과 `engines.node`로 Node 24 고정 | 로컬 Node 22 불일치 차단 | 대기 |
| P0-D3 | Formatter/Linter는 Biome 하나만 사용 | 중복 설정과 상충 방지 | 대기 |
| P0-D4 | Supabase migration directory를 실행 기준으로 사용 | DB 변경의 단일 재현 경로 | 대기 |
| P0-D5 | Drizzle은 schema/type 및 migration 생성 도구로 사용 | ORM과 Supabase CLI 역할 분리 | 대기 |
| P0-D6 | Phase 0 DB는 extension/smoke만, 업무 테이블은 Phase 1부터 | YAGNI와 명세 Phase 순서 준수 | 대기 |
| P0-D7 | 원본 로고를 ASCII 경로로 byte-for-byte 복사하고 checksum 검사 | Unicode 경로 안정성, 변형 금지 | 대기 |
| P0-D8 | Worker는 Local 계약만 만들고 Production host는 ADR로 보류 | Vercel 장기 Worker 오판 방지 | 대기 |
| P0-D9 | Supabase/Vercel 원격 연결은 Local 검증 이후 별도 게이트 | 외부 상태 변경과 Secret 취급 분리 | 대기 |

패키지의 정확한 patch 버전은 승인 후 공식 호환 범위 안에서 선택하고 lockfile로 고정한다. `latest`를 사용하지 않는다.

## 4. 실행 순서

### Step 0 — Baseline 보호

- `git status` 재확인
- 사용자 변경 `.gitignore`와 `design_concept/` checksum 기록
- 마스터 명세 checksum 기록
- 기존 작업을 자동 stage/commit하지 않음

### Step 1 — Root Monorepo

- Node/pnpm/TypeScript/Biome 정책
- pnpm workspace
- Turborepo task graph
- scripts와 CI command contract
- Root README/AGENTS

### Step 2 — Web Foundation

- Next.js 16 App Router 최소 shell
- Node Runtime 고정
- health route
- 전역 token/typography
- 원본 로고 표시
- Loading/Error/Not Found 기본 상태
- 브라우저에 server secret이 번들되지 않는 경계

### Step 3 — Config/Environment

- client env와 server env schema 분리
- 빌드 시 필수값 검증
- Local mock 기본값
- `.env.example`에는 빈 값과 설명만 제공
- Secret denylist 테스트

### Step 4 — Supabase Local/Drizzle

- Supabase Local config
- 최소 extension migration
- DB client package
- Transaction pool의 `prepare: false`
- migration reset/check 명령
- Local DB smoke test

업무 테이블, RLS policy, Auth hook은 생성하지 않는다.

### Step 5 — Worker Contract

- Queue consumer entrypoint
- job payload validation
- idempotent handler interface
- graceful shutdown
- health/logging

실제 Queue와 SMS job은 후속 Phase에서 연결한다.

### Step 6 — Observability

- Web/Worker 공통 structured logger
- Sentry 초기화 경계
- 전화번호, token, cookie, message, authorization header redaction
- Local에서는 외부 전송 없이 console/mock 가능

### Step 7 — Test/CI

- Unit smoke
- env validation test
- logo checksum test
- DB migration smoke
- Web health Playwright smoke
- lint/typecheck/test/db:check/build pipeline

### Step 8 — Preview Gate

- Local acceptance 통과 후 결과 보고
- 사용자의 별도 승인 후에만 GitHub/Vercel 연결
- Vercel Preview와 Supabase Staging은 자격증명이 준비된 경우에만 실행

## 5. 파일 단위 계획

표기:

- `C`: 생성
- `M`: 기존 파일 수정
- `G`: 승인 후 도구가 생성하며 수동 작성하지 않음
- `D`: 후속 Phase로 연기

### 5.1 Root

| 상태 | 파일 | 목적 |
|---|---|---|
| M | `.gitignore` | 현재 사용자 변경을 보존하면서 secret/build/local Supabase 산출물 보강 |
| C | `.env.example` | 명세의 환경 키, 빈 값, public/server 구분 |
| C | `.node-version` | Node 24 고정 |
| C | `.npmrc` | engine/package manager 준수 정책 |
| C | `package.json` | private workspace, scripts, engines, packageManager |
| C | `pnpm-workspace.yaml` | `apps/*`, `packages/*` |
| G | `pnpm-lock.yaml` | 승인된 설치 결과를 정확히 고정 |
| C | `turbo.json` | dev/lint/typecheck/test/db:check/build task graph |
| C | `tsconfig.base.json` | strict, no type bypass, 공통 compiler options |
| C | `biome.json` | 단일 formatting/lint 정책 |
| C | `vitest.workspace.ts` | package별 unit test workspace |
| C | `playwright.config.ts` | Web smoke와 브라우저 기반 |
| C | `AGENTS.md` | 마스터 명세 우선, 레이어/보안/승인 규칙 |
| C | `README.md` | 현재 Phase, Local start, 검증 명령, 외부 연결 게이트 |

### 5.2 Web app

| 상태 | 파일 | 목적 |
|---|---|---|
| C | `apps/web/package.json` | Next/React/Web scripts와 pinned major |
| C | `apps/web/tsconfig.json` | Web 전용 TypeScript 설정 |
| C | `apps/web/next.config.ts` | Node runtime, security headers 기본, Sentry 경계 |
| C | `apps/web/postcss.config.mjs` | Tailwind 처리 |
| C | `apps/web/app/layout.tsx` | 한국어 문서, font, metadata |
| C | `apps/web/app/page.tsx` | Foundation 상태 화면, 제품 기능 없음 |
| C | `apps/web/app/globals.css` | 명세 token과 접근성 기본 스타일 |
| C | `apps/web/app/loading.tsx` | 공통 loading 상태 |
| C | `apps/web/app/error.tsx` | 안전한 사용자 오류와 request ID 표시 |
| C | `apps/web/app/not-found.tsx` | 404 상태 |
| C | `apps/web/app/api/health/route.ts` | PII 없는 health response |
| C | `apps/web/instrumentation.ts` | server observability 초기화 |
| C | `apps/web/instrumentation-client.ts` | client observability 초기화 |
| C | `apps/web/sentry.server.config.ts` | server Sentry/redaction |
| C | `apps/web/sentry.edge.config.ts` | Edge가 필요한 보조 경로의 Sentry 설정 |
| C | `apps/web/public/brand/taptolk-logo.png` | 원본 PNG byte-for-byte 복사 |

### 5.3 Worker app

| 상태 | 파일 | 목적 |
|---|---|---|
| C | `apps/worker/package.json` | Node Worker scripts |
| C | `apps/worker/tsconfig.json` | Worker strict TS |
| C | `apps/worker/src/index.ts` | lifecycle/graceful shutdown |
| C | `apps/worker/src/queue-consumer.ts` | consumer interface, 실제 job 없음 |
| C | `apps/worker/src/jobs/index.ts` | typed empty registry와 unknown job 거부 |
| C | `apps/worker/src/health.ts` | Local health/readiness |

Production Worker deployment manifest는 ADR 승인 전 생성하지 않는다.

### 5.4 Shared packages

| 상태 | 파일 | 목적 |
|---|---|---|
| C | `packages/config/package.json` | 환경 설정 package |
| C | `packages/config/tsconfig.json` | package TS |
| C | `packages/config/src/env.client.ts` | public env allowlist |
| C | `packages/config/src/env.server.ts` | server secret schema |
| C | `packages/config/src/index.ts` | 안전한 export |
| C | `packages/config/src/env.test.ts` | 누락/노출 검증 |
| C | `packages/db/package.json` | Drizzle/postgres-js/Supabase DB scripts |
| C | `packages/db/tsconfig.json` | DB TS |
| C | `packages/db/drizzle.config.ts` | migration generation config |
| C | `packages/db/src/client.ts` | server-only connection, `prepare: false` |
| C | `packages/db/src/schema/index.ts` | Phase 0 empty schema entrypoint |
| C | `packages/db/src/index.ts` | DB export |
| C | `packages/ui/package.json` | 기본 UI package |
| C | `packages/ui/tsconfig.json` | UI TS |
| C | `packages/ui/src/styles/tokens.css` | 명세 UI token |
| C | `packages/ui/src/components/button.tsx` | 접근 가능한 기본 Button |
| C | `packages/ui/src/index.ts` | UI public API |
| C | `packages/observability/package.json` | logger/Sentry adapter |
| C | `packages/observability/tsconfig.json` | observability TS |
| C | `packages/observability/src/logger.ts` | 구조화 로그와 denylist |
| C | `packages/observability/src/sentry.ts` | Sentry adapter/redaction |
| C | `packages/observability/src/index.ts` | public API |
| C | `packages/test-utils/package.json` | 공통 test helper |
| C | `packages/test-utils/tsconfig.json` | test-utils TS |
| C | `packages/test-utils/src/index.ts` | 최소 helper export |

다음 package는 Phase 0에서 만들지 않는다.

- `domain`, `application`, `auth`, `crypto`, `notification`
- `qr-engine`, `sticker-renderer`, `validation`

각 package는 실제 기능과 테스트가 함께 시작될 때 생성한다.

### 5.5 Supabase

| 상태 | 파일 | 목적 |
|---|---|---|
| C | `supabase/config.toml` | Local ports/Auth/DB 기본 설정 |
| C | `supabase/seed.sql` | Phase 0에는 PII 없는 smoke seed 또는 빈 파일 |
| C | `supabase/migrations/00000000000000_phase_0_extensions.sql` | 필요한 extension의 재현 가능한 기반 |
| C | `supabase/tests/database/phase_0_smoke.sql` | migration/extension smoke |

`supabase/functions/send-sms-hook/`은 실제 OTP/SMS 설계 Phase까지 연기한다.

### 5.6 Scripts, tests, CI

| 상태 | 파일 | 목적 |
|---|---|---|
| C | `scripts/verify-env.mjs` | env key/분류 검사 |
| C | `scripts/verify-logo-integrity.mjs` | 원본과 배포 자산 SHA-256 일치 검사 |
| C | `scripts/check-no-secrets.mjs` | client bundle/config secret denylist |
| C | `e2e/phase-0-health.spec.ts` | health와 Foundation page smoke |
| C | `.github/workflows/ci.yml` | install/lint/typecheck/test/db/build |

### 5.7 운영 문서

| 상태 | 파일 | 목적 |
|---|---|---|
| C | `docs/development/local-setup.md` | Node/pnpm/Docker/Supabase Local 시작 |
| C | `docs/development/validation.md` | Phase 0 검증 명령과 기대 결과 |
| C | `docs/security/secrets-and-pii.md` | Secret 분류, 금지 로그, rotation |
| C | `docs/deployment/environment-matrix.md` | Local/Staging/Production 분리 |
| C | `docs/architecture/worker-runtime-decision.md` | Worker 후보 비교와 승인 결과 기록 |
| M | `docs/architecture/current-state.md` | 구현 후 실제 상태 갱신 |
| M | `docs/architecture/gap-analysis.md` | 해소된 Gap과 잔여 Blocker 갱신 |
| M | `docs/architecture/phase-0-plan.md` | 승인 기록과 결과 링크 추가 |

## 6. 의존성 설치 계획

승인 전에는 설치하지 않는다. 승인 후에도 다음 원칙을 적용한다.

1. 명세 Major를 만족하는 stable 버전만 선택
2. RC/experimental 금지
3. 라이선스와 유지보수 상태 확인
4. package별 실제 사용 근거가 있는 의존성만 추가
5. exact lockfile 커밋
6. formatter/linter 중복 설치 금지
7. install 직후 dependency tree와 취약점 결과 보고

Phase 0의 예상 범주는 다음과 같다.

- Build: Turborepo, TypeScript, pnpm
- Web: Next.js, React, React DOM, Tailwind
- Validation: Zod
- DB: Drizzle ORM, drizzle-kit, postgres-js, Supabase CLI
- Test: Vitest, Playwright
- Quality: Biome
- Monitoring: Sentry Next.js/Node

Radix, React Hook Form, QR, Sharp, PDF 관련 package는 사용하는 Phase까지 설치를 연기한다.

## 7. 검증 계획

승인 후 구현 단계에서만 실행한다.

```text
corepack pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm db:check
pnpm build
pnpm e2e:smoke
```

추가 확인:

- `pnpm dev` 한 명령으로 필요한 Local 서비스 시작 또는 명확한 선행조건 안내
- `supabase db reset` 재현 성공
- 빈 DB에서 migration 성공
- 로고 checksum 일치
- client bundle에 server secret key 이름/값 없음
- Sentry mock event에 PII 없음
- Web health와 Worker health 성공
- 기존 디자인 자산 checksum 불변

## 8. Phase 0 Acceptance 해석

| 명세 Acceptance | 완료 기준 | 외부 게이트 |
|---|---|---|
| Local one-command start | 문서화된 한 명령과 재현 테스트 | Docker/CLI 승인 |
| Typecheck/Test/Build 성공 | CI와 로컬 결과 기록 | 없음 |
| Preview Deploy | Vercel Preview URL과 build log | Vercel/GitHub 연결 별도 승인 |
| DB Migration 자동화 | 빈 Local DB reset/check 성공 | 원격 DB 연결 불필요 |

Vercel 또는 Supabase 자격증명이 없으면 Local Foundation 완료와 외부 Preview 완료를 구분해 보고한다. 자격증명 부재를 숨기거나 임의 프로젝트를 만들지 않는다.

## 9. 승인 요청 범위

Phase 0 착수 승인 시 다음 권한이 필요하다.

1. 위 파일 생성·수정
2. Node 24/pnpm 10 프로젝트 고정
3. 필요한 Phase 0 package 설치와 lockfile 생성
4. Supabase Local/Docker 기반 migration smoke
5. Local lint/typecheck/test/build/E2E

다음은 Phase 0 승인과 별개로 다시 승인받는다.

- Git remote 설정과 push
- GitHub Actions를 원격에서 실행
- Vercel 프로젝트 생성·연결·Preview 배포
- Supabase Staging/Production 연결
- SMS/Sentry 실제 자격증명 연결
- Production Worker host 결정과 배포

## 10. 2026-07-18 실행 결과

### 완료

- Node 24.18.0, pnpm 10.34.5, exact lockfile
- Turborepo 기반 Web/Worker/5개 공통 package
- Next.js Foundation page, 상태 화면, health API
- client/server 환경변수 Zod 경계
- Supabase Local config, migration, seed, pgTAP test
- Drizzle/postgres-js `prepare: false` 연결 경계
- Sentry Node adapter, 구조화 로그, PII redaction
- UI token, Button, SemanticHeading, JourneyStatus
- TAPTOLK WCJ 1.0 19개 정적 규칙과 CI fail gate
- 의미 기반 제목 줄바꿈과 한국어 wrapping 규칙
- desktop/mobile Playwright, axe, health, 320px overflow test
- GitHub Actions workflow와 개발·보안·배포 문서
- 원본 로고의 byte-for-byte 공개 자산과 SHA-256 검사

### 검증

```text
Frozen install       PASS
Production audit     PASS (known vulnerabilities 0)
Biome lint           PASS (69 files)
TypeScript           PASS (7 workspace packages)
Vitest               PASS (4 files, 8 tests)
DB static check      PASS (1 migration, 1 pgTAP test)
Secret scan          PASS (93 text files)
Logo checksum        PASS
WCJ                  PASS (W/C/J 100/100/100)
Next build           PASS
Playwright + axe     PASS (6 tests)
```

### 남은 acceptance

- Docker daemon 부재로 `supabase db reset`과 `supabase test db` 미실행
- Git remote가 없어 GitHub Actions 원격 실행 미확인
- 별도 승인 전이므로 Vercel Preview 미배포

따라서 다음 안전한 Step은 Docker Desktop 준비 후 Local DB acceptance다. 그 다음
사용자 승인에 따라 commit/push와 Vercel Preview를 진행하고, Phase 1 schema design
gate로 이동한다.
