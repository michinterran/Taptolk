# Codex 작업 지시서 — 2026-07-20 20:55 KST

> 작성: Claude (리뷰 담당)
> 수신: Codex (구현 담당)
> 근거 커밋: `7924d6b` / 브랜치 `codex/phase-1-foundation` / working tree clean
> 현재 공식 단계: `DEVELOPMENT_TEST` — 실제 서비스 개시 전
> 승인 상태: **Task 0 사용자 승인 완료 (2026-07-20). Task 0 → 1 → 2 → 3 순차 진행.**

---

## 0. 이 문서의 성격

이 문서는 Claude가 저장소 전체를 코드 수준으로 리뷰한 결과 확인된 **문서-코드 불일치**와
**설계 완료·구현 대기 항목**을 Codex가 구현할 수 있는 형태로 정리한 작업 지시서다.

Claude는 코드를 작성하지 않았다. 아래 모든 발견은 실제 파일·마이그레이션·테스트를
직접 확인한 결과이며, 문서 기록을 근거로 한 추정이 아니다. 각 항목에 확인 경로를 명시했다.

---

## 1. 절대 준수 사항 (작업 전 반드시 확인)

아래는 사용자가 명시한 비협상 제약이다. 어떤 Task도 이 제약을 우회할 수 없다.

### 1.1 권한과 보안

- 공유 링크 보유만으로 관리자 권한을 부여하지 않는다.
- 권한은 **중앙 RBAC와 PostgreSQL RLS를 모두 독립적으로** 통과해야 한다.
  프론트엔드 필터링·메뉴 숨김은 권한 검사가 아니다.
- 자동 Super Admin 부여 금지. user-editable metadata로 역할을 승인하지 않는다.
- 보안 관련 mutation은 **redacted audit을 같은 트랜잭션에** 기록한다.
- Service-role credential은 서버 전용. `NEXT_PUBLIC_`에 secret-like 변수를 넣지 않는다.

### 1.2 계층 구조

```text
UI -> Route Handler -> Application Service -> Domain Policy
   -> Repository / Transaction -> PostgreSQL
```

- React 컴포넌트와 Route Handler에 비즈니스 규칙, 사용자 문구, URL, Secret,
  보존 기간, rate limit, 상태 전이, Provider 동작을 하드코딩하지 않는다.
- UI에서 DB나 Provider를 직접 호출하지 않는다.

### 1.3 QR 수량 계약

- **per-Batch 수량은 반드시 `1..100`이다.**
- 단일 1,000-item Batch로 변경하지 않는다. 100 초과 수요는 여러 정상 Batch로 처리한다.
- 100 초과 수량이 요구되면 **중단하고 별도 quantity-policy 설계 승인**을 받는다.

### 1.4 운영·배포

- **Production Cron 활성 정의는 `0`을 유지한다.**
- 실제 서비스 개시 전에는 Vercel 요금제 업그레이드나 Cron 활성화를 제안·실행하지 않는다.
- Production Supabase 프로젝트·리전, SMS/CAPTCHA Provider, Production Secret, 요금제,
  모니터링·롤백·장애 대응 담당자를 임의로 선택하지 않는다.

### 1.5 데이터 취급

- 전화번호, 메시지 본문, OTP, 쿠키, 인증 헤더, DB credential, Provider token,
  QR·activation·response token을 **Git, 문서, 로그, 스크린샷, 채팅에 남기지 않는다.**
- 실제 전화번호나 Production 데이터를 테스트에 사용하지 않는다. 합성 데이터만 사용한다.
- 기존 상태 이력은 삭제하지 않고 종료·폐기 상태로 보존한다.

### 1.6 작업 위생

- **기존 사용자 변경과 무관한 파일은 수정하지 않는다.**
- 문서에 적혀 있다는 이유로 구현 완료라고 판단하지 않는다. 실제 코드와 테스트로 확인한다.
- 새 package는 실제 책임·public API·test가 있을 때만 만든다.

---

## 2. Task 0 — QR 수량 계약 정합화 (✅ 2026-07-20 구현·자동 검증 완료)

### 2.1 발견된 문제

문서 여러 곳(`docs/handoff-0720-1531.md`, `docs/deployment/pilot-readiness-checklist.md`)이
"`1..100` per-Batch 계약 유지"를 PASS로 기록하고 있으나, **실제로 이 계약을 강제하는
계층은 단 하나뿐**이다.

| 계층 | 파일·위치 | 실제 값 | 계약 준수 |
|---|---|---|---|
| RPC 함수 | `supabase/migrations/20260719040000_qr_inventory_sample_foundation.sql:1140` | `p_quantity not between 1 and 100` → `INVALID_QUANTITY` | ✅ 1–100 |
| DB CHECK 제약 | `supabase/migrations/20260719060000_phase_2_4_core_schema.sql:1042-1044` | `between 1 and 10000` | ❌ |
| Drizzle 스키마 | `packages/db/src/schema/tenant-admin.ts:807` | `between 1 and 10000` | ❌ |
| Application 상수 | `packages/application/src/qr-inventory-sample-service.ts:66` | `QR_BATCH_REQUEST_QUANTITY_MAX = 10_000` | ❌ |
| Unit test | `packages/application/src/qr-inventory-sample-service.test.ts:167-186` | 이름은 `"enforces the reviewed 1-100 quantity policy"`인데 단언은 `quantity: 10_001`에서만 reject | ❌ |
| pgTAP | `supabase/tests/database/` | 1–100 경계 assertion **없음** | ❌ 미검증 |

### 2.2 경위

최초 마이그레이션 `20260719040000`이 `chk_qr_batches_requested_quantity`를 `1..100`으로
생성했다. 이후 `20260719060000_phase_2_4_core_schema.sql`이 이 제약을 **drop 후
`1..10000`으로 재생성**했다. `public.request_qr_batch` RPC의 1–100 가드는 이후
재정의되지 않아 살아남았다(전체 마이그레이션 grep으로 재정의 없음 확인).

### 2.3 현재 위험 수준

실제 Batch 생성은 `apps/web/admin/supabase-qr-inventory-sample-repository.ts:465`에서
`request_qr_batch` RPC를 경유하므로 **정상 경로에서는 1–100이 지켜지고 있다.**
따라서 즉각적인 데이터 오염 위험은 없다.

그러나 계층 방어가 깨져 있어 다음 위험이 있다.

1. service-role 직접 insert나 향후 추가되는 다른 write 경로는 최대 10,000까지 통과한다.
2. Unit test가 10,000을 정상값으로 고정하고 있어, **계약 위반 방향으로 회귀가 잠겨 있다.**
   테스트 이름과 단언이 모순되어 있어 리뷰에서 놓치기 쉽다.

### 2.4 수정 방향

이것은 **수량 정책의 변경이 아니라, 이미 선언된 계약으로의 정합화(복원)**다.
새로운 정책을 도입하는 것이 아니므로 quantity-policy 설계 승인 대상이 아니지만,
수량 영역을 건드리므로 사용자 승인을 받았다. **2026-07-20 승인 완료.**

승인 범위는 **상한을 `10000`에서 `100`으로 되돌리는 것에 한정**된다.
이 승인은 2.5의 무관한 상수 변경이나 2.6의 미판단 항목 변경을 포함하지 않는다.

**수정 대상 (이 5개만):**

1. **새 마이그레이션 추가** — `supabase/migrations/` 아래, 기존 최신
   `20260720135421_queue_repeatable_baseline.sql` 이후 타임스탬프로 생성.
   `chk_qr_batches_requested_quantity`를 drop 후 `between 1 and 100`으로 재생성한다.
   - 기존 마이그레이션 파일을 **수정하지 말 것.** 반드시 새 마이그레이션으로 처리한다.
   - clean replay가 결정적이어야 한다. 제약이 이미 어떤 상태든 재실행 가능하도록 작성한다.
   - 적용 전 `requested_quantity > 100`인 기존 행이 있는지 확인하는 방어 로직을 포함하고,
     존재하면 명확한 에러로 중단한다(합성 staging 데이터라도 조용히 삭제하지 않는다).

2. `packages/db/src/schema/tenant-admin.ts:807` — Drizzle check를 `between 1 and 100`으로.

3. `packages/application/src/qr-inventory-sample-service.ts:66` —
   `QR_BATCH_REQUEST_QUANTITY_MAX = 10_000` → `100`.
   `QR_BATCH_REQUEST_QUANTITY_MIN = 1`은 그대로 유지한다.

4. `packages/application/src/qr-inventory-sample-service.test.ts:167-186` —
   경계 단언을 `quantity: 101`로 수정해 테스트 이름과 일치시킨다.
   추가로 **경계 통과 케이스(`quantity: 100`이 성공)**를 별도 테스트로 추가해
   off-by-one 회귀를 막는다.

5. **pgTAP 경계 테스트 신규 추가** — `supabase/tests/database/qr_inventory_sample_foundation.sql`에
   다음을 증명하는 assertion을 추가한다.
   - `request_qr_batch`에 `101`을 넘기면 `INVALID_QUANTITY`로 거부된다.
   - `request_qr_batch`에 `100`은 정상 처리된다.
   - `qr_batches`에 `requested_quantity = 101` 직접 insert가 CHECK 제약으로 거부된다.
   (3번째 항목이 계층 방어 복원을 실제로 증명하는 핵심 assertion이다.)

### 2.5 절대 변경하지 말 것 — 무관한 `10000` 상수

아래는 **Batch 수량과 다른 도메인 개념**이다. Claude가 각 문맥을 직접 확인했다.
일괄 치환(`sed`, find-replace)을 절대 사용하지 말 것.

| 위치 | 개념 | 조치 |
|---|---|---|
| `20260719060000:640` `vehicle_imports.row_count between 1 and 10000` | CSV 차량 import 행 수 | 변경 금지 |
| `20260719065000:24` `qr_generation_items.ordinal between 1 and 10000` | 생성 작업 내 ordinal | 변경 금지 |
| `20260719061000:451` `row_count not between 1 and 10000` | import 행 수 | 변경 금지 |
| `packages/config/src/env.server.ts:68` `QR_GENERATION_QUEUE_SEND_TIMEOUT_MS` | 밀리초 타임아웃 | 변경 금지 |
| `packages/db/src/supabase-qr-generation-queue-publisher.ts:8` | 밀리초 타임아웃 | 변경 금지 |
| `packages/domain/src/public-contact-policy.ts:157` | 밀리초 | 변경 금지 |

### 2.6 분석만 하고 보고할 것 (변경 금지)

다음 3개는 **per-Batch 개념일 가능성이 있으나 판단에 추가 정보가 필요**하다.
Codex는 **변경하지 말고**, 각각이 Batch 단위인지 여러 Batch를 아우르는지 코드로 확인해
결과를 보고할 것. 사용자 판단 후 별도 지시한다.

| 위치 | 확인할 것 |
|---|---|
| `20260719060000:391` `render_jobs.requested_count between 1 and 10000` | `uq_render_jobs_revision`에 `qr_batch_id`가 포함되어 per-Batch로 보인다. 사실이면 `100`이 상한이어야 하는지 판단 필요 |
| `packages/qr-engine/src/issuance.ts:115` `count > 10_000` | 1회 발행 호출이 단일 Batch 범위인지 |
| `packages/qr-engine/src/print-export.ts:49` `items.length > 10_000` | export가 단일 Batch인지 여러 Batch 묶음인지 |

### 2.7 Task 0 완료 기준

- [x] 새 마이그레이션으로 CHECK 제약 `1..100` 복원 (기존 마이그레이션 미수정)
- [x] Drizzle 스키마·Application 상수 정합
- [x] Unit test 경계 `101` reject + `100` accept
- [x] pgTAP 3개 assertion 추가 (RPC 거부, RPC 통과, 직접 insert 거부)
- [x] `corepack pnpm db:reset:local` 후 clean replay 2회 결정적 PASS
- [x] `corepack pnpm exec supabase test db --local` 전체 PASS (기존 23파일 회귀 없음)
- [x] `corepack pnpm verify` PASS
- [x] 2.6 항목 3개 분석 결과 보고
- [x] 기존 10×100 = 1,000 acceptance 계약 무손상 확인

### 2.8 실행 결과 (2026-07-20)

- 구현은 `1314532`에 반영됐다. 기존 마이그레이션은 수정하지 않았고,
  `20260720210000_qr_batch_quantity_contract.sql`이 `requested_quantity > 100` 기존 행을
  명확한 오류로 거부한 뒤 CHECK 제약을 `1..100`으로 복원한다.
- clean local reset 2회와 local pgTAP 23파일·590테스트가 PASS했고,
  linked staging은 `20260720210000` 적용 상태와 pgTAP 23파일 전체 PASS를 재확인했다.
- authenticated staging E2E는 기본 실행 대상 28개가 PASS했고, 별도 승인된 10×100
  acceptance 1개만 의도적 opt-in skip을 유지했다. 기존 10×100 acceptance의 실제
  통과 증거는 `docs/04-report/qr-batch-quantity-contract.report.md`에 기록돼 있다.
- `render_jobs.requested_count`는 한 `qr_batch_id`에 종속된 구조이므로 의미상
  per-Batch지만 현재 활성 생성 경로가 아니다.
- `qr-engine/issuance.ts`의 발행 함수는 DB Batch 경계가 아닌 범용 수량 기반 엔진이며,
  활성 워커가 한 Batch를 청크로 나눠 호출하므로 호출 단위는 per-Batch가 아니다.
- `qr-engine/print-export.ts`의 활성 애플리케이션 호출 경로는 단일 Batch 항목만
  전달하므로 운용상 per-Batch지만, 엔진 함수 자체는 범용 항목 목록 처리기다.
- 2.6 세 항목은 지시대로 변경하지 않았다.

---

## 3. Task 1 — Server-only Stage Policy + CI 누출 방지 Guard (✅ 구현·자동 검증 완료)

### 3.1 현재 상태 (코드 확인 결과)

`docs/architecture/stage-and-shared-testing-policy.md`는
`Status: Approved direction / implementation pending`이며,
**Claude의 코드 검색 결과 관련 구현이 0건임을 확인했다.**

- `DEVELOPMENT_TEST` / `SERVICE` / `stagePolicy` / `TAPTOLK_STAGE` / `resolveStage`
  → `packages`, `apps`, `supabase` 전체 grep **0건**
- `test_access_grant` / `testAccessGrant` / `Test Lab` → **0건**
- `persona` → 0건 (redaction 테스트와 랜딩 copy의 "personal" 오탐만 존재)

정책 문서가 존재한다는 이유로 완료로 보고해서는 안 된다는 점을 문서 스스로 명시하고 있다.

### 3.2 구현 방향

정책 문서 8절의 구현 순서 1번에 해당한다. **이후 모든 test-only 기능의 토대**이므로
Test Lab이나 grant보다 먼저 구현한다.

- 타입이 있는 **server-only** stage 경계를 `packages/config`에 추가한다.
- Stage는 서버 전용 설정에서만 결정된다. **브라우저 입력, query parameter, 쿠키,
  헤더, `NEXT_PUBLIC_` 변수로 stage를 바꿀 수 없어야 한다.** 이것이 핵심 보안 속성이다.
- 기본값은 fail closed다. 설정이 없거나 인식 불가하면 조용히 `DEVELOPMENT_TEST`로
  떨어지지 말고 안전한 쪽(더 제한적인 쪽)으로 처리한다.
- 브라우저 bundle이 이 모듈을 import하면 빌드가 실패해야 한다.

### 3.3 CI Guard

`SERVICE` 구성으로 빌드했을 때 test-only route, mock provider, fixture 명령,
environment capability가 **도달 가능하면 CI가 실패**해야 한다
(정책 문서 6절 마지막 문단).

현재는 보호할 test-only surface가 아직 없으므로, guard는 다음을 만족하도록 설계한다.

- 지금은 통과하되, 이후 Task에서 Test Lab이 추가될 때 자동으로 그것을 감시하도록
  확장 가능한 구조여야 한다.
- 기존 `scripts/verify-production-cron.mjs`가 좋은 선례다. 유사한 정적 검증기 형태를 권장한다.
- `package.json`의 `verify` 체인에 편입한다.

### 3.4 Task 1 완료 기준

- [x] 타입 있는 server-only stage 모듈, 브라우저 import 시 빌드 실패
- [x] 브라우저 입력으로 stage 변경 불가함을 증명하는 unit test
- [x] fail-closed 기본값 테스트
- [x] CI guard 스크립트 + `verify` 체인 편입
- [x] `corepack pnpm verify` PASS

### 3.5 실행 결과 (2026-07-20)

- 구현 커밋: `9c768b5`.
- `@taptolk/config/stage/server`가 `TAPTOLK_STAGE`만 읽으며, 미설정·공백·오입력은
  `SERVICE`로 fail-closed한다.
- 임시 Client Component에서 stage 모듈 import를 연결한 Next production build가
  `server-only cannot be imported from a Client Component`로 실패함을 확인한 뒤 검증용
  파일을 제거했다.
- stage unit 7개와 전체 unit 54파일·334테스트가 PASS했다.
- `verify:service-stage`는 `SERVICE` 구성에서 registry와 test-only marker를 대조하며,
  중앙 stage guard와 `NOT_FOUND` 동작 선언이 없는 표면을 거부한다.
- 최종 linked pgTAP 23파일·590테스트, authenticated staging E2E 28개,
  `corepack pnpm verify`가 PASS했다. 별도 10x100 acceptance는 의도적 opt-in skip을
  유지했다.

---

## 4. Task 2 — 관리자 로그인 단일 진입점 + 서버 역할 Routing

### 4.1 현재 상태 (코드 확인 결과)

정책 문서 5절은 "하나의 `관리자 로그인` 진입 + 로그인 후 서버가 역할로 분기"를 요구하나,
**현재 두 개의 로그인 진입점이 병존한다.**

- `apps/web/app/[locale]/admin/login/page.tsx`
- `apps/web/app/[locale]/admin/platform/login/page.tsx`

### 4.2 구현 방향

- 사용자에게 보이는 **관리자 로그인 진입점을 하나로 통합**한다.
- 로그인 후 **서버가** 승인된 profile, membership, scope, MFA(AAL) 상태를 로드해
  일반 관리자는 고객 dashboard로, 승인된 플랫폼 관리자는 platform dashboard로 라우팅한다.
  클라이언트 판단이나 프론트엔드 metadata로 분기하지 않는다.
- **로그인 계정 체계는 하나로 단순화하되, 로그인 이후 고객 영역과 플랫폼 영역의
  화면·권한 경계는 합치지 않는다.** (CLAUDE.md 9.1)
- 기존 RBAC/RLS 경계를 약화시키지 않는다. 이 작업은 **진입 UX 통합**이지 권한 통합이 아니다.
- 사용자 문구는 KO/EN dictionary에 동시에 추가한다. 하드코딩 금지.
- 오류, loading, forbidden, expired, MFA 미완료 상태를 함께 설계한다.

### 4.3 Task 2 완료 기준

- [x] 단일 관리자 로그인 진입점, 서버 역할 기반 post-login routing
- [x] 고객/플랫폼 화면·권한 경계 유지 확인
- [x] KO/EN dictionary 동시 반영
- [x] `corepack pnpm validate:wcj` PASS (320/768/1280/1920 CSS px 확인)
- [x] 인증된 staging E2E에서 역할별 routing 증명
- [x] `corepack pnpm verify` PASS

### 4.4 실행 결과 (2026-07-21)

- 공개·온보딩·password·Google 경로를 `/{locale}/admin/login` 하나로 통합했다. 기존
  `/{locale}/admin/platform/login`은 UI 없이 canonical login으로 server redirect한다.
- 로그인 후 `loadAdminContext`가 server-only Supabase session에서 profile, active
  membership, role/scope, MFA를 읽고 중앙 `resolveAdminAccess`와 `getAdminDecisionPath`로
  고객 dashboard 또는 분리된 platform dashboard를 선택한다. 브라우저 `area` 입력과
  callback parameter는 제거했다.
- 중앙 membership 선택은 active 상태뿐 아니라 role/scope 조합 유효성도 fail-closed한다.
  RBAC, RLS, MFA, 감사 mutation 경계와 고객/플랫폼 화면은 합치지 않았다.
- KO/EN 단일 로그인 copy, loading, expired-session, configuration/error, access-denied 상태와
  legacy redirect를 반영했다.
- WCJ 100/100, linked pgTAP 23파일·590테스트, authenticated staging E2E 30 PASS와 의도적
  10x100 opt-in skip 1개, local Chromium/Mobile smoke 36/36, `pnpm verify` PASS를 확인했다.
- Task 3 access grant, Test Lab, persona 기능은 시작하지 않았다.

---

## 5. Task 3 — Staging Test Access Grant (Task 1·2 완료 후)

정책 문서 3절에 해당한다. **Task 1의 stage policy가 선행되어야 한다.**

### 5.1 핵심 보안 속성

- 공유 URL 보유는 권한이 아니다. 가입해도 **`approval pending`** 상태이며
  Tenant/Admin/QR/사용자 데이터 접근이 **0**이어야 한다.
- 승인은 **기존 활성 Super Admin이 AAL2 상태에서** 수행한다.
- Grant는 **시간 제한형**이며 승인자, 사유, 생성 시각, 만료, 회수, redacted audit을 기록한다.
- Grant는 **환경 capability이지 새로운 business role이 아니다.**
  JWT `user_metadata` 플래그로 구현하지 않는다. 기존 RBAC 역할이 유일한 business 권한이다.
- 만료·회수 시 Test Lab 접근이 즉시 사라지되 Production 권한에는 영향이 없어야 한다.

### 5.2 Task 3 완료 기준

- [ ] grant schema + 마이그레이션 + RLS policy
- [ ] Super Admin 승인 UI (AAL2 요구)
- [ ] 만료·회수·감사
- [ ] 승인 대기 계정의 데이터 접근 0을 증명하는 **pgTAP**
- [ ] 만료된 grant가 접근을 차단함을 증명하는 pgTAP
- [ ] 인증된 staging E2E
- [ ] `corepack pnpm verify` PASS

### 5.3 이후 순서 (본 지시서 범위 밖, 별도 지시 예정)

정책 문서 8절 순서에 따라 Test Lab(4) → 낮은 역할 Persona 세션(5) →
결정적 cleanup·pgTAP·E2E(6) → 전체 재검증(7)으로 진행한다.
**Super Admin 세션을 재사용해 낮은 역할 RLS 통과를 주장하지 않는다**는 규칙이
5번 단계의 핵심이므로 미리 인지할 것.

---

## 6. Codex가 수행하지 말 것 — 사용자 승인·외부 권한 대기 항목

아래는 **사용자 소유 결정**이다. Codex는 임의로 선택·생성·설정하지 않으며,
필요해지면 중단하고 보고한다.

1. Production Supabase 프로젝트와 데이터 리전 (현재 `taptolk-staging`만 접근 가능)
2. Production SMS Provider 및 어댑터 구현
3. Production CAPTCHA Provider (결정 전까지 public Contact는 fail closed 유지)
4. Production Secret / credential 설정
5. 실제 Cron 활성화 및 Vercel 요금제 변경 — **활성 Cron `0` 유지**
6. 모니터링·알림·롤백·장애 대응 담당자, 도메인, 파일럿 기간
7. 실기기(iOS/Android), VoiceOver/TalkBack 운영자, 85mm 인쇄 검수
8. TUS resumable upload 도입 여부

### 6.1 미해결 위험 (참고)

`pnpm verify` 1회 실행에서 **Production build 성공 후 로컬 Turbo cache writer가 stall**했다.
read-only cache로는 정상 종료한다. 미조사 상태이며, 재현되면 검증 증거를 명시적으로 남길 것.

---

## 7. 최신 Handoff의 Exact Next Step과 본 지시서의 관계

`docs/handoff-0720-1531.md`의 Exact next development step은 다음과 같다.

> 별도의 Production Supabase 프로젝트와 데이터 리전을 지명·승인하고 접근 권한을 부여할 것.
> 그 승인 없이는 Production 프로젝트나 리전을 생성·선택하지 않는다.

즉 **handoff의 다음 단계는 코드 작업이 아니라 사용자 결정 대기 상태에서 정지**다.

본 지시서의 Task 0~3은 그 승인과 **무관하게 안전하게 진행 가능한 범위**만 담았다.
Production 관련 단계(마이그레이션 dry-run, 승인된 대상 적용, linked pgTAP)는
사용자 승인 이후 **별도 지시**로 처리한다. Codex는 본 지시서를 근거로
Production 대상에 어떤 작업도 수행하지 않는다.

---

## 8. 표준 검증 명령

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

# Cron 비활성 유지 확인
corepack pnpm verify:production-cron:deferred

# 민감값 검사
corepack pnpm verify:secrets
```

`pnpm db:test:linked`가 저장소의 linked pgTAP 진입점이다.
raw `supabase test db --linked`는 저장소 설정 경로를 재현하지 못하므로 대체 불가다.

---

## 9. 보고 규칙

- 결과와 사용자에게 남은 결정 사항을 먼저 말한다.
- **구현 완료 / 자동 검증 완료 / 수동 검증 대기**를 구분한다.
- PASS 주장에는 명령, 범위, 테스트 수 또는 CI run을 붙인다.
- `Production`이라는 단어는 실제 Production에 배포·검증된 경우에만 사용한다.
- Task 완료 시 `docs/handoff-MMDD-HHmm.md`를 `AGENTS.md` Session handoff protocol에 따라
  작성한다. branch/commit, 완료 범위, 검증 증거, 미해결 위험, Exact next step,
  사용자 소유 외부 설정을 포함하고 **Secret은 절대 포함하지 않는다.**
- 문서만 작성한 상태를 구현 완료로 보고하지 않는다.

---

## 10. 작업 순서 요약

| 순서 | Task | 선행 조건 | 규모 |
|---|---|---|---|
| 1 | Task 0 — QR 수량 계약 정합화 | ✅ 승인 완료 (2026-07-20) | 소 |
| 2 | Task 1 — server-only stage policy + CI guard | Task 0 | 중 |
| 3 | Task 2 — 관리자 로그인 단일 진입점 | Task 1 | 중 |
| 4 | Task 3 — staging test access grant | Task 1, 2 | 대 |

각 Task는 **가장 작은 안전한 수직 slice**로 나누어 구현한다.
Task 간 경계에서 `corepack pnpm verify`를 통과시키고 커밋한다.
