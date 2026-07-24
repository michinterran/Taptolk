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
