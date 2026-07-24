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

### A-2 활성화 코드

**⚠️ 정본과 상위 문서가 충돌한다. 운영자 확정이 필요하다.**

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` §6.4는 활성화 코드 입력을 요구한다
- `pwa/README.md` §2는 **"화면이 보내는 것은 차량번호와 전화번호뿐"**이라고 적었다
- 승인된 실물 스티커(`pwa/sticker-physical.png`)에는 **코드가 인쇄되어 있지 않다**

권한 순서상 스펙이 이기므로 지금은 코드 단계를 둔다. 코드를 없애기로 하면 이 단계를
삭제하고 `complete`에서 `activationCode`를 빼면 된다 — 다른 화면은 영향받지 않는다.

| 필드 | 출처 | 없을 때 |
|---|---|---|
| `activationCode` (화면 → 서버) | `complete` 요청 본문 | 서버가 필수로 요구 |

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
