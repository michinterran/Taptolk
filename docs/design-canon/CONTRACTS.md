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

## [B] 호출자 (`/{locale}/q/{publicToken}`, `/{locale}/c/current`)

구현: `apps/web/components/public-contact-view.tsx`, `contact-waiting-room.tsx`
정본: `pwa/01·02·04-*.png` + README §5·§6·§8

### B-1 작성

| 필드 | 출처 | 없을 때 |
|---|---|---|
| `vehicle.plateLast4` | `inspect_public_contact` | 차량번호 카드를 그리지 않는다 |
| `siteDisplayName` | 같음 | 쓰지 않는다 |
| 멘트 목록 | `CONTACT_REASON_CODES` + 카피 카탈로그 | — |

- **호출자에게 차량번호 원문을 내려보내지 않는다.** 시안 01은 전체를 그렸지만
  README §2가 원문은 서버 밖으로 안 나간다고 못박았다. 뒤 4자리에 라벨을 붙여 보여준다
  (**운영자 재확인 2026-07-25: 4자리 유지**)
- 시안의 `★가장 많이 사용된 멘트`와 `평균 응답 예상 시간`은 **실측이 없으므로 그리지
  않는다**(§4). 데이터가 쌓이면 그때 살린다 (**운영자 확정 2026-07-25: 실측 전 숨김**)
- ✅ **시안 01의 3번째 멘트 `연락 부탁드립니다`를 추가한다 (운영자 확정 2026-07-25).**
  Codex 작업: `CONTACT_REASON_CODES`에 코드 1개 추가(도메인) + KO/EN 카피 카탈로그 추가.
  아이콘은 시안대로 전화 계열. 기존 코드 순서·의미를 바꾸지 않는다

### B-2 대기 · B-3 에스컬레이션 · B-4 응답 도착

| 필드 | 출처 | 없을 때 |
|---|---|---|
| `status` | `read_public_contact_session` | — |
| `ownerMessages[].body/createdAt` | 같음 | 받은 메시지 카드를 그리지 않는다 |
| **`plateLast4`** | **신규** | **시안 02·04의 차량번호 카드를 그리지 않는다** |
| **`callerMessage`** | **신규** — 호출자 자신이 보낸 본문 | 고른 멘트의 템플릿 문구로 대체, 둘 다 없으면 카드 없음 |
| **`createdAt`** | **신규** — 호출 시각 | `호출 시간` 행을 그리지 않는다 |
| **`elapsedSeconds`** | **신규** — 에스컬레이션 응답에 추가 | 경과 시간을 그리지 않는다 |
| **`callerMessagesRemaining`** | **신규** — 남은 왕복 횟수(README §5) | 남은 횟수를 그리지 않는다 |

- **`보냈습니다` ≠ `차주가 확인했습니다` ≠ `답장했습니다`.** 상태 줄은 실제로 일어난
  사건만 말한다(README §6)
- 시안 02의 `확인 평균시간 2분`은 **그리지 않는다.** 실측이 없다
- ⚠️ **README §6은 `tel:` 버튼을 요구하는데 서버는 불리언만 준다.** 지금은 서버가
  지원하는 `관리사무소에 알리기`(POST)를 그린다. `tel:`로 가려면 임계를 넘긴 세션에만
  사무소 이름과 번호를 내려줘야 한다. **차주 전화번호가 아니라 사무소 대표번호다** —
  번호는 `href`에만 넣고 화면에 인쇄하지 않는다

### B-6 만료

`EXPIRED`·`CANCELLED`면 사유 한 줄과 다시 스캔 안내만 남긴다. **재시도 버튼을 두지
않는다** — 상태가 바뀌어야 풀린다.

## [C] 차주 탭 (`/{locale}/owner`, `/owner/alert`, `/owner/history`, `/owner/settings`)

구현: `apps/web/components/owner-tab-shell.tsx`, `owner-tab-views.tsx`
정본: `pwa/README.md` §3

**하단 탭은 차주 화면의 것이다.** 시안 4장 모두에 그려져 있지만 호출자는 무회원이고
`apps/web/policies/route-policy.ts`가 `publicCaller`에 `bottomNavigation: "hidden"`을
못박고 있다.

**어느 탭에도 전화번호를 그리지 않는다**(운영자 확정 2026-07-24).

### C-1 MESSAGES

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 진행 중인 호출 목록 | **신규** — 차주 세션으로 여는 목록 엔드포인트 | 빈 상태만 보여준다 |

지금은 알림톡 링크로 응답 화면(`/respond/{token}`)에 바로 들어간다. 목록이 없어서
**동시에 여러 호출이 왔을 때 쌓아 보여줄 수 없다**(README §3: 오래된 것이 위).

### C-3 ALERT

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 알림톡 채널 상태 | **신규** — 차단 여부를 서버가 알 수 있으면 | **`상태 확인 불가`.** "연결됨"을 확인 없이 쓰지 않는다(README §3) |
| Web Push 구독 | **신규** | 버튼을 비활성으로 둔다 |

### C-4 HISTORY

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 시각 · 요청 유형 · 결과 · 응답까지 걸린 시간 | **신규** | 빈 상태만 보여준다 |

**결과가 없으면 `—`.** 미응답을 0분으로 쓰지 않는다. 본문이 만료되면 유형만 남는다.

### C-5 SETTINGS · C-6 확인

| 필드 | 출처 | 없을 때 |
|---|---|---|
| `plateLast4` · `qrStatus` | `list_owner_vehicles` | `—` |
| 연락처 | **내려주지 않는다.** `인증 완료`만 표시 | — |
| `siteDisplayName` | **신규** — 목록 응답에 사이트명 추가 | 관리 현장 행을 그리지 않는다 |
| 중지 / 해지 실행 | **신규** — 두 엔드포인트 | 확인 화면의 `확인` 버튼이 비활성 |

- **중지와 해지를 같은 무게로 그리지 않는다.** 중지는 secondary, 해지만 danger
- **상태를 못 불러왔으면 중지·해지를 아예 제안하지 않는다.** 불러오지 못한 대상에
  조치를 권하는 것보다 다시 시도하게 하는 편이 낫다
- 해지 확인 화면이 **과거 기록은 감사 목적으로 남는다**고 미리 말한다

### C-2 차주 응답 (`/{locale}/respond/{responseToken}`)

구현: `apps/web/components/owner-response-view.tsx` · 정본: `03-owner-reply.png`

| 필드 | 출처 | 없을 때 |
|---|---|---|
| `callerMessage` · `vehiclePlateLast4` | `owner-response/inspect` | 해당 카드를 그리지 않는다 |
| 답장 코드 목록 | 카피 카탈로그 `replies` | — |

- 알림 링크로 여는 **1회용 토큰** 화면이다. 세션이 없으므로 **하단 탭을 그리지 않는다**
- 만료·사용됨은 사유 한 줄만 보여주고 재시도 버튼을 두지 않는다

## 사이트 운영 (`/admin/sites/{siteId}`)

구현: `apps/web/components/site-workspace-view.tsx` · 정본: `console-site-operations.html`
지시서: `docs/development/workorder-codex-site-operations-0724.md`

**입고는 이 사이트가 한다.** 슈퍼어드민은 제작·발주·배송까지, 입고(수령)는 받는 사이트가.

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 라이프사이클 카운트 (재고·배정·활성·예외) | `qr_assets` status | **0이 아니라 `—`**(§4) |
| 입고 대기 배치 (수량·배송 상태·도착) | **신규** — 배송 추적 | 빈 상태 |
| `입고 확인` → `IN_STOCK` 전이 | **신규** `POST .../batches/{id}/receive` | 없으면 입고 불가 |
| 입고 완료 이력 | 입고 감사 로그 | 빈 상태 |
| 디자인 보관 버전 | 기존 `sticker_designs`(§7-3) | 빈 상태 |

- **입고 확인은 위자드가 아니라 이 화면에서만** 자산을 `IN_STOCK`으로 전이시킨다
- 부분 입고(받은 수량이 다름)를 기록할 수 있어야 한다
- 보관해도 과거 발주 이력은 남긴다

---

# 관리자 콘솔 · 플랫폼 화면

정본: `reference-1-admin-console.png` + `console-pages.html`·`console-detail.html`.
컬럼이 정본에 있는 화면은 그 컬럼을, 없는 화면은 `DESIGN_SYSTEM.md` §3 목록/상세 패턴을
근거로 선언한다(완료조건 1: 시안이 없으면 패턴 조합 명시). **모든 지표는 값이 없으면 `0`이
아니라 `—`**(§4). 목록은 **테넌트 격리·역할 범위를 서버가 적용**한 결과만 받는다
(프론트 필터 금지, `AGENTS.md`).

### 운영 목록 공통 데이터 경계

- 관리회사·사이트·지표 read model은 `is_test_fixture = false`를 서버에서 적용한다.
- fixture 제외 전후의 목록과 지표 분모가 달라지지 않도록 같은 행 집합에서 집계한다.
- 화면은 이름 패턴으로 fixture를 추측하지 않는다.
- 주 표시값은 등록된 관리회사명·사이트명이다. 내부 ID나 관리코드는 별도 보조 필드로만 쓴다.

## 콘솔 대시보드 (`/admin/dashboard`)
정본: `console-pages.html` "플랫폼 운영 현황". 스펙: `GET /api/v1/admin/dashboard`.

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 지표 스트립 (요청·응답률·미해결·알림비용 등) | `admin/dashboard` | 각 셀 `—`. 분모 0을 1로 바꾸지 않는다 |
| 연락 요청 추이(기간별 시계열) | `admin/dashboard` → 시계열 | 그래프 영역 빈 상태 |
| 조치가 필요한 항목(미응답·에스컬레이션) | `admin/dashboard` → attention[] | 빈 상태("지금 조치할 항목이 없습니다") |

> **승인 대기 큐(요청→승인)는 보류**(운영자 확정 2026-07-25). 레퍼런스1 우측 레일의
> "새 사이트 요청 / 계약 변경 · 거절·승인"은 **§11 해제 전까지 미표시/비활성.** 사이트 등록은
> 슈퍼어드민 직접만. 레일 자리(폭·구조)는 유지하되 큐 내용은 그리지 않는다.

## 사이트 목록 (`/admin/sites`)
정본: `console-pages.html` "현장 목록". 스펙: `GET /api/v1/admin/sites`.

| 컬럼 | 출처 | 없을 때 |
|---|---|---|
| 현장명 · 관리회사 · 주소 | `admin/sites` 행 | 주소 없으면 그 셀 `—` |
| 계약 차량 · 활성 QR | `sites`/`qr_assets` 집계 | `—` |
| 브랜드(로고 유무) · 운영 상태 | `sites`·`brand_assets` | 상태 배지, 로고 없으면 이니셜 |
| 작업(상세·수정) | 라우팅 | — |

- test 데이터 픽스처는 **플래그로 기본 숨김**(이름 필터 금지, §7-C 확정). 신규 플래그 컬럼.

## 운영 모니터링 (`/admin/operations`)
정본: `console-pages.html` "연락 세션과 알림 전달". 스펙: `GET /api/v1/admin/contact-sessions`.

| 컬럼 | 출처 | 없을 때 |
|---|---|---|
| 세션 · 현장 · 사유 · 상태 · 경과 | `admin/contact-sessions` | 경과는 `elapsedSeconds`, 없으면 `—` |
| 작업(상세·닫기·차단) | `.../{id}/close`·`/block-caller` | 권한 없으면 비활성 |
| 알림 전달 상태(성공·실패·재시도) | `notification_deliveries` 집계 | `—` |

- **차주 전화번호를 어떤 열에도 그리지 않는다.** 사유·상태·경과만.

## 리포트 (`/admin/reports`)
정본: `console-pages.html` "기간별 운영 지표". 스펙: `GET /api/v1/admin/analytics/summary`.

| 컬럼 | 출처 | 없을 때 |
|---|---|---|
| 관리회사 · 현장 | 집계 그룹 | — |
| 요청 · 응답률 · 해결률 · 미해결 | `analytics/summary` | 각 `—`. 미응답을 0%로 만들지 않는다 |
| 추세(스파크라인) | 시계열 | 그리지 않는다 |
| 내려받기(CSV) | 집계 export | 데이터 없으면 버튼 비활성 |

## 매출·계약 (`/admin/platform/revenue`)
정본: `console-pages.html` "계약과 매출 전망". 스펙: `GET /api/v1/admin/management-companies`.

| 컬럼 | 출처 | 없을 때 |
|---|---|---|
| 관리회사 · 현장 수 · 상태 | `management_companies`·`contracts` | `—` |
| 플랜 · 월 금액 · 갱신일 | **신규 — 과금 정책 미확정(스펙 §0.3)** | **`—`. 목업 금액을 굽지 않는다.** 정책 확정 전까지 자리만 |
| 플랜 구성 | 신규 | 빈 상태 |

> 🟡 과금 가격은 **운영자 확정 대기**. 확정 전까지 화면은 정직하게 비운다.

## 계정 (`/admin/accounts`) · 권한 (`/admin/access`)
정본: `console-pages.html` "관리자 디렉터리" + "역할별 권한".

| 컬럼 | 출처 | 없을 때 |
|---|---|---|
| 관리자 · 역할 · 범위 · 상태 | `admin_profiles`·`admin_memberships` | — |
| 작업(초대·역할변경·비활성) | 관리 엔드포인트 | 권한 없으면 비활성 |
| 역할별 권한 매트릭스(권한 × SA·MA·SO·…) | `roles`(정적 RBAC, 스펙 §9.5) | 정적값이라 항상 채워짐 |

- **연락처·전화번호를 그리지 않는다.** 계정 식별은 이메일·이름까지.
- 승인 워크플로(요청→승인 UI)는 **신설 금지**(스펙 §11 해제 전) — 지금은 슈퍼어드민 직접만.

## 내 정보 (`/admin/profile`)
정본: `console-detail.html` 상세 패턴.

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 이름 · 이메일 · 역할 · 소속 범위 | 세션 → `admin_profiles` | `—` |
| 언어(KO/EN) | `admin_profiles`·로케일 | — |
| 비밀번호 변경 진입 | 인증 플로우 | — |

## 플랫폼 루트 (`/admin/platform`) · 테넌트 (`/admin/platform/tenants`)
정본: §3 목록 패턴(전용 컬럼 시안 없음 — 패턴 조합 명시).

| 컬럼 | 출처 | 없을 때 |
|---|---|---|
| 테넌트/관리회사 · 관리자 수 · 현장 수 · 계약 차량 · 상태 | 플랫폼 집계 | 각 `—` |
| 작업(상세·등록) | `POST /admin/management-companies` | 등록은 슈퍼어드민 직접만 |

- test 데이터 플래그 숨김 동일 적용. 사이트 등록도 **슈퍼어드민 직접만**(§4 확정).

## 관리회사 상세 (`/admin/platform/management-companies/[companyId]`)
정본: `console-detail.html` "관리회사 상세/관리". Daum 주소 입력 포함.

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 기본 정보(상호·주소·연락 담당) | `management_companies` | 각 `—` |
| 소속 현장 목록 | `sites` (이 회사 범위) | 빈 상태 |
| 계약·플랜(월 금액·갱신일) | **신규 — 과금 미확정** | `—` |
| 관리자 멤버십 | `admin_memberships` | 빈 상태 |

## 플랫폼 권한 (`/admin/platform/access`)
정본: §3 목록 + "역할별 권한" 매트릭스.

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 관리자 × 역할 × 범위(테넌트/회사/현장) | `admin_memberships`·`roles` | `—` |
| 역할 배정·회수 | 멤버십 엔드포인트 | 권한 없으면 비활성 |

## QR 재고 · 라이프사이클 (`/admin/qr-inventory`)
정본: `CONSOLE_DESIGN_SYSTEM_V2.md` §6. 현재 카드형 위자드 UI는 계승하지 않는다.
기능·권한·read model·다운로드 API는 유지하고, 화면은 YouTube Studio식 다크 기본·라이트
지원 운영 콘솔로 재구성한다. 스펙: `GET /api/v1/admin/qr-assets`.

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 운영 지표(회사·사이트·발행 묶음·생성 QR·활성화 대기·활성 QR) | QR operations read model | 값이 없으면 `—` |
| 관리회사·사이트 선택 목록 | QR operations read model | 빈 상태 |
| 확정한 범위(관리회사·사이트·주소) | QR operations read model | 주소는 `주소 미등록` |
| 직접 생성 수량 | 화면 입력 → direct generation service | `1`로 보정, 허용 범위 `1..10,000` |
| 서버 분할 계획 | direct generation policy | `100개 단위 묶음` 설명. 배치 크기는 서버 정책을 따른다 |
| 생성 진행률(generated·rendered·quality passed·failed) | QR operations read model + request tracking | 추적 요청이 없으면 진행률 없음 상태 |
| SVG 다운로드 상태 | QR SVG bundle API | 준비 전은 `준비 중`, 완료 후 다운로드 버튼 |
| 발행 묶음 테이블(batch code·회사·사이트·수량·진행·출력·상태·다운로드) | QR operations read model | 빈 상태 |

> 운영자 결정(2026-07-29): 어드민 직접 생성 수량 UI는 `1..10,000`을 지원한다. 서버는 큰 요청을
> 100개 단위 묶음으로 분할해 중복 없는 QR 생성 경로를 유지한다.

## 관리자 인증 상태 (`/admin/login`·`/admin/signup`)
정본: `admin-auth-*` + 공개 스케일. 폴리시: `workorder-codex-auth-states-0725.md`.

> MFA 화면과 MFA 등록/확인 여정은 MVP/파일럿 개발 범위에서 제외한다. 내부 `mfaLevel`
> 호환 필드는 사용자 화면 계약이 아니다.

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 로그인 오류 사유 (`invalidCredentials`·`session`·`configuration`·`unavailable`) | 로그인 서버 액션 결과 | 사유별 카피. **자격 오류는 어느 필드가 틀렸는지 알리지 않는다**(보안) |
| 가입 검증 오류 (`invalidEmail`·`invalidPassword`·`passwordMismatch`) | signup 결과 | 필드별 인라인 오류 |
| 제출 진행 상태(pending) | `useFormStatus`/`useTransition` | 없으면 즉시완료로 간주하지 않는다 — 버튼 `처리 중` |
| 인증 서비스 연결 여부 | `CONFIGURATION_MISSING`·`LOAD_ERROR` | **"로그인 준비 중" 노티스 + 폼 비활성.** 사유 없는 비활성 금지 |

- **오류 사유는 서버가 구분해 내려주고 화면은 사유별 카피로 그린다**(§0 상태 규칙:
  사유를 구분한다). 단 자격 오류는 이메일/비밀번호 중 무엇이 틀렸는지 노출하지 않는다.
- 인증 상태 화면 어디에도 시크릿(세션 토큰·비밀번호)을 그리거나 로그하지 않는다.
