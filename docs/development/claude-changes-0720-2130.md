# Claude 직접 수정 공유 — 2026-07-20 21:30 KST

> 작성: Claude (리뷰 담당)
> 수신: Codex (구현 담당)
> 기준: `codex/phase-1-foundation`, 수정 전 HEAD `7924d6b`
> 성격: 사용자 지시로 Claude가 **직접 수정**한 사용자 문구·랜딩 디자인 변경 내역.
> Codex는 이후 작업에서 이 문서를 최신 코드 상태의 기준으로 삼는다.
> 관련 지시서: `docs/development/codex-workorder-0720-2055.md` (Task 0~3은 여전히 Codex 담당)

## 1. 변경 배경

Production 화면과 문구 사전 전수 리뷰 결과 다음 문제가 확인되어 사용자가 Claude에게
직접 수정을 지시했다.

1. Production 로그인 화면에 내부 설정 문구 노출("스테이징 Supabase 공개 URL과
   Publishable Key를 서버 환경변수에…", 환경변수명 `SUPABase_SECRET_KEY` 노출 포함)
2. `1..100` 수량 계약 위반 문구("최대 10,000개") — Task 0의 UI 측면
3. 제품 철학과 어긋나는 "익명" 표현 (CLAUDE.md 4.2)
4. 개발 과정 문구가 제품 UI에 잔존("다음 개발 범위", "다음 구현에서", "수동 Pilot Gate",
   "Read model", "사이트 CRUD…연결하기 전에")
5. 용어 불일치(관리업체/관리회사, 호출자/방문자, Site/사이트 일부)
6. 랜딩 UX: 내비 강조가 "플랫폼 어드민"에 걸림, 모바일 언어 스위처 과대,
   `/owner` 오류 화면 dead-end, 히어로 시각 요소 빈약

## 2. 파일별 변경 내역

### 2.1 `apps/web/content/messages.ts` (KO/EN 동시 수정)

**익명 표현 제거 (철학 정합):**

| 키 | 변경 |
|---|---|
| `landing.eyebrow` | "QR로 시작하는 익명 차량 커뮤니케이션" → "전화번호 공개 없이 시작하는 차량 연락" / EN "Vehicle contact that starts without sharing a phone number" |
| `metadata.description` | "QR 기반 익명 차량 커뮤니케이션 플랫폼" → "전화번호를 공개하지 않는 QR 차량 연락 서비스" / EN 동일 취지 |
| `landing.privacy.description` | "Contact Session" → "임시 연락 세션"(KO) / "temporary session"(EN), 호출자 → 방문자 |

**설정 배너 사용자 언어화 (내부 정보 제거):**

| 키 | 변경 |
|---|---|
| `admin.auth.configuration.title` | "인증 환경 연결이 필요합니다." → "로그인 준비 중입니다." |
| `admin.auth.configuration.description` | Supabase/Key/환경변수 서술 제거 → "서비스 연결이 완료되면 로그인할 수 있습니다. 문제가 계속되면 Taptolk 운영팀에 문의해 주세요." |
| `admin.auth.error.configuration` | 동일 취지로 교체 |
| `admin.approvals.configuration.title/description` | `SUPABASE_SECRET_KEY` 언급 제거, 운영 문서 참조로 교체 |
| `admin.approvals.error.configuration` | "서버 연결 설정을 확인해 주세요." |

설정에 필요한 실제 환경변수명은 `.env.example`과 운영 문서에 이미 있으므로 UI에서
반복하지 않는다. **fail-closed 동작 자체는 변경하지 않았다** — 문구만 교체.

**개발 과정 문구 제거:**

| 키 | 변경 |
|---|---|
| `admin.dashboard.description` | "사이트 CRUD와 QR 관리 기능을 연결하기 전에…" → "인증된 역할과 소속 범위를 확인하고 허용된 운영 기능으로 이동하는 관리 홈입니다." |
| `admin.dashboard.next.title` | "다음 개발 범위" → "운영 바로가기" / EN "Next development scope" → "Operations shortcuts" |
| `admin.dashboard.next.description` | KO/EN 문구에서 "KO/EN" 표기 제거, 이동 안내로 교체 |
| `admin.dashboard.line1/line2` | "운영 컨텍스트가 연결되었습니다" → "운영 공간에 연결되었습니다" (EN 의미 단위 재작성) |
| `admin.platform.description` | "…관리하기 전에 슈퍼어드민 보안 컨텍스트를 확인하는 화면" → "…한곳에서 관리하는 플랫폼 콘솔입니다." |
| `admin.platform.next.title/description` | "슈퍼어드민 다음 범위"/"다음 구현에서…" → "플랫폼 운영 바로가기"/이동 안내 |
| `admin.platform.line2` | "플랫폼 컨텍스트가…" → "플랫폼 콘솔에 연결되었습니다." |

**보안 배지 효익 언어화 (5개 키, KO/EN):**
`admin.approvals.securityNote`, `admin.tenants.securityNote`, `admin.companies.securityNote`,
`admin.qr.securityNote`, `admin.sites.securityNote` — "AAL2 · 원자적 command · RLS ·
maker-checker" 나열을 "2단계 인증 · 범위 격리 · 요청과 승인 분리 · 변경 기록 보존" 계열의
사용자 언어로 교체. **실제 보안 동작은 무변경.**

**수량 계약 문구 (Task 0 UI 측면 선반영):**
`admin.qr.batch.request.description` KO/EN — "최대 10,000개" → "한 번에 1~100개 QR을
요청합니다. 더 많은 수량은 여러 Batch로 나누어 요청합니다." / EN "Request 1–100 QR items
at a time… Split larger needs into multiple batches."

**용어 통일:**
- KO 전체에서 `관리업체` → `관리회사` (replace-all, Master Spec 1.4 기준). EN
  "management company"는 원래 일치하므로 무변경.
- `호출자` → `방문자` (landing/onboarding/journey). EN "caller"는 유지(영어에서는 자연).
- `onboarding.token.description` — "임의의 차량이나 토큰을 입력받지 않습니다" →
  "차량 번호나 코드를 직접 입력하는 방법은 제공하지 않습니다." (KO/EN)
- `onboarding.hero.description` — "플랫폼 어드민" → "플랫폼 운영팀" (방문자 대상 문장)

### 2.2 `apps/web/content/public-contact-copy.ts`
- `security` KO/EN: "요청 토큰과 익명 식별값은 브라우저 보안 쿠키와 서버 해시로만
  처리합니다" → "연락에 필요한 정보는 안전하게 보호되며, 전화번호는 서로에게 공개되지
  않습니다." (기술 서술 제거)

### 2.3 `apps/web/content/owner-activation-copy.ts`
- `consentDescription` KO/EN: "익명 연락" → "전화번호를 공개하지 않는 연락"
- **인터페이스에 `homeLink` 키 추가** (KO "Taptolk 홈으로" / EN "Go to Taptolk home") —
  `/owner` dead-end 해소용. `OwnerActivationCopy` 타입에 필드가 늘었으므로 이 타입을
  새로 구현하는 코드는 `homeLink`를 포함해야 한다.

### 2.4 `apps/web/content/owner-response-copy.ts`
- `security` KO: "호출자 신원" → "방문자 신원"

### 2.5 `apps/web/content/operations-copy.ts` (KO/EN)
- `manualGates`: "수동 Pilot Gate가 남아 있습니다" → "현장 확인이 필요한 점검 항목이
  있습니다" (+ description을 사용자 언어로)
- `freshAt`: "Read model 갱신" → "데이터 기준 시각" / EN "Data refreshed"
- `activeBlocks` "활성 Caller 차단" → "활성 방문자 차단", `activeQr` "활성 QR Asset" →
  "활성 QR", `cost` "기록된 Provider 비용" → "기록된 발송 비용", `siteCount` "허용 Site" →
  "허용 사이트"

### 2.6 E2E 문구 단언 동기화 (2건)
- `e2e/phase-0-health.spec.ts` — "인증 환경 연결이 필요합니다." → "로그인 준비 중입니다."
- `e2e/staging/public-contact.spec.ts` — "수동 Pilot Gate가 남아 있습니다" →
  "현장 확인이 필요한 점검 항목이 있습니다", "허용 Site" → "허용 사이트"

### 2.7 랜딩 디자인 (`apps/web/app/[locale]/page.tsx`, `globals.css`, 신규 컴포넌트)

- **신규** `apps/web/components/landing-hero-visual.tsx` — 장식용(aria-hidden) SVG 씬:
  차량+QR 마커 → 점선 중계 경로 → 차주 답장 말풍선(체크). 디자인 토큰 CSS 변수만 사용,
  외부 이미지 없음. 히어로 signal card의 추상 route(점 3개)를 이 씬으로 교체.
- `globals.css`:
  - `.landing-signal-card__route` 규칙 제거 → `.landing-signal-card__scene` 추가
  - `.public-site-nav a:last-child` 강조 → `:first-child` (플랫폼 어드민 → **시작 안내**가
    강조되도록. 방문자 최우선 행동 기준)
  - `.landing-hero` padding-block 축소(첫 화면에서 메시지·CTA가 더 일찍 보이도록),
    `min-height` 46rem로 조정
  - 28rem 모바일: 헤더를 `로고+언어 스위처(우측)` 1행 / `내비` 2행 구조로 재배치
    (`display: contents` + order). 기존 전폭 grid 스위처 제거
- `apps/web/components/owner-home-view.tsx` — `unavailable` 상태에 기존
  `owner-activation-primary owner-activation-home-link` 패턴으로 홈 링크 추가

## 3. 의도적으로 변경하지 않은 것 (Codex 참고)

1. **QR 관리 화면의 enum·액션 라벨** ("디자인 DRAFT 생성", "Sticker Design Version
   만들기", "IN_STOCK", "생성 Queue 대기", "durable" 등) — staging E2E가 이 문구를 다수
   단언하고 있어(예: `qr-inventory` 스펙) 일괄 한글화는 **E2E 동기화와 함께 별도 Task로**
   진행해야 한다. 임의로 바꾸지 말 것.
2. EN "caller" 용어 — KO만 "방문자"로 통일. **사용자 결정(2026-07-20): EN은 "caller"
   현행 유지.** EN 문구에서 "visitor"로 바꾸지 말 것.
3. fail-closed 로직, 인증·권한·RLS, Route Handler — 무변경. 이번 변경은 문구 사전,
   E2E 문구 단언 2건, 랜딩 표면 CSS/컴포넌트, owner 홈 링크뿐이다.
4. `vercel.json`(Cron 0), 마이그레이션, 수량 계약 **코드** — Claude는 무변경.
   Claude 작업 중 **Codex의 Task 0 구현이 같은 작업 트리에 병행 반영**되었음을 확인했다:
   - 신규 `supabase/migrations/20260720210000_qr_batch_quantity_contract.sql`
     (기존 행 >100 방어 후 CHECK를 `1..100`으로 재생성, 기존 마이그레이션 무수정)
   - `packages/db/src/schema/tenant-admin.ts` Drizzle check `1..100`
   - `packages/application/...` `QR_BATCH_REQUEST_QUANTITY_MAX = 100`,
     unit test 경계 `101` reject + `100` accept 추가
   - pgTAP `qr_inventory_sample_foundation.sql` plan 66으로 확장: RPC 101 거부,
     RPC 100 통과, **직접 insert 101 CHECK 거부** 3종 포함
   Claude 리뷰 결과 workorder 2.4~2.5 준수(금지 목록 6개 무손상, 일괄 치환 흔적 없음).
   Claude의 `messages.ts` 수량 문구(1~100)와 정합한다. workorder 2.6의 분석 3건
   (render_jobs.requested_count, issuance.ts, print-export.ts) 보고는 아직 확인되지 않았다.

## 4. 검증 (Claude 문구·디자인 + Codex Task 0 통합 트리 기준)

- `corepack pnpm verify` 전체 게이트 **PASS** (통합 트리, 2026-07-20 밤):
  - lint 325 files, typecheck 11/11 tasks, production build 11/11 tasks
  - unit **53 files / 327 tests PASS** (Codex Task 0 경계 테스트 +1 포함)
  - DB static: **57 migrations / 23 database tests** (Task 0 마이그레이션 +1 포함)
  - secret scan 537 text files, immutable logo SHA-256, Cron deferred(활성 0)
  - WCJ **100 · C100 · J100 · W100 · 92 files** (신규 hero visual 포함)
- 로컬 브라우저 확인(dev 서버, 데스크톱+모바일 375px): KO/EN 랜딩 렌더와 신규 문구,
  히어로 씬(차량+QR→중계→답장) 표시, "시작 안내" 내비 강조, 모바일 헤더
  로고+스위처 1행/내비 2행 배치, 첫 화면 내 CTA 노출, `/owner` 오류 상태의
  "Taptolk 홈으로" 버튼, 콘솔 오류 0 — 모두 확인 완료.
- 미검증(다음 staging 세션 필요):
  - authenticated staging E2E 재실행 — 2.6의 문구 단언 2건 포함 28개 스위트
  - Task 0 신규 마이그레이션의 linked staging 적용 + `pnpm db:test:linked`
  - clean local reset 2회 + 전체 local pgTAP (Task 0 pgTAP 66 plan 포함)
  **Codex는 다음 세션에서 위 3개를 우선 실행할 것.**

## 5. 커밋·배포 소유 (사용자 결정 2026-07-20)

**커밋과 배포는 Codex가 수행한다.** Claude는 커밋하지 않았다. 현재 작업 트리에는
Claude의 문구·디자인 변경과 Codex의 Task 0 구현이 섞여 있으므로, 검증 완료 후
**두 개의 커밋으로 분리**해서 올린다.

- 커밋 A (Task 0): `supabase/migrations/20260720210000_qr_batch_quantity_contract.sql`,
  `packages/db/src/schema/tenant-admin.ts`, `packages/application/src/qr-inventory-sample-service.ts`,
  `packages/application/src/qr-inventory-sample-service.test.ts`,
  `supabase/tests/database/qr_inventory_sample_foundation.sql`,
  `docs/development/codex-workorder-0720-2055.md`
- 커밋 B (문구·디자인): `apps/web/content/*` 5개 사전, `apps/web/app/[locale]/page.tsx`,
  `apps/web/app/globals.css`, `apps/web/components/owner-home-view.tsx`,
  `apps/web/components/landing-hero-visual.tsx`(신규), `e2e/phase-0-health.spec.ts`,
  `e2e/staging/public-contact.spec.ts`, `docs/development/claude-changes-0720-2130.md`

`admin.qr.batch.request.description`(1~100 문구)은 커밋 B에 있지만 Task 0과 의미가
연결되므로 커밋 메시지에 상호 참조를 남긴다. Production 배포는 기존 절차(검증 완료
커밋의 Cron-deferred manifest)를 그대로 따르고, 배포 전 GitHub Actions PASS를 확인한다.

## 6. Codex가 이어받을 때 주의

- 문구는 전부 typed dictionary에만 있다. 컴포넌트에 하드코딩된 문구는 이번에도 추가하지
  않았고, 앞으로도 금지.
- `OwnerActivationCopy`에 `homeLink` 필드가 추가되었다.
- 새 컴포넌트 `landing-hero-visual.tsx`는 서버 컴포넌트이며 props가 없다. 색은 반드시
  디자인 토큰 변수로만 확장할 것.
- KO "관리회사"가 표준이다. 새 문구에서 "관리업체"를 다시 쓰지 말 것.
- KO 사용자 대면 문구에서 "익명"을 다시 도입하지 말 것 (CLAUDE.md 4.2).
