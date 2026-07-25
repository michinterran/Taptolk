# Taptolk 프로젝트 완료 계획 (Project Completion Plan)

> 작성: 2026-07-25 · 작성자: Claude(디자인 레인) · 소비자: Codex(구현) + 운영자
> 근거: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`, `docs/04-report/phase-0-9-development-closeout.report.md`,
> 실측(git·validate·grep). handoff 산문을 근거로 인용하지 않는다.

---

## 0. 결론 먼저

- **재시작하지 마라.** 지금 저장소는 버릴 상태가 아니라 **거의 완성된 상태**다.
  Phase 0–9 코드 범위가 자동·스테이징 증거 경계까지 닫혔고(pgTAP 587, unit 326,
  E2E 28–30, WCJ 100, 프로덕션 빌드 PASS), 배포된 fail-closed 스테이징이 살아 있다.
  재시작은 검증된 가치를 통째로 버리는 것이다.
- 사용자가 느끼는 "부채가 엉킨다"의 실체는 **코드 품질이 아니라 두 가지다:**
  (1) **협업 구조** — 세 에이전트가 한 워킹트리를 공유(→ `OPERATING_MODEL.md`로 해결),
  (2) **디자인 마감 + 외부 게이트** — 화면 폴리시와 운영자 몫 설정이 남음.
- 남은 일은 "새로 짓기"가 아니라 **정리 → 배선(wiring) → 파일럿 게이트 통과** 순서다.

---

## 1. 목표·가치·BM 대비 현재 위치

### 1.1 서비스 목표 (스펙 §1)
차량 QR로 **전화번호를 노출하지 않고** 호출자 B ↔ 차주 A를 목적제한형 Contact Session
으로 중계하는 익명 커뮤니케이션 SaaS. 우선 출시 대상: **국내 아파트 관리회사 B2B 파일럿.**

### 1.2 목표 대비 진척 (MVP DoD 20조건, 스펙 §30)

| # | MVP 완료 조건 | 상태 | 근거 |
|---|---|---|---|
| 1 | 관리회사·Site 생성 | ✅ 코드 완료 | Phase 1 closeout |
| 2 | 브랜드 로고 업로드 | ✅ | Phase 2 |
| 3 | 4개 템플릿 선택 | ✅ | Phase 2 |
| 4 | 샘플 스티커 승인 | ✅ (미리보기 RPC 배선 대기) | §5-Codex |
| 5 | QR 생성 (배치) | ✅ 코드 완료 | Phase 3 |
| 6 | 중복 0 | ✅ 검증됨 | pgTAP |
| 7 | QR 품질검사 | ✅ | qr-engine |
| 8 | PDF·CSV·ZIP | ✅ | Phase 3 |
| 9 | Site 입고 | 🟡 정본 완료, **입고 엔드포인트 대기** | §5-Codex |
| 10 | 차량 임시 배정 | ✅ | Phase 4 |
| 11 | 차주 OTP 활성화 | 🔴 **활성화코드 제거·재진입 배선 대기** | §5-Codex |
| 12 | B QR 요청 | ✅ | Phase 6 |
| 13 | A 카카오 알림톡 | 🟡 스테이징 provider만, live 계약 외부 | 외부 게이트 |
| 14 | A 원터치 답장 | ✅ 코드, 세션 필드 배선 대기 | §5-Codex |
| 15 | B 답장 확인 | ✅ | Phase 7 |
| 16 | 미응답 관리사무소 전달 | ✅ | Phase 8 |
| 17 | 분실·교체·폐기 | ✅ 코드, 실행 엔드포인트 일부 대기 | §5-Codex |
| 18 | Tenant 격리 | ✅ 검증됨(RLS+pgTAP) | Phase 1 |
| 19 | Rate Limit | ✅ | Phase 8 |
| 20 | KPI Dashboard | ✅ 코드 | Phase 9 |

**요약: 20개 중 대부분 코드 완료. "빨강/노랑"은 새 코드가 아니라 최근 디자인 결정
(활성화코드 폐지, 6단계 위자드, 전화번호 브라우저 미노출)에 따른 재배선이다.**

### 1.3 BM 관점에서 아직 확정 안 된 것 (운영자 몫)
스펙 §0.3이 "작업 중단 후 보고" 조건으로 이미 명시한 것들 — 코드가 아니라 **비즈니스 결정**:
- 실제 과금 가격 · 인쇄 규격·재질 · 개인정보 보유기간 정책
- 카카오 알림톡 공식 딜러 계약·채널·정보성 템플릿 승인
- 파일럿 대상 관리회사/단지 확보

> 이 결정들이 없으면 **매출이 나는 파일럿**이 성립하지 않는다. 코드 완성도와 별개로
> 이 트랙을 병행해야 한다(§5).

---

## 2. 재시작 vs 정리-후-계속 — 판단 근거

| 기준 | 재시작 | 정리 후 계속 (**채택**) |
|---|---|---|
| 검증된 코드 가치 | 587 pgTAP·326 unit·E2E 전부 폐기 | 보존 |
| 아키텍처 | 스펙 §4 레이어·RLS·RBAC 재구축 필요 | 이미 규율 있음(코드 부채 낮음) |
| 실제 위험 | 협업 구조·디자인 드리프트 | 동일 위험이 재시작에도 그대로 옴 |
| 소요 | 수 개월 | 수 주 |

**결정: 정리 후 계속.** 문제는 코드가 아니라 **프로세스**였고, 프로세스는 저장소를
버리지 않고 고칠 수 있다(`OPERATING_MODEL.md`). 재시작은 같은 협업 문제를 새 코드에서
반복할 뿐이다.

---

## 3. 정리 백로그 (깨끗하게 만들 것)

우선순위 순. 대부분 **Codex 소유**(코드/설정), 일부는 운영자.

### 3.1 즉시 (구조적 위생)
1. **섞인 워킹트리 분리.** 현재 `codex/phase-1-foundation`에 디자인(globals.css)과
   구현(operations-dashboard-view.tsx·operations-copy.ts·render.ts·새 마이그레이션·
   baseline.json)이 미커밋으로 섞여 있다. 레인별로 나눠 각자 커밋한다(`OPERATING_MODEL` §6).
2. **`OPERATING_MODEL.md` 발효.** Antigravity를 공유 브랜치 커밋에서 제외(리뷰 전용).
   다음 작업부터 레인별 브랜치.
3. **로컬 dev 500 수정.** `apps/web/app/[locale]/(public)/owner/offline`의 owner/offline
   JSON 처리 버그로 로컬이 500. Codex 도메인. 이게 있으면 어떤 화면도 실기 검증이 막힌다 → **최우선.**

### 3.2 저장소 위생 (Codex)
4. `.next` 생성물 안의 macOS 복제본(`.next/types/validator 2.ts` 류) 정리. `.next`는
   `.gitignore`에 있으나 로컬 잔재가 grep·검증을 오염시킨다(가짜 138 `@ts-ignore`의 출처).
5. 실제 소스의 `as unknown as` 3곳(qr-generation-dispatch-runtime·worker·qr-engine)에
   타입 경계 주석 또는 좁힌 타입 부여. 스펙 §0.1-16 준수.
6. **handoff 문서 아카이브.** 3일간 7개(`handoff-0722*`~`0724*`). 최신 1개만 루트 인접에
   두고 나머지는 `docs/archive/`로. 세션 상태는 설계 근거가 아니다.

### 3.3 디자인 부채 (Claude 정의 → Codex 적용)
7. globals.css **8,731줄 / px 리터럴 약 262개**를 토큰으로 이관, baseline 약 300 → 감축.
   P4 "부채 상환"과 동일 작업. 표면 간 일관성은 `DESIGN_CONSISTENCY_RULES.md`가 판정.
8. 진행 중이던 공개·인증 폴리시(캡션·배지 크기 정규화)는 이미 tokens 매핑까지 됨 —
   Codex가 globals.css 적용분을 검증·흡수(디자인 값은 tokens.css가 원천).

---

## 4. 완료까지 순서 (로드맵)

의존성 순. 각 단계는 `DESIGN_CONSISTENCY_RULES.md`의 게이트와 `AGENTS.md`의 DoD를 통과해야 닫힌다.

### 스텝 A — 기반 복구 (Codex, 1순위)
- 로컬 dev 500(owner/offline) 수정 → 실기 검증 복구.
- 워킹트리 분리·운영모델 발효.
- **완료 판정:** `corepack pnpm dev`가 공개·콘솔 화면을 200으로 렌더.

### 스텝 B — 미결 배선 (Codex, `plan-design-completion-0724.md` §5)
정본은 이미 있고 서버 배선만 남은 항목. 🔴는 사용자 여정을 막는 것:
- 🔴 `complete` 응답에서 `activationCode` 제거(활성화 완결).
- 🔴 재진입 엔드포인트 2개(`/api/owner/session/reclaim/*`).
- 6단계 위자드 데이터·라우팅.
- 사이트 입고 엔드포인트(`POST .../batches/{id}/receive`) + 배송 추적.
- `qr_batch_samples` SELECT security-definer RPC(샘플 미리보기).
- 세션 응답 필드(`plateLast4`·`callerMessage`·`createdAt`·`elapsedSeconds`·남은 왕복).
- 차주 호출/지난호출/채널상태 엔드포인트, 스티커 중지·해지 실행 엔드포인트.
- test 데이터 플래그 컬럼 + 콘솔 기본 숨김.
- **완료 판정:** MVP DoD §1.2 표의 🔴·🟡가 전부 ✅. 각 계약은 `CONTRACTS.md`와 일치.

### 스텝 C — 디자인 마감 (Claude → Codex)
- P3 나머지: 로그인·가입·MFA 카드 상태(로딩·오류·비활성) 폴리시.
- P4 부채 상환: 구 `owner-*`/`public-*` CSS → `.tt-m-*` 이관, 반응형 320/768/1280/1920.
- **완료 판정:** baseline 감축 후 `--update-baseline`, 표면 간 일관성 체크리스트 통과.

### 스텝 D — 스테이징 로그인 복구 (운영자)
- `docs/deployment/staging-login-env-checklist.md`의 Supabase 환경변수를 Vercel에 설정 후
  Redeploy. 이게 있어야 **로그인 뒤 콘솔 화면의 실기·눈 대조 검증**이 가능하다.
- **완료 판정:** 스테이징 로그인 성공, 콘솔 화면을 정본과 눈 대조.

### 스텝 E — 파일럿 외부 게이트 (운영자, closeout §5)
1. 별도 Production Supabase 프로젝트·리전 → 마이그레이션 적용·검증.
2. Production SMS·CAPTCHA provider 선정·adapter 승인 후 secret 설정.
3. 실기기·VoiceOver/TalkBack·계산대비·키보드·85mm 인쇄 검수.
4. 모니터링·롤백·인시던트·파일럿 창구 담당자 지정.
5. 실서비스 시점에만 Cron 가능 플랜으로 이동, 템플릿 활성화, 런북의 승인된
   집계전용 실행·동시간 리플레이·중복0 증명·secret 회전·롤백 리허설.
6. 파일럿 체크리스트 전 항목 서명 후에만 `READY`.
- **완료 판정:** 파일럿 체크리스트 100% 서명.

### 스텝 F — BM 확정 (운영자, §1.3)
- 과금 가격·인쇄 규격·보유기간·카카오 계약·파일럿 고객 확보.
- **완료 판정:** 첫 유료 파일럿 단지 계약.

---

## 5. 놓치기 쉬운 것 (종합 점검)

- **QR `1..100`/배치 계약을 임의로 바꾸지 마라.** 1,000개 수용은 "승인된 100개 배치 10회"
  였다. 100 초과 요청이 오면 스키마·UI·Worker·Queue·export 손대기 전에 멈추고 별도
  수량 정책 승인을 받는다(closeout §5).
- **전화번호는 브라우저로 절대 안 간다**(뒤 4자리도). `AGENTS.md` Security. 화면·응답·로그
  전부. 재배선(스텝 B) 때 회귀 없는지 확인.
- **활성화코드 폐지 회귀.** 스티커 소지가 자격. 관련 코드·문서·테스트에 activationCode가
  남지 않았는지 스텝 B에서 sweep.
- **상태를 나중에 몰아 붙이지 마라.** 빈·로딩·오류·권한없음·한도·알수없음은 화면과 함께.
- **게이트 통과 ≠ 정본 일치.** 로그인 뒤 화면은 스텝 D 없이는 눈 대조가 불가 — 그 전에
  "완료" 선언 금지.
- **파일럿은 코드만으로 안 끝난다.** §1.3 BM 트랙과 스텝 E 외부 게이트를 병행하지 않으면
  코드가 100%여도 출시가 막힌다.
- **로고 자산 불변**(SHA-256 고정). 크롭·재색 금지.

---

## 6. Codex 실행 지시 (요약)

> 상세 계약은 `docs/design-canon/CONTRACTS.md`와 `docs/development/workorder-*.md`.
> 작업 순서·보고 형식은 스펙 §0.2 / §31, 경계는 `OPERATING_MODEL.md`.

1. **스텝 A**부터 착수: 로컬 dev 500(owner/offline) 수정, 워킹트리 분리.
2. **스텝 B**의 🔴 두 건(활성화코드 제거·재진입 2개)을 먼저 — 차주 여정을 막는다.
3. 각 배선은 정본·CONTRACTS.md에 맞추고, 없는 값은 화면이 `—`로 비운 그대로 채운다.
4. 디자인 토큰·정본을 바꾸지 마라. 정본으로 답이 안 나오면 멈추고 Claude에 되돌린다.
5. 각 Phase/스텝 완료 시 `validate:design-system`·`validate:wcj`·`verify` 실행하고
   스펙 §31 형식으로 보고. PR은 Antigravity 리뷰 후 머지.
6. 100 초과 수량·프로덕션 설정·Cron·live Kakao/SMS·승인워크플로 신설은 **착수 금지**,
   운영자에 보고.

---

## 7. 상태 추적표 (갱신하며 사용)

| 스텝 | 소유 | 상태 |
|---|---|---|
| A 기반 복구 | Codex | ☐ |
| B 미결 배선 | Codex | ☐ |
| C 디자인 마감 | Claude→Codex | 진행 중(P3) |
| D 스테이징 로그인 | 운영자 | ☐ |
| E 파일럿 외부 게이트 | 운영자 | ☐ |
| F BM 확정 | 운영자 | ☐ |
