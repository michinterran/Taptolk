# Codex 작업지시 — 모바일 화면에 백엔드 붙이기 (2026-07-24)

**분담:** 디자인은 Claude가 끝냈다. **이 문서는 그 화면들이 동작하려면 서버가 무엇을
줘야 하는가**만 적는다. 화면 형태를 바꾸지 마라 — `DESIGN_SYSTEM.md`와
`docs/design-canon/`이 정본이고, 화면이 요구하는 필드는
`docs/design-canon/CONTRACTS.md`에 화면별로 적혀 있다.

**착수 전에 반드시 읽어라:** `AGENTS.md` → `DESIGN_SYSTEM.md` §0 →
`docs/design-canon/CONTRACTS.md`.

---

## 0. 절대 지켜야 할 것

1. **차주 전화번호는 브라우저로 보내지 않는다.** 뒤 4자리도 안 된다
   (`AGENTS.md` Security, 운영자 확정 2026-07-24). 조회는 `phone_hash`로 한다
2. **화면을 고치지 마라.** 필드가 모자라면 서버에 추가한다. 화면이 값을 못 받으면
   그 자리를 비우도록 이미 만들어져 있다
3. **정직성:** 없는 값을 0이나 기본값으로 채워 내려보내지 않는다. 모르면 안 내려보낸다
4. `tenant_id` 격리, RBAC → RLS 이중 방어, 보안 변경은 같은 트랜잭션에 감사행
5. 마이그레이션은 **새 파일**로. 기존 마이그레이션을 수정하지 않는다
6. 슬라이스마다 `corepack pnpm verify`. 화면 관련 변경이면 `validate:wcj`도

---

## 1. 🔴 지금 깨져 있다 — 먼저 고쳐라

### 1.1 활성화 코드 제거 (차주 활성화가 완료되지 않음)

운영자가 코드 입력을 **없애기로 확정**했다(2026-07-24). 화면은 이미 코드를 묻지 않고
`complete` 요청에 `activationCode`를 싣지 않는다. **서버가 아직 필수로 요구해서
400이 난다.**

상세 지시서: `docs/development/workorder-drop-activation-code-0724.md`

요약: `completeSchema`에서 제거 → 서비스·리포지터리 경로 제거 →
`complete_owner_activation`에서 코드 검증 블록 제거(단, 발급된 코드의 `USED` 처리는
유지) → **테이블과 워커 발급은 그대로 둔다** → E2E·pgTAP 수정.

### 1.2 재진입 엔드포인트 2개 (폰 바꾼 차주가 자기 스티커를 못 엶)

화면: `apps/web/components/owner-reclaim-view.tsx` · 계약: `CONTRACTS.md` [R]

| 엔드포인트 | 받는 것 | 하는 일 |
|---|---|---|
| `POST /api/owner/session/reclaim/request-otp` | `publicToken` `plate` `phone` `deviceHash` `locale` | **차량번호와 전화번호가 둘 다** 이 자산의 활성 바인딩과 일치할 때만 OTP 발송 |
| `POST /api/owner/session/reclaim/verify` | `publicToken` `challengeId` `otp` `deviceHash` `locale` | 검증 후 `tt_owner_session` 쿠키 + `owner_devices` 등록 |

응답: `challengeId`, `expiresInSeconds`.

**반드시 지켜라:**

- **하나만 맞아서는 통과하지 못한다.** 스티커가 차량을 안다는 건 서버가 아는 사실이지
  스캔한 사람이 차주라는 증명이 아니다
- **실패 사유를 구분해 내려주지 마라.** 차량번호는 주차장에서 눈으로 읽을 수 있으므로,
  "차량번호는 맞다"고 알려주면 남은 건 전화번호 하나뿐이 된다. 전부 같은 코드로 돌려준다
- **시도 횟수 제한을 서버가 건다.** 한도 초과만 `LIMITED`로 구분한다
- 새 바인딩을 만들지 않는다. `qr_bindings`는 건드리지 않고 `owner_devices`에만 추가

---

## 2. 활성화 화면이 기다리는 값

화면: `apps/web/components/owner-activation-view.tsx` · 계약: `CONTRACTS.md` [A]

| 무엇 | 어디에 | 왜 |
|---|---|---|
| `siteAddress`(`sites.address`) · `siteType` | `inspect_owner_activation` 응답 | **A-1의 목적이 주소다.** 이름만으로는 같은 이름의 다른 단지와 구분되지 않는다 |
| `expiresInSeconds` | `request-otp` 응답 | 남은 시간 카운트다운. **만료 판정은 계속 서버가 한다** |
| 재발송 쿨다운 잔여 초 | `request-otp` 응답 | 지금은 쿨다운을 표시할 수 없다 |
| OTP 실패 사유 구분 (만료 / 불일치 / 시도 초과) | `verify-otp` 에러 코드 | 지금은 셋 다 `INVALID`라 화면이 한 문구밖에 못 쓴다 |
| 활성화 진행 단계 | `inspect_owner_activation` 응답 | 중간 이탈 후 다시 스캔하면 **마지막 완료 단계에서 이어진다**(README §2) |

**주소를 바인딩에 복사하지 마라.** 주소는 사이트의 것이고 바인딩은 사이트를 참조한다.
복사하면 사이트 주소가 바뀔 때 두 값이 어긋난다.

---

## 3. 스캔 분기 [C] — 차주가 자기 스티커를 스캔했을 때

화면: `apps/web/scan/scan-entry.ts` · 계약: `CONTRACTS.md` 스캔 진입

지금은 `tt_owner_session`이 **이 자산의 것인지 증명할 방법이 없어서** 차주도 [B]
연락 요청 화면을 본다. 필요한 것:

**security-definer RPC 하나** — `session_hash`와 `public_token_hash`를 함께 받아
그 세션의 차주가 이 자산의 활성 바인딩 소유자인지 판정한다.

⚠️ **쿠키 존재만으로 [C]를 띄우면 안 된다.** 남의 스티커를 스캔한 차주에게 [C]가 뜬다.

붙인 뒤 `scan-entry.ts`의 `decideScanScreen`에 `owner` 프로브를 추가하면 된다.
분기 우선순위는 **차주 본인 → 연락 요청 → 활성화 → 사용 불가**.

---

## 4. 호출자 대기·응답 화면이 기다리는 값

화면: `apps/web/components/contact-waiting-room.tsx` · 계약: `CONTRACTS.md` [B]

`read_public_contact_session` 응답에 추가:

| 필드 | 왜 |
|---|---|
| `plateLast4` | 시안 02·04의 차량번호 카드를 그릴 수 없다 |
| `callerMessage` | 호출자 자신이 보낸 본문. 없으면 고른 멘트로 대체 중 |
| `createdAt` | 시안 04의 `호출 시간` 행 |
| `callerMessagesRemaining` | **남은 왕복 횟수**(README §5). 다 쓰면 화면이 입력을 닫는다 |

에스컬레이션 응답(`/escalation`)에 추가:

| 필드 | 왜 |
|---|---|
| `elapsedSeconds` | 시안의 `경과 3분 12초` |
| `officeName` · `officePhone` | README §6이 **`tel:` 버튼**을 요구한다 |

**`tel:`에 대한 제약:**

- **임계를 넘긴 세션에만** 내려준다. 그 전에는 응답에 담지 않는다
- **차주 번호가 아니라 사이트 대표번호**(`sites.escalation_phone_encrypted`)다
- 번호는 **`href`에만** 들어간다. 화면에 인쇄하지 않는다
- 번호가 등록되지 않은 사이트면 **내려주지 마라.** 눌러도 안 되는 버튼을 두지 않는다

**관리사무소에 넘기는 정보는 운영에 필요한 것만:** 차량번호 · 요청 유형 ·
발송 성공/확인 상태 · 경과시간. **호출자·차주의 전화번호는 넘기지 않는다**(보고서 §09).

---

## 5. 차주 탭이 기다리는 것

화면: `apps/web/components/owner-tab-views.tsx` · 계약: `CONTRACTS.md` [C]

| 엔드포인트 | 탭 | 없으면 |
|---|---|---|
| 진행 중인 호출 목록 (차주 세션) | MESSAGES | 빈 상태로만 남는다. **동시에 여러 호출이 와도 쌓아 보여줄 수 없다** |
| 지난 호출 (시각·유형·결과·응답까지 걸린 시간) | HISTORY | 빈 상태로만 남는다 |
| 알림톡 채널 상태(차단 여부) | ALERT | **`상태 확인 불가`로 둔다.** "연결됨"을 확인 없이 쓰지 않는다 |
| Web Push 구독 | ALERT | 버튼 비활성 |
| 스티커 중지 / 등록 해지 실행 | SETTINGS | 확인 화면의 `확인`이 눌리지 않는다 |
| `siteDisplayName` | SETTINGS | 관리 현장 행을 그리지 않는다 |

`list_owner_vehicles`에 사이트명을 추가하는 것이 가장 작은 변경이다.

**HISTORY 규칙:** 결과가 없으면 `—`. **미응답을 0분으로 쓰지 않는다.** 본문이
만료되면 유형만 남긴다(README §13).

**해지해도 과거 호출 기록은 감사 목적으로 남긴다.** 확인 화면이 이미 그렇게 말하고
있으므로 서버도 그렇게 동작해야 한다.

---

## 6. 같이 처리할 기존 결함

| | 무엇 |
|---|---|
| 1 | **샘플 미리보기 404** — `authenticated`에 `qr_batch_samples` SELECT 권한이 없어 `/api/admin/qr-samples/[id]`가 항상 실패. security-definer RPC 필요 |
| 2 | `renderSticker`가 특정 payload에서 자기 출력을 decode 못 한다. `.../s/DEMO0000DLVR`가 템플릿 2종에서 실패. 재현은 `docs/handoff-0723-1745.md` §7 |
| 3 | `operations-dashboard-view.tsx`가 단위 `"s"` 하드코딩 → KO에서 "12.3s" |

---

## 7. 권장 순서

1. **§1.1 활성화 코드 제거** — 지금 깨져 있다
2. **§1.2 재진입 엔드포인트** — 폰 교체 차주가 막혀 있다
3. §2 활성화 보강 (주소·만료초·실패 사유·이어하기)
4. §3 스캔 [C] 분기
5. §4 호출자 세션·에스컬레이션 필드
6. §5 차주 탭 엔드포인트
7. §6 기존 결함

각 단계는 독립적으로 배포 가능한 슬라이스로 끊어라.

---

## 8. 별도 지시 없이 착수 금지

Production 배포 · 도메인 연결 · Cron 활성화 · **live Kakao/SMS Provider** ·
Production Supabase · Enterprise SSO · Vercel 설정 · 담당자 지정 ·
승인 워크플로 신설 · **S7·S9 임계 임의 결정** · QR `1..100` 계약 변경 ·
보호 대상 untracked 문서 커밋/삭제 · **화면 디자인 변경**

## 9. 보고 형식

구현 완료 / 자동 검증 완료 / 수동 검증 대기를 구분한다. PASS 주장에 명령·범위·수를
붙인다. credential·전화번호·OTP·토큰·secret은 Git·문서·로그·스크린샷에 남기지 않는다.
