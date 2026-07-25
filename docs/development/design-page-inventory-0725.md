# Taptolk 화면 전수 인벤토리 & Codex 준비 시트 — 2026-07-25

> 작성: Claude(디자인 레인). Codex 코딩 착수 전 준비 자료.
> 정본은 `DESIGN_SYSTEM.md` + `docs/design-canon/`. 계약은 `docs/design-canon/CONTRACTS.md`.
> 경계는 `docs/governance/OPERATING_MODEL.md`. 순서는 `PROJECT_COMPLETION_PLAN.md`.

## 상태 기호

| 기호 | 뜻 | 다음 행동 |
|---|---|---|
| ✅ | 디자인 완료 + 서버 배선 완료 | 유지·회귀만 |
| 🟡 | 디자인 완료, **서버 배선/폴리시 대기** | Codex 배선 |
| 🔴 | **차주/핵심 여정을 막음** — 배선 없으면 화면이 작동 안 함 | Codex 최우선 |
| 🟣 | 디자인 **부채(고도화)** — 작동하나 토큰 이탈 리터럴 다수 | Codex 토큰 이관 |
| ⚪ | **정본 눈대조 대기** — 로그인 게이트로 미검증(스텝 D 후) | Claude 대조 → 필요시 수정 |
| ◻️ | **디자인 미완성** — 정본/계약을 Claude가 더 만들어야 함 | Claude 먼저 |

---

## 1. 공개 · 인증 (랜딩/온보딩/로그인)

| 화면 | 라우트 | 정본 | 상태 | 필요한 것 |
|---|---|---|---|---|
| 랜딩 | `/` | (공개 타입스케일 `--tt-pub-*`) | 🟡🟣 | 캡션·배지 크기 정규화(토큰 매핑 완료, globals.css 적용은 Codex), 반응형 재확인 |
| 온보딩 | `/onboarding` | 공개 타입스케일 | 🟡🟣 | 위와 동일 |
| 로그인 | `/admin/login` | 공개 스케일 + `admin-auth-*` | ◻️🟡 | **카드 상태(로딩·오류·비활성) 폴리시 미완**(Claude), 그 후 배선 |
| 가입 | `/admin/signup` | `admin-auth-*` | ◻️🟡 | 상태 폴리시 미완(Claude) |
| MFA 등록 | `/admin/mfa/enroll` | `admin-auth-*` | ◻️🟡 | 상태 폴리시 미완(Claude) |
| MFA 확인 | `/admin/mfa/challenge` | `admin-auth-*` | ◻️🟡 | 상태 폴리시 미완(Claude) |

---

## 2. 모바일 PWA — 호출자(B) · 차주(A/R/C)

정본: `docs/design-canon/pwa/` (README + 시안 4장). 계약: `CONTRACTS.md`.

| 화면 | 라우트 | 상태 | 필요한 것 (계약 근거) |
|---|---|---|---|
| 스캔 진입 | `/q/[publicToken]` | 🟡 | **신규 RPC** — 이 세션이 이 자산의 것인지 판정(쿠키만으로 [C] 금지) |
| [A] 활성화 A-1~A-4 | `/activate/[publicToken]` | 🔴 | **`complete`에서 `activationCode` 제거**(없으면 400). `sites.address`·`siteType`·`expiresInSeconds` 신규. 재진입 상태 복귀 |
| [R] 재진입 | `/q/[publicToken]/owner` | 🔴 | **엔드포인트 2개**(`reclaim/request-otp`·`reclaim/verify`). 차량+전화 둘 다 일치 시에만, 시도 제한 |
| [B] 작성 | `/q/[publicToken]` | 🟡 | 차량번호 last4·사이트명·멘트 목록. `연락 부탁드립니다` 코드 추가는 운영자 확정 |
| [B] 대기·에스컬·응답 | `/c/[sessionToken]` | 🟡 | **세션 필드 신규**: `plateLast4`·`callerMessage`·`createdAt`·`elapsedSeconds`·`callerMessagesRemaining`. `tel:`은 사무소 대표번호만 href |
| [C-1] MESSAGES | `/owner` | 🟡 | 진행 중 호출 목록 엔드포인트(신규). 없으면 빈 상태 |
| 메시지 스레드 | `/owner/messages/[sessionId]` | 🟡 | C-1 목록과 동일 소스 |
| [C-3] ALERT | `/owner/alert` | 🟡 | 알림톡 채널 상태·Web Push 구독(신규). 미확인은 `상태 확인 불가` |
| [C-4] HISTORY | `/owner/history` | 🟡 | 지난 호출 엔드포인트(신규). 결과 없으면 `—` |
| [C-5/6] SETTINGS·확인 | `/owner/settings` | 🟡 | 중지/해지 실행 엔드포인트 2개(신규). `siteDisplayName` 추가 |
| [C-2] 차주 응답 | `/respond/[responseToken]` | ✅ | 1회용 토큰 화면. 유지 |
| 오프라인 | `/owner/offline` | 🔴 | **로컬 dev 500 버그(owner/offline JSON)** — Codex 수정 최우선 |
| [E] 사용불가 스티커 | (스캔 분기) | ✅ | 사유만, 사이트 비노출. 유지 |

> 🔴 두 건(**활성화코드 제거·재진입 2개**)이 차주 여정 전체를 막는다 → Codex 1순위.

---

## 3. 관리자 콘솔 — 고객 관리자

정본: `reference-1-admin-console.png` + `console-shell.html`·`console-pages.html`·`console-detail.html`.
**대부분 화면별 CONTRACTS 행이 아직 없다(◻️ 표시 = Claude가 계약 먼저 써야 함).**

| 화면 | 라우트 | 정본 | 상태 | 필요한 것 |
|---|---|---|---|---|
| 대시보드 | `/admin/dashboard` | reference-1 | ⚪🟣 | 정본 눈대조(스텝 D). 부채: `admin-dashboard-shell`·`admin-overview-*` |
| 운영 대시보드 | `/admin/operations` | reference-1 | ⚪🟣 | **부채 27건(operations-*)**. Codex가 현재 편집 중 → 토큰 이관 병행 |
| 사이트 목록 | `/admin/sites` | console-pages | ⚪ | 정본 눈대조 |
| 사이트 운영(상세) | `/admin/sites/[siteId]` | **console-site-operations** | 🟡 | 입고 엔드포인트(`POST .../batches/{id}/receive`)+배송추적. 부분입고 기록 |
| QR 재고 + 위자드 | `/admin/qr-inventory` | console-qr-wizard | 🔴🟣 | **6단계 위자드 데이터·라우팅**(현재 옛 5단계). 샘플 RPC. **부채 qr-quantity 26·qr-* 29** |
| 계정 | `/admin/accounts` | console-pages | ◻️⚪ | 계약 미작성(Claude). 정본 대조 |
| 권한 | `/admin/access` | console-pages | ◻️⚪ | 계약 미작성(Claude) |
| 리포트 | `/admin/reports` | console-pages | ◻️⚪🟣 | 계약 미작성. 부채 `admin-report-*` |
| 내 정보 | `/admin/profile` | console-detail | ⚪🟣 | 부채 `admin-profile-panel` 6건 |
| 관리자 루트 | `/admin` | (라우팅) | ✅ | 역할별 리다이렉트 유틸 |

---

## 4. 슈퍼어드민 — 플랫폼

정본: reference-1 + console-pages/detail. **화면별 계약 대부분 미작성(◻️).**

| 화면 | 라우트 | 상태 | 필요한 것 |
|---|---|---|---|
| 플랫폼 루트 | `/admin/platform` | ◻️⚪ | 계약 미작성. 정본 대조 |
| 테넌트 | `/admin/platform/tenants` | ◻️⚪ | 계약 미작성. test 데이터 플래그 숨김 |
| 관리회사 목록 | `/admin/platform/management-companies` | ⚪🟣 | 부채 `admin-catalog-decision` 14·`admin-company-identity` 6. test 픽스처 숨김 |
| 관리회사 상세 | `.../management-companies/[companyId]` | ◻️⚪ | 계약 미작성. console-detail 대조 |
| 매출 | `/admin/platform/revenue` | ⚪🟣 | 부채 `admin-revenue-*`·`admin-report-*` |
| 플랫폼 권한 | `/admin/platform/access` | ◻️⚪ | 계약 미작성 |

> **QR 위자드는 "슈퍼어드민 전용"으로 확정**됐는데 현재 라우트는 `/admin/qr-inventory`
> (고객 콘솔 영역)에 있다. 스코프가 맞는지 **정본 대조 시 확인 필요**(§6 결정 대기).

---

## 5. 요약 — 분류별 집계

- 🔴 **막힌 것(6):** 활성화코드 제거, 재진입 2개, owner/offline 500, 6단계 위자드, 사이트 입고, (샘플 RPC).
- 🟡 **디자인 완료·배선 대기(≈12):** PWA 세션 필드·목록/이력/채널/중지해지 엔드포인트, 공개·인증 폴리시 적용.
- 🟣 **고도화(부채 이관) 대상 — 부채 많은 순:**
  1. `qr-quantity`(26) + `qr-*`(29) → QR 재고·위자드
  2. `operations-*`(27) → 운영 대시보드
  3. `admin-catalog-decision`(14) → 관리회사 목록
  4. `admin-console-account`(8)·`admin-dashboard-shell`(7)·`admin-company-identity`(6)·`admin-overview-attention`(6)·`admin-profile-panel`(6)
  - 전체 301건 = font-size 162 · padding 91 · border-radius 29. **전부 토큰으로 이관 가능.**
- ⚪ **정본 눈대조 대기(로그인 필요, 스텝 D):** 콘솔·플랫폼 대부분.
- ◻️ **디자인 미완성(Claude 먼저):** 로그인/가입/MFA 상태 폴리시, 콘솔·플랫폼 다수의 **화면별 계약 미작성**.

---

## 6. 준비 상태 — 지금 넘길 수 있는 것 vs 아직 내 몫

### Codex가 지금 착수 가능 (디자인·계약 준비됨)
- PWA 전체(§2): 정본 README + 시안 + CONTRACTS.md 완비. 🔴/🟡 배선 목록이 계약에 명시됨.
- 사이트 운영(§3): console-site-operations.html + 계약 + 워크오더 완비.
- QR 위자드 6단계(§3): console-qr-wizard.html + 워크오더 완비.
- 고도화(§5 🟣): 토큰 이관은 정본 변경 없이 가능 — baseline 감축 대상이 명확.

### 아직 Claude가 준비해야 함 (넘기기 전 선행)
1. **로그인·가입·MFA 카드 상태 폴리시**(◻️) — 로딩·오류·비활성 스펙 마감.
2. **콘솔·플랫폼 화면별 계약(CONTRACTS.md 행)** — 계정·권한·리포트·플랫폼 루트·테넌트·
   관리회사 상세·플랫폼 권한. 지금은 reference-1 시각언어만 있고 "서버가 줘야 하는 것"이
   화면별로 안 적혀 있어 Design-Ready 6조건 미충족.
3. **⚪ 정본 눈대조**는 스텝 D(스테이징 로그인) 후 Claude가 수행 — 그 전엔 "완료" 선언 금지.

---

## 7. Codex 권장 착수 순서

1. **스텝 A** — `owner/offline` 500 수정(§2), 워킹트리 분리(`OPERATING_MODEL` §6).
2. **🔴 차주 여정** — 활성화코드 제거 → 재진입 2개 → 스캔 판정 RPC(§2).
3. **🟡 PWA 배선** — 세션 필드 → owner 목록/이력/채널/중지해지(§2).
4. **사이트 운영·위자드** — 입고 엔드포인트, 6단계 위자드(§3).
5. **🟣 고도화(토큰 이관)** — 부채 많은 순(§5). 이관 후 `--update-baseline`.
6. 각 단계 후 `validate:design-system`·`validate:wcj`·`verify`, 스펙 §31 형식 보고, PR→리뷰.

> Claude는 6번과 병행해 §6-2(콘솔 계약)와 §6-1(인증 상태 폴리시)을 마감한다.
