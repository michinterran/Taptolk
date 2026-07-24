# 화면 데이터 계약 — 서버가 줘야 하는 것

디자인은 Claude가, 백엔드는 Codex가 붙인다(운영자 확정 2026-07-24). 이 문서가 그
경계다. **화면을 만들 때 여기에 행을 추가하는 것이 완료 조건 6번이다**
(`docs/development/plan-design-completion-0724.md` §1).

## 읽는 법

- **필드** — 화면이 그리는 값. 이름은 응답 DTO 기준
- **출처** — 이미 있으면 그 RPC·컬럼, 없으면 **`신규`**
- **없을 때** — 서버가 아직 안 줄 때 화면이 하는 일. `—`이면 그 자리를 비운다.
  **목업 값을 굽지 않는다**(`DESIGN_SYSTEM.md` §4)

원문을 그리지 않는 값은 `last4`로 받는다. 전화번호·차량번호 원문은 응답에 담지
않는다(`AGENTS.md`, Security).

---

## 스캔 진입 (`/{locale}/q/{publicToken}`)

구현: `apps/web/scan/scan-entry.ts` · 정본: `pwa/README.md` §1

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 자산이 활성·바인딩됨 | `inspect_public_contact` | 프로브 실패는 [E] `SERVICE` |
| 자산이 미활성 | `inspect_owner_activation` | 위와 같음 |
| **이 기기 차주 세션이 이 자산의 것인가** | **신규** — `tt_owner_session`과 `public_token_hash`를 함께 받는 security-definer RPC | 지금은 판정 불가라 [C]로 못 보낸다. 차주는 [B]의 `이 차량의 차주이신가요?`로 들어온다 |

**주의:** 쿠키 존재만으로 [C]를 띄우면 남의 스티커를 스캔한 차주에게 [C]가 뜬다.
서버가 "이 세션이 이 자산의 것"임을 증명해야 한다.

## [E] 사용할 수 없는 스티커

구현: `apps/web/components/scan-unusable-view.tsx` · 정본: `pwa/README.md` §4

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 사유 `SERVICE` \| `UNKNOWN` | `scan-entry-decision.ts` | — |

**사이트를 내려주지 않는다.** 폐기된 스티커로 소속 사이트를 알아낼 수 있으면 안 된다.
폐기·만료·정지를 구분해 보여주려면 RPC가 사유를 돌려줘야 하는데, 그 사유 자체가
자산의 존재를 알려주므로 **운영자 확정 전에는 구분하지 않는다.**

## [A] 차주 활성화 (`/{locale}/activate/{publicToken}`)

구현: `apps/web/components/owner-activation-view.tsx` · 정본: `pwa/README.md` §2

### A-1 위치 확인

| 필드 | 출처 | 없을 때 |
|---|---|---|
| `siteDisplayName` | `inspect_owner_activation` → `site_display_name` | 이름 줄을 그리지 않는다 |
| `siteAddress` | **신규** — `sites.address`를 RPC 응답에 추가 | `locationAddressMissing` 한 줄 |
| `siteType` | **신규** — 아파트·오피스텔·빌딩 | 유형 줄을 그리지 않는다 |

**주소가 이 화면의 목적이다.** 이름만으로는 같은 이름의 다른 단지와 구분되지 않는다
(README §2). 주소를 바인딩에 복사하지 않는다 — 사이트가 바뀌면 두 값이 어긋난다.

### A-2 차량번호

**활성화 코드는 없앴다 (운영자 확정 2026-07-24).** 스티커를 가진 것이 자격이고,
잘못 등록되면 폐기·재발급으로 되돌린다. 근거와 서버 작업은
`docs/development/workorder-drop-activation-code-0724.md`.

| 필드 | 출처 | 없을 때 |
|---|---|---|
| `plate` (화면 → 서버) | `complete` 요청 본문 | — |

형식 검증만 화면에서 한다. **중복·소유 판정은 서버가 한다.**

🔴 **서버가 아직 `activationCode`를 필수로 요구하므로 `complete`가 400을 돌려준다.**
위 지시서가 반영돼야 활성화가 완료된다.

### A-3 전화번호 인증

| 필드 | 출처 | 없을 때 |
|---|---|---|
| `challengeId` | `request-otp` | OTP 입력칸을 그리지 않는다 |
| `expiresInSeconds` | **신규** — `request-otp` 응답에 추가 | 남은 시간을 `0:00`으로 표시하지 않고 카운트다운을 시작하지 않는다 |
| 재발송 쿨다운 잔여 초 | **신규** | 쿨다운 표시 없음 |
| 실패 사유 (만료·불일치·시도초과) | **신규** — 지금은 셋 다 `INVALID` | 구분 없이 `errorInvalid` 한 줄 |

카운트다운은 표시용이다. **만료는 서버가 판정한다.**

### A-4 완료

| 필드 | 출처 | 없을 때 |
|---|---|---|
| `vehiclePlateLast4` | `complete` 응답 | 차량번호 대형 수치를 그리지 않는다 |
| `siteDisplayName` | A-1에서 이어짐 | 사이트 줄을 그리지 않는다 |

### 중간 이탈 후 재진입

README §2는 "마지막 완료 단계에서 이어진다"를 요구한다. 지금 화면은 상태를 메모리에만
두므로 새로고침하면 A-1로 돌아간다. **신규** — 서버가 활성화 진행 상태를 돌려주면
그 단계로 복귀한다.

## [R] 재진입 (`/{locale}/q/{publicToken}/owner`)

구현: `apps/web/components/owner-reclaim-view.tsx` · 정본: `pwa/README.md` §1

폰을 바꾸거나 시크릿 모드로 연 차주는 세션이 없어서 **자기 스티커에서 [B] 화면을 본다.**
그 화면 아래 `이 차량의 차주이신가요?` 링크가 이곳으로 온다.

**등록을 다시 하는 것이 아니다.** 바인딩은 그대로 두고 이 기기에 차주 세션만 새로 연다.
화면 첫 카드가 그 사실을 말한다 — 안 그러면 차를 두 번 등록하는 것으로 읽힌다.

### 🔴 엔드포인트 2개가 없다. Codex가 만들어야 한다

| 엔드포인트 | 받는 것 | 하는 일 |
|---|---|---|
| `POST /api/owner/session/reclaim/request-otp` | `publicToken` · `plate` · `phone` · `deviceHash` · `locale` | **차량번호와 전화번호가 둘 다 이 자산의 활성 바인딩과 일치**할 때만 OTP를 보낸다 |
| `POST /api/owner/session/reclaim/verify` | `publicToken` · `challengeId` · `otp` · `deviceHash` · `locale` | 검증 후 `tt_owner_session` 쿠키 발급 + `owner_devices`에 이 기기 등록 |

응답 필드: `challengeId`, `expiresInSeconds`.

### 지켜야 할 것

- **하나만 맞아서는 통과하지 못한다.** 스티커가 차량을 안다는 건 서버가 아는 사실이지
  스캔한 사람이 차주라는 증명이 아니다(README §1)
- **불일치는 어느 쪽이 틀렸는지 알려 주지 않는다.** 화면은 `INVALID`·`CONFLICT`·404를
  전부 같은 문구로 보여준다. 서버도 사유를 구분해 내려주면 안 된다 — 하나씩 맞춰보는
  것을 돕게 된다
- **시도 횟수 제한이 필요하다.** 차량번호는 주차장에서 눈으로 읽을 수 있으므로,
  전화번호를 반복 대입하는 것을 서버가 막아야 한다. 한도 초과는 `LIMITED`
- 새 바인딩을 만들지 않는다. `qr_bindings`는 건드리지 않고 `owner_devices`에만 추가한다

---

## 전 화면 공통 — 차주 전화번호는 브라우저로 가지 않는다

**운영자 확정 2026-07-24.** 차주가 활성화(A-3)와 재진입(R-2)에서 **입력하는** 순간
말고는, 프론트 어디에서도 차주의 전화번호를 받지도 그리지도 않는다.

- 어떤 응답도 전화번호를 담지 않는다. **뒤 4자리도 담지 않는다**
- 어떤 화면도 전화번호를 그리지 않는다. **마스킹한 것도 그리지 않는다**
- `phone_last4`는 DB에만 남는다. 조회는 `phone_hash`로 한다
- 번호 변경은 새 번호를 처음부터 입력하고 다시 인증한다. 기존 번호를 보여 주고
  고치게 하지 않는다

### 확인 결과 (2026-07-24, HEAD `f86e931`)

지금 브라우저로 나가는 응답 어디에도 전화번호가 없다:

| 응답 | 담는 것 |
|---|---|
| `inspect_owner_activation` | 사이트명 · `plate_last4` · 상태 |
| `complete_owner_activation` | `owner_id` · `vehicle_id` · `vehicle_plate_last4` · `qr_status` · 세션 만료 |
| `list_owner_vehicles` | `vehicle_id` · `plate_last4` · `site_id` · `qr_status` |
| `inspect_public_contact` | 사이트명 · `plate_last4` |
| 에스컬레이션 | 경과초 · `officeAvailable`(불리언) · 단계 |

**에스컬레이션도 번호가 아니라 불리언이다.** 관리사무소 번호는 임계를 넘긴 세션에만
`tel:` 링크로 나가고, 화면에 인쇄하지 않는다(README §6).

**차주 화면 ALERT·SETTINGS 탭은 번호 대신 상태만 보여준다.** 정본을 이 규칙에 맞게
고쳤다(README §3).
