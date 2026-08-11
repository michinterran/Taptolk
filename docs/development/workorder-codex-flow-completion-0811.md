# Workorder — 두 시나리오 완주 배선 (Flow Completion)

> 작성: Claude (리뷰 레인) · 2026-08-11
> 수신: Codex (구현 레인)
> 기준 커밋: `989e59f` (fix: accept SOLAPI API key format) · 브랜치 `codex/phase-1-foundation`
> 상태: **갭 A 즉시 착수 가능 / 갭 B 정본 결정 대기 / 갭 C 즉시 착수 가능(인증 의존 값만 나중)**
> 개정: 2026-08-11 — 운영자 확정에 따라 §3을 **SMS·알림톡 이중 채널 동시 구현**으로 전면 교체
> 선행 문서: `AGENTS.md` · `docs/design-canon/CONTRACTS.md` · `docs/design-canon/CONSOLE_DESIGN_SYSTEM_V2.md`
> · `docs/development/workorder-kakao-alimtalk-live-provider.md` · `docs/handoff-0728-1414.md`

---

## 0. 이 문서의 성격

운영 시나리오와 사용자 시나리오를 **코드로 전수 대조**한 결과, 구조는 갖춰졌으나
**배선 누락 3건이 두 시나리오의 완주를 막고 있다.** 본 문서는 그 배선 지시서다.

신규 기능 설계가 아니다. **백엔드 RPC·서비스·서버 액션은 이미 완성돼 있고, 호출 경로만 없다.**

### 0.1 대조 결과 요약

| 시나리오 | 단계 | 상태 |
|---|---|---|
| 운영 | 관리회사 계약 → 사이트 생성 → 사이트별 QR 발행 → 배송·입고 | ✅ |
| 운영 | **QR ↔ 차량 배정 · 차량 명부 import** | ❌ **갭 B** |
| 운영 | 차주 스캔 등록 → DB 등록 → 회사·사이트별 운영 관리 | ✅ |
| 사용자 | QR 스캔 → 화면 판정 → 사유 선택 → 연락 요청 생성 | ✅ |
| 사용자 | **차주에게 SMS 발송** | ❌ **갭 A** |
| 사용자 | 차주 링크 진입 → 응답 → 발신자 폴링 수신 | ✅ |

### 0.2 이미 검증된 것 (되돌리지 말 것)

- QR 수량 `1..100`/배치: `request_qr_batch_series`가 `least(100, ...)`로 DB 강제 ✅
- Production Cron 활성 정의 `0` ✅ · 차주 전화번호 브라우저 미노출 ✅ · RBAC/RLS/audit ✅
- 알림 채널: `20260810120000_sms_owner_notification_provider.sql`이 SMS로 복귀,
  `KAKAO_ALIMTALK` enum은 향후 전환용 보존 ✅ **이 마이그레이션을 되돌리지 않는다.**
- SERVICE stage guard 레지스트리 등록 완료(2 surfaces) ✅
- `vitest` 73파일/480테스트 · `validate:design-system`(부채 0) · `validate:wcj` 100/100 PASS

---

## 1. 갭 A (P0) — 알림 디스패치를 돌리는 주체가 없다

### 1.1 확인된 사실

- `apps/web/vercel.json` → `{"$schema": ...}` 뿐, **crons 없음**(제약 준수, 정상)
- `apps/web/vercel.production-cron.template.json` → **`privacy-cleanup`만** 있고
  `notification-dispatch`가 **템플릿에도 없다**
- 연락 세션 생성 경로(`apps/web/public-contact/`)에서 dispatch 호출 **0건**
- 결과: 발신자가 요청하면 `notification_deliveries`에 적재만 되고,
  누군가 `POST /api/internal/notification-dispatch`를 치기 전까지 **차주에게 SMS가 가지 않는다.**
- 대조: 차주 등록 OTP는 `await this.otpProvider.send(...)`
  (`packages/application/src/owner-activation-service.ts:408`) **동기 발송**이라 정상 동작한다.
  → 현장 증상은 "가입 인증문자는 오는데 연락 요청은 안 온다"로 나타난다.

### 1.2 구현 범위

**A-1. cron 템플릿에 dispatch 항목 추가 (활성화는 하지 않는다)**

- `apps/web/vercel.production-cron.template.json`에 `/api/internal/notification-dispatch`
  항목을 추가한다. **템플릿은 비활성 정의이므로 Cron 0 제약은 유지된다.**
- 착수 전 `scripts/verify-production-cron.mjs`를 **먼저 읽고**, 변경 후
  `verify:production-cron`과 `verify:production-cron:deferred`가 **둘 다 PASS**하는지 확인한다.
  가드가 템플릿 항목 수를 고정하고 있으면 가드도 함께 갱신하되, **활성 매니페스트
  (`apps/web/vercel.json`)에는 crons를 절대 추가하지 않는다.**

**A-2. 큐 적재 직후 best-effort 인프로세스 넛지**

- 연락 세션 생성(및 에스컬레이션 알림 적재) 성공 직후, 응답을 보낸 뒤
  `after()` (`next/server`) 안에서 `createNotificationDispatchService()`의 `run()`을
  **직접 호출**한다.
- **HTTP 자기호출 금지.** 자기 URL·`QUEUE_WORKER_SECRET`에 의존하지 않는다.
- **큐가 여전히 진실의 출처다.** 넛지는 최선 노력일 뿐이며, 실패해도 삼키고
  후속 dispatch(수동/승인 후 cron)가 반드시 복구할 수 있어야 한다.
- 넛지 실패 로그에 **전화번호·메시지 본문·토큰을 남기지 않는다.** 집계와 오류 코드만.
- `after()`가 이 Next 버전(16.2.10)에서 라우트 핸들러에 안전히 쓰이는지 먼저 확인한다.
  쓸 수 없으면 **A-2를 구현하지 말고 되돌려 보고**한다(추측 금지).

**A-3. 정책 재사용**

- 재시도·lease·idempotency 정책을 **새로 만들지 않는다.** 기존
  `NotificationDispatchService`의 claim/lease/retry 경로를 그대로 쓴다.
- limit·leaseSeconds는 기존 라우트 값(10 / 30초)과 동일한 출처를 쓰고,
  컴포넌트·라우트에 새 숫자를 하드코딩하지 않는다.

### 1.3 수용 기준

- [ ] 활성 `apps/web/vercel.json`에 crons **없음** 유지
- [ ] `corepack pnpm verify:production-cron` · `verify:production-cron:deferred` 둘 다 PASS
- [ ] 연락 요청 생성 → 넛지 → `notification_deliveries` 행이 발송 시도 상태로 전이되는
      경로에 대한 테스트 추가(모의 provider 사용, 실번호 금지)
- [ ] 넛지 실패가 요청 응답을 실패시키지 않음을 테스트로 증명
- [ ] 로그에 전화번호·본문·토큰 없음(`verify:secrets` PASS)

---

## 2. 갭 B (P0) — QR ↔ 차량 배정 · 차량 명부 import에 도달할 수 없다

### 2.1 확인된 사실

- `apps/web/components/qr-inventory-assignment-view.tsx`는 **자기 파일 외 어디에서도
  import되지 않는 고아 컴포넌트**다(`.next` 제외 전수 grep 결과 정의부 1건뿐).
- 그 결과 서버 액션 `assignQrAsset` · `commitVehicleImport` · `validateVehicleImport`
  (`apps/web/admin/qr-inventory-assignment-actions.ts:192`, `:229`, `:206`)를
  **운영자가 화면에서 실행할 방법이 없다.**
- `/admin/qr-inventory`는 `QrOperationsView`만 렌더한다.
- 백엔드는 완성돼 있다: `assign_qr_asset` · `save_validated_vehicle_import` ·
  `commit_vehicle_import` RPC + 리포지토리 배선 모두 존재.

### 2.2 ⚠️ 정본 결정이 먼저다 — Codex 임의 배치 금지

- `CONTRACTS.md:409` QR 재고·라이프사이클은 정본을
  `CONSOLE_DESIGN_SYSTEM_V2.md` §6로 넘겼다.
- 그런데 **v2 §6에는 배정·차량 import의 자리가 정의돼 있지 않다**(생성/발행 묶음/
  다운로드/예외 4탭만 규정).
- 또한 v2 §6은 **"기존 QR 카드형 위저드는 계승하지 않는다"** 고 못박았다.
  → **고아 컴포넌트를 그대로 다시 import하는 해결은 금지다.** 정본 위반이다.

**따라서 순서는 이렇다.**

1. Codex는 이 갭을 **디자인 레인(Claude)에 정본 결정 요청**으로 되돌린다.
   요청 내용: 배정·차량 명부 import 기능이 v2 콘솔의 **어느 화면·어느 탭**에 속하는가.
2. 정본이 정해진 뒤에만 v2 관용구로 구현한다.
3. 그 전까지 Codex가 할 수 있는 것:
   - 서버 액션·리포지토리·RPC에 대한 **회귀 테스트 보강**(UI 없이 가능)
   - 고아 컴포넌트 처리 방침(삭제 vs 보존) **결정 요청**. 임의 삭제 금지 —
     v2 재구성 시 참고 자료일 수 있다.

> 운영자가 "정본 결정을 기다리지 말고 최소 도달 경로부터 열라"고 **명시 승인**한 경우에만
> 잠정 배선을 허용한다. 그 경우에도 카드형 위저드 UI를 부활시키지 않고,
> v2 primitives(테이블/레일)로 최소 구현하며, 잠정임을 커밋 메시지에 남긴다.

### 2.3 수용 기준

- [ ] 정본 결정 요청이 문서로 제기됨(또는 운영자 명시 승인 기록)
- [ ] 구현 시 `validate:design-system` · `validate:wcj` PASS, v1 카드 관용구 미부활
- [ ] 배정·import 서버 액션 회귀 테스트 추가
- [ ] 실행 후 `qr_assets` 상태·`qr_bindings`·audit 행이 규약대로 남는지 확인

---

## 3. 갭 C (P1) — SMS · 카카오 알림톡 **이중 채널을 지금 둘 다 구현한다**

### 3.1 사업 상황 (운영자 확정, 2026-08-11)

- 카카오 비즈니스 인증은 **지금 받을 수 없고, 서비스 오픈 후 진행**한다.
- 그러나 **두 채널을 지금 모두 개발해 둔다.** 오픈 후 실제 운영 데이터를 보고
  **①둘 다 쓸지 ②알림톡만 쓸지**를 결정한다.
- 따라서 목표는 "카카오 보류"가 아니라 **채널 전환이 코드 배포 없이 설정으로 가능한 상태**다.

### 3.2 지금 구현 가능한 근거 (확인 완료)

- 이미 설치된 **`solapi@5.5.1` SDK가 알림톡을 지원**한다.
  `sendOne`의 `kakaoOptions`에 `pfId` · `templateId` · `variables` · `disableSms` · `buttons`.
- **SMS와 알림톡의 수탁자가 SOLAPI로 동일**하다 → 수탁자가 늘지 않는다.
  (기존 카카오 워크오더 §3.4가 우려한 "SMS 사업자 추가" 문제는 해당 벤더 구성에서는 발생하지 않는다.
  다만 **처리방침에 알림톡 발송을 명시**하는 일은 그대로 필요하다.)
- `kakaoOptions.disableSms`가 **알림톡 실패 시 SMS 대체발송 스위치**다.
  → "둘 다 쓸지 / 알림톡만 쓸지"를 **런타임 설정으로 바꿀 수 있다.**
- DB 준비 완료: `notification_channel` enum에 `KAKAO_ALIMTALK` 존재
  (`20260721040000_kakao_alimtalk_notification_channel.sql`).
- **인증에 묶여 지금 채울 수 없는 값은 `pfId`(발신프로필 키)와 `templateId`(승인 템플릿 ID) 둘뿐이다.**
  이 둘은 서버 전용 env로 주입하고, **없으면 알림톡 경로가 fail-closed** 되게 만든다.
  → 값 없이도 **어댑터·정책·테스트·마이그레이션을 전부 지금 완성할 수 있다.**

### 3.3 현재 상태와 위험

- `packages/config/src/env.server.ts:37`의 `OWNER_NOTIFICATION_PROVIDER`는
  `["mock", "solapi-sms", "kakao-alimtalk"]`을 허용하지만 **`kakao-alimtalk` 구현체가 없다**
  (`OwnerNotificationProvider` 구현체는 Solapi(SMS) · Staging · Unavailable 3개뿐).
- production 검증은 `mock`만 차단하고 `kakao-alimtalk`은 **필수 env 없이 통과시킨다.**
  → 지금 프로덕션에서 `kakao-alimtalk`을 고르면 기동은 성공하고
  **모든 차주 알림이 `AUTH_ERROR`로 조용히 전멸한다.** C-4가 이것을 막는다.
- `claim_notification_deliveries`는 **단일 채널만 claim** 한다.
  현재 `delivery.channel = 'SMS'`(`20260810120000`이 되돌려 놓은 상태).
  → **두 채널을 동시에 운영하려면 claim이 두 채널을 모두 집어야 한다**(C-3).

### 3.4 구현 범위

**C-1. 카카오 알림톡 어댑터 구현 (지금 착수)**

- `apps/web/notification-reply/`에 **별도 클래스**로 추가한다.
  `StagingOwnerNotificationProvider`나 `SolapiSmsNotificationProvider`를 개조하지 않는다.
- `OwnerNotificationProvider` **Port를 바꾸지 않는다.**
  `OwnerContactNotification.variables`는 `reasonCode`·`responseUrl` **2개로 유지**한다
  (이 타입 제약이 자유입력 본문·차량번호·토큰의 유출을 구조적으로 막는다.
  기존 카카오 워크오더 §1.1과 동일 — **넓히지 말 것**).
- `solapi` SDK의 `sendOne({ to, from, kakaoOptions: { pfId, templateId, variables, disableSms } })`
  를 사용한다. SMS 어댑터와 **같은 벤더·같은 SDK**이므로 인증·오류 분류 코드를 재사용한다.
- 템플릿 변수 매핑은 **타입 있는 설정 모듈**에 둔다. 라우트·컴포넌트 하드코딩 금지.
- locale(`ko`/`en`)별 승인 템플릿을 선택하고, **매핑이 없는 locale은 fail-closed**.
- `pfId`·`templateId`가 **없으면 알림톡 provider가 선택되지 않고 fail-closed** 되게 한다.
  **값을 추측하거나 임시값을 넣지 않는다.**

**C-2. 채널 선택 정책 모듈 (오픈 후 판단을 설정으로 흡수)**

- **오픈 후 결정을 코드 배포 없이 바꿀 수 있어야 한다.** 다음 3가지 운영 모드를
  타입 있는 정책으로 정의한다.

  | 모드 | 동작 | 용도 |
  |---|---|---|
  | `SMS_ONLY` | SMS만 발송 | 인증 완료 전 현재 상태 |
  | `ALIMTALK_WITH_SMS_FALLBACK` | 알림톡 발송, 실패 시 SMS 대체 | 오픈 직후 안전 운영 |
  | `ALIMTALK_ONLY` | 알림톡만 발송 | 비용·도달률 판단 후 최종 |

- 대체발송은 **가능하면 `kakaoOptions.disableSms`로 SOLAPI에 위임**한다
  (`disableSms: false` = 대체발송 허용). 애플리케이션에서 2회 발송하는 구조를
  새로 만들지 않는다. SDK 동작이 요구와 다르면 **추측하지 말고 되돌려 보고**한다.
- 모드는 **서버 전용 환경변수 + 타입 있는 정책 모듈**로 읽는다.
  기본값은 `SMS_ONLY`(현재 운영 상태)로 둔다.
- 임계값·재시도·rate limit을 **새로 만들지 않는다.** 기존
  `isRetryableNotificationProviderError` / `getNotificationRetryDelaySeconds` 재사용.

**C-3. claim이 두 채널을 모두 집도록 새 마이그레이션 (필수)**

- **기존 migration 수정 금지 — 새 파일만 만든다.**
- `claim_notification_deliveries`가 `OWNER_CONTACT` 목적에 대해
  `SMS`와 `KAKAO_ALIMTALK`을 **둘 다 claim** 하도록 갱신한다.
- `20260810120000_sms_owner_notification_provider.sql`이 되돌려 놓은 SMS 복귀를
  **역행시키지 않는다.** 단일 채널 고정을 이중 채널 허용으로 넓히는 방향이다.
- 채널별 발송 결과·실패 사유가 구분돼 기록되는지 확인한다(운영 판단의 근거 데이터).
- `20260721041000`이 만들었다가 `20260810120000`이 제거한
  **강제 채널 변환 트리거를 되살리지 않는다.** 채널은 정책이 정한다.
- pgTAP에 채널별 claim·권한 assertion을 추가한다.

**C-4. 미구성 provider의 프로덕션 선택을 fail-closed로 차단**

- production superRefine에 `kakao-alimtalk` 분기를 추가해,
  `pfId`·`templateId`·SOLAPI 자격증명이 없으면 **기동을 명시적으로 실패**시킨다.
- 실패 메시지에 secret 값을 담지 않는다.

**C-5. 카피 — 채널명에 묶이지 않게 (결정 요청 포함)**

- `apps/web/content/messages.ts:757`(KO) / `:1667`(EN)이 지금
  **"카카오 알림톡으로 Taptolk 링크를 받습니다"** 라고 단정하는데, 현재 실제 채널은 SMS다.
- 오픈 후 채널이 바뀔 수 있으므로 **채널명을 단정하지 않는 문구**를 우선안으로 제시한다
  (예: "문자 또는 카카오 알림톡으로" / 채널 언급 없이 "링크를 받습니다").
- 카피 **문구 계약은 디자인 레인 소유**다. Codex는 KO/EN 안을 제시하고 승인 후 반영한다.
- KO/EN을 **함께** 바꾼다(한쪽만 바꾸면 WCJ 실패).

**C-6. 기존 카카오 워크오더와의 관계**

- `docs/development/workorder-kakao-alimtalk-live-provider.md`는 **여전히 정본**이다.
  특히 **§2 복호화 경계(전화번호 평문 취급 지점)** 를 그대로 지킨다.
- 본 문서와 충돌 시 다음만 갱신된 것으로 본다:
  - 상태: "착수 불가" → **어댑터·정책·마이그레이션·테스트는 지금 착수**
    (인증 의존 값 `pfId`·`templateId`와 실발송 검증만 게이트로 남김)
  - §3.4 대체발송 우려: SMS·알림톡 **동일 수탁자(SOLAPI)** 이므로 수탁자 증가 없음
  - §4 SERVICE stage guard: **이미 해소**(surfaces 2건 등록) — 재작업 금지

### 3.5 인증 확보 후에만 가능한 것 (외부 게이트)

- `pfId`(발신프로필 키) · 승인된 `templateId` · 승인된 KO/EN 템플릿 문구
- 실제 발송 검증(운영자가 지정한 테스트 수신번호로만, **실번호·영수증 원문 기록 금지**)
- 처리방침 위탁 조항에 **알림톡 발송** 명시 → 갱신 전 프로덕션 알림톡 활성화 금지

### 3.6 수용 기준

- [ ] 알림톡 어댑터 구현, Port·`variables` 2필드 **무변경**
- [ ] 채널 정책 3모드가 **설정으로 전환**되고 기본값 `SMS_ONLY`
- [ ] 새 마이그레이션으로 claim이 `SMS`·`KAKAO_ALIMTALK`을 **둘 다** 집음(기존 파일 무수정)
- [ ] `pfId`/`templateId` 미설정 시 알림톡 경로 fail-closed, 프로덕션 기동 실패 테스트
- [ ] `solapi-sms` 기존 경로 회귀 없음(480 테스트 유지)
- [ ] 복호화된 전화번호가 로그·오류·예외·재시도 payload·감사·메트릭에 **없음을 테스트로 증명**
- [ ] SDK 요청 본문 자동 로깅 차단 확인 · `verify:secrets` PASS
- [ ] 카피 KO/EN 동시 반영, `validate:wcj` PASS
- [ ] `.env.example`·문서·로그·fixture에 secret **값** 없음(키 이름만)

---

## 4. 부수 정리 (P2)

| 항목 | 조치 | 소유 |
|---|---|---|
| CONTRACTS 스테일 마커(C-5/C-6 RESUME·단일 엔드포인트, [R] 🔴, A-2 🔴) | 정본 갱신 | **디자인 레인** — Codex 수정 금지 |
| 신규 `update_owner_sticker_state` pgTAP 실DB 미실행 | Docker/Supabase Local에서 `supabase test db` | Codex |
| 대규모 미커밋 WIP(콘솔 v2, 60+파일) | 논리 단위로 분리 커밋 | Codex |
| 외부 자동 커밋 프로세스 | 어떤 도구가 커밋하는지 식별 | 운영자 |

> 상세 근거는 `docs/handoff-0728-1414.md` §4·§5.

---

## 5. 레인·커밋 규율 (재확인)

- `git add -A` / `git add .` **금지.** 자기 레인 파일만 명시 경로로 stage.
- 한 커밋에 레인을 섞지 않는다. 갭 A / 갭 B / 갭 C를 **각각 별도 커밋**으로.
- `packages/ui/src/styles/tokens.css`는 Claude 소유 — Codex 수정 금지.
- `docs/design-canon/`·`DESIGN_SYSTEM.md`·거버넌스·워크오더는 디자인 레인 소유.
- 기존 migration 수정 금지(새 파일만). 없는 값을 `0`/default/mock으로 채우지 않는다.
- **커밋 전후로 `git log`·`git status`를 확인해 자기 변경만 들어갔는지 검증한다**
  (외부 프로세스가 커밋을 생성한 전례가 있다 — `handoff-0728-1414.md` §5).

## 6. 착수 금지 (운영자 승인 없이)

Production 배포·Production Supabase·live domain·**Production Cron 활성화**·
live Kakao/SMS provider 전환·Vercel 요금제 변경 · QR `1..100` 초과 ·
로고 crop/recolor/redraw · **차주 전화번호를 브라우저 응답·화면·로그·문서에 노출(뒤 4자리도 금지)** ·
**실제 전화번호로 발송 테스트** · 기존 migration 수정.

## 7. 검증

- 각 slice마다: `corepack pnpm validate:design-system`, `corepack pnpm validate:wcj`
- DB/API·공유 도메인 변경 시: `corepack pnpm db:check`,
  `--filter @taptolk/application build`, `--filter @taptolk/web typecheck`
- **완료 보고 전: `corepack pnpm verify`**
- 자동 검증 ≠ 정본 일치. 화면 변경은 320/768/1280/1920·키보드·스크린리더·대비 수동 검토.

## 8. 보고 형식

**구현 완료(파일·커밋) / 자동 검증(명령·결과) / 수동 검증 대기 / 외부 게이트 /
다음 한 단계(하나만)** 로 구분해 한국어로 보고한다.
credential·전화번호·OTP·QR token·response token·secret은 Git·문서·로그·스크린샷에 남기지 않는다.
완료 후 `docs/handoff-MMDD-HHmm.md`를 `AGENTS.md` 프로토콜대로 작성한다.

## 9. 권장 착수 순서

1. **갭 A** — 시나리오 2 전체를 막고 있고, 파일럿 전 실SMS 검증의 전제다.
2. **갭 C-4** — 짧다. 인증 대기 기간에 오설정으로 알림이 전멸하는 것을 먼저 막는다.
3. **갭 C-1 ~ C-3** — 알림톡 어댑터 · 채널 정책 · claim 마이그레이션.
   인증 값(`pfId`·`templateId`) 없이도 **여기까지 전부 완성**한다.
   완료 시점에 "인증만 나오면 설정 한 줄로 알림톡 전환" 상태가 되어야 한다.
4. **갭 C-5** — 카피 문구안 제시 → 디자인 레인 승인 → 반영.
5. **갭 B** — 정본 결정 요청을 먼저 올리고, 회신 후 구현.
