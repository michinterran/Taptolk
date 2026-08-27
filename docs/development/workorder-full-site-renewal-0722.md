# Taptolk 전체 사이트 리뉴얼 개발 지시서 (Codex 단독 실행용) — 2026-07-22

> 작성: Claude. 실행: Codex. 브랜치: `codex/phase-1-foundation`.
> Claude가 사용자와 함께 관리자·공개 화면 디자인 시스템을 확정하고 **브라우저에서 검증**했다.
> 이 문서 + 프로토타입 4종이 **구현 기준(source of truth)**이다. Codex는 이를 실제 앱 코드로 이식한다.
> **재발명·임의 재해석 금지.** 프로토타입과 다른 결정을 하려면 먼저 사용자에게 확인한다.

---

## 0. 읽는 순서

1. `AGENTS.md`, `CLAUDE.md` — 엔지니어링 계약
2. **이 문서**
3. `docs/development/design-system-reference-0722.md` — 디자인 시스템 기준
4. `docs/development/workorder-p1-design-system-0722.md` — P1 프리미티브 상세
5. `docs/development/workorder-admin-design-system-and-metrics-0722.md` — 프로그램 로드맵·제품 정의
6. **프로토타입 4종을 브라우저로 직접 열어볼 것** (§2)

---

## 1. 목표

`레퍼런스1`(관리자 대시보드 목업) 수준의 디자인 시스템을 **전 관리자 화면 + 공개 랜딩/로그인**에 일관 적용한다.
지금 문제는 디자인 시스템이 없는 게 아니라 **얇고 흩어져 있다는 것**이다:

- 공유 토큰은 `packages/ui/src/styles/tokens.css` (Claude가 확장 완료)
- 공유 컴포넌트는 `packages/ui`에 3개뿐 (Button / SemanticHeading / JourneyStatus)
- `apps/web/app/globals.css` **5,555줄에 `admin-*` 클래스 214개**가 화면별로 증식 ← 화면 불일치의 근본 원인

**따라서 이 작업은 "화면별 CSS 추가"가 아니라 "공유 프리미티브로 수렴"이다.**

---

## 2. Source of truth — 프로토타입 4종 (반드시 직접 열어볼 것)

`corepack pnpm --filter @taptolk/web dev` 후:

| URL | 화면 |
|---|---|
| `/_design-prototype-pages.html` | 대시보드 · 사이트 관리 · 운영 모니터링 · 리포트 · 매출 관리 · 계정·권한 (사이드바로 전환) |
| `/_design-prototype.html` | 고객관리(관리회사 목록) + 전체 셸 + **범위 전환기** |
| `/_design-prototype-detail.html` | 관리회사 상세 (수정 폼 + **Daum 우편번호 주소검색**) |
| `/_design-prototype-qr-wizard.html` | **QR 제작 위자드 6단계** (실제 엔진 렌더 미리보기 + 수량 UX) |

프로토타입 스티커 이미지: `apps/web/public/_proto/*.png` — **실제 `renderSticker()` 출력**이다(디코드 검증 통과분).

> ⚠️ 프로토타입과 `_proto/`는 **참조 전용 정적 파일**이다. 앱 라우트가 아니며, 이식이 끝나면
> `apps/web/public/`에서 **제거**한다. Production 배포에 절대 포함하지 않는다.

---

## 3. 이미 실제 코드로 반영된 것 (이어서 쓸 것 · 되돌리지 말 것)

### 3.1 `packages/ui/src/styles/tokens.css` — 확장 완료 (커밋됨, WCJ PASS)
기존 26토큰 **이름 불변**(214 클래스 의존). 추가된 것:
- `--tt-space-8` (기존에 globals가 참조하는데 미정의였던 버그 수정)
- 타입 스케일 `--tt-font-size-xs~3xl`, `--tt-font-weight-regular~bold`, `--tt-line-tight`
- 표면/보더 `--tt-color-surface-subtle|muted`, `--tt-color-border-strong`
- `--tt-color-info`
- **상태 틴트 쌍** `--tt-color-{brand|success|warning|danger|info|neutral}-{surface|fg}`
- elevation `--tt-shadow-sm|md` (기존 `--tt-shadow-card` 유지)
- `--tt-radius-xs`, `--tt-radius-pill`, `--tt-focus-ring`, `--tt-z-{sidebar|dropdown|modal|toast}`

### 3.2 `packages/qr-engine/src/render.ts` — 홀로그램 템플릿 구현 완료
`ROUND_BLUE_HOLOGRAM_V1`이 이름대로 **이리데선트 패싯 홀로그램 면**을 렌더한다(이전엔 단색 평면).
- 템플릿에 `pattern: "HOLOGRAM" | "GRADIENT" | "FLAT"` 추가
- `backgroundDefs()` / `backgroundMarkup()` / `HOLOGRAM_FACETS` 신설
- **패싯은 중앙 흰 QR 패널 바깥에만** 배치 → QR 대비 불변
- 템플릿 코드 4종 세트·흰 패널(230,245,540×540)·taptolk 마크(300,840,400×90) 좌표 **불변** (DB CHECK 제약과 테스트 계약)
- `render.test.ts`에 홀로그램 디코드 테스트 추가 — **13 tests PASS**, typecheck 19/19

> 실물 홀로그램·돔 광택은 **인쇄 소재** 속성이다. 아트워크는 운영자 미리보기가 실물과 일치하도록 근사한다.

---

## 4. 확정 결정 (전부 준수 · 임의 변경 금지)

1. **브랜드/CI 원본 유지·재해석 금지.** 로고는 `/brand/taptolk-logo.png` **원본 이미지 그대로**.
   텍스트 치환·재도안·재색·크롭·필터 **금지**(SHA-256 불변). 브랜드 퍼플/오렌지 원본 유지.
   고도화는 **레이아웃·밀도·컴포넌트·지표 컬럼에만** 적용.
2. **관리사명은 목록에 실제 이름으로 표시.** 코드형 문자열을 이름 자리에 노출하지 않는다.
   **관리코드(`management_code`)는 `name`과 별개 필드**로 신설하고 **상세(관리)페이지에서만** 표시·관리.
3. **상세페이지 수정 기능** + **주소 필드**. 주소검색은 **Daum(카카오) 우편번호 서비스**:
   무료·API키/시크릿 불필요·클라이언트. **반드시 `embed` 모드**(팝업 `.open()`은 팝업차단됨 — 검증됨).
   **좌표 저장하지 않고 도로명/지번 주소 문자열만** 저장. 스크립트 로드 실패 시 수동 입력 폴백.
4. **미니멀 라인 아이콘**(stroke SVG 1.6 / 기존 Phosphor 라인). **이모지 금지.**
5. **범위 전환기(Scope switcher, 슈퍼어드민 전용)** — 상단 스코프 칩을 드롭다운으로:
   **전체 플랫폼 / 특정 관리회사 / 특정 사이트** 선택 → 그 범위 대시보드로 전환·확인·관리·수정.
   - persona/역할 가장(SERVICE 금지)이 **아니다.** 슈퍼어드민 본인 권한을 하위로 **좁히는** 것.
   - 서버가 범위 인가 + RLS 유지 + **감사에 실제 actor + 선택 범위** 기록. 프론트 전환만으로 권한 생기지 않음.
   - 하위 역할은 스코프 고정, 전환기 미노출.
   - 기존 `management-company-workspace-view` / `site-workspace-view`를 드릴다운 대상으로 재사용.
6. **용어: `건강 상태` → `리스크 등급` / `Risk level`** (값: 위험·주의·양호·보통).
   요약 타일 `건강한 고객` → **`저위험 고객`**. KO/EN dictionary 동시 반영.
7. **QR 제작 위자드는 6단계 유지** (기존 구현 구조 보존, 재검증 리스크 회피).
   효율은 단계 수가 아니라 **각 단계 내부 UX**에서 확보한다.
8. **현실적 합성 데모 시드** 추가 — 목록이 레퍼런스처럼 실제 이름으로 보이게.
   가상의 관리회사·현장·주소·지표. **E2E 결정적 픽스처는 절대 건드리지 않는다**(별도 시드).

---

## 5. 디자인 시스템 규격 (프로토타입 실측 기준)

### 5.1 `packages/ui` 프리미티브 (신설 — 프로토타입 CSS를 정식화)
`Sidebar` · `TopBar`(+`ScopeSwitcher`) · `PageHeader` · `StatTile`/`StatStrip` · `FilterBar` ·
`DataTable` · `Badge` · `StatusPill` · `MeterBar` · `Pagination` · `SideCard` · `EmptyState` ·
`Footer` · `AuthCard` · `AddressField`(Daum embed) · `Stepper` · `Button` 확장(variant/size).

규칙: 순수 UI(DB·Provider·server import 금지), **문구는 props**(타입 KO/EN dictionary 소비, 컴포넌트에 카피 하드코딩 금지),
접근성(role/aria/키보드), 상태(loading/empty/disabled/forbidden).

### 5.2 레이아웃 실측값
- **사이드바** 236px, sticky, 로고 6.9rem, 그룹 라벨 `.64rem/700/uppercase`,
  항목 `.83rem/600` + 아이콘 18px, **활성 = `brand-surface` 배경 + `inset 2px brand-strong`**
- **상단바** sticky, `backdrop-filter:blur(12px)`, 좌: 범위 전환기 / 우: KO·ENG 토글, 날짜+실시간 배지, 계정
- **본문** `max-width:1280px`, padding `1.5rem`
- **PageHeader** eyebrow(`brand-strong .78rem/700`) + h2(`1.5rem`, SemanticHeading) + desc(muted, `max 64ch`) + 우측 액션
- **StatStrip** `grid-template-columns:repeat(6|4,1fr)`, `gap:1px` + border 배경(구분선 효과), radius-md
  - 타일: 아이콘 배지 2.1rem/radius-xs, 라벨 `.76rem/600 muted`, 값 `1.55rem/700 tabular-nums`, 보조 `.72rem`
  - tone: `ok|warn|bad` → 아이콘 배지·보조문구 색상 전환
- **Panel** radius-md + border + shadow-sm, head(제목+설명) / filters(`surface-subtle` 배경) / body
- **Table** 헤더 `surface-subtle .72rem muted nowrap`, 셀 `.8rem nowrap`, hover `surface-subtle`,
  **`.tscroll{overflow-x:auto}` 래퍼 + `table{min-width:760~900px}`** (가로 overflow 방지)
- **Pagination** 번호형 + 이전/다음 + 페이지당 개수
- **차트(CSS)** — ⚠️ 함정: 막대 컨테이너를 `display:grid; align-content:end`로 하면 자식 `height:%`가
  해석되지 않는다. **반드시 `display:flex; flex-direction:column; justify-content:flex-end`** 사용.

### 5.3 상태 색 규칙
`양호/정상/응답완료 = success` · `주의/대기/일시중지 = warning` · `위험/미응답/실패 = danger` ·
`정보/신규 = info` · `종료/만료 = neutral`. pill은 좌측 점(`::before`) + 틴트 배경.

---

## 6. 화면별 구현 지시

각 화면은 **프로토타입을 열어 대조**하며 이식한다. 데이터는 §7 전까지 **가진 것만 정직하게** 렌더하고,
없는 값은 지어내지 말고 `—`/빈 상태로 둔다.

### 6.1 공통 셸 (최우선)
`apps/web/components/admin-page-header.tsx`가 사이드바+상단바를 렌더한다(구조는 이미 프로토타입과 유사).
→ 프리미티브로 리팩터 + §5.2 규격 적용 + **범위 전환기 추가** + 로고 원본 유지.
모든 관리자 화면이 즉시 동일한 chrome을 갖는다.

### 6.2 대시보드 (`/{locale}/admin/platform`, `/admin/dashboard`)
6지표 스트립(관리회사·관리현장·활성QR·오늘 연락요청·미해결·발송실패) + 연락 요청 추이 차트 +
**조치 필요 큐**(발송실패·미응답 에스컬레이션·승인대기·신고). 기존 operations aggregate 재사용.

### 6.3 고객관리 = 관리회사 목록 (`/{locale}/admin/platform/management-companies`)
`_design-prototype.html` 대조. 요약 타일 + 필터바 + 테이블 + 번호형 페이지네이션 + 우측 큐.
- 테이블 컬럼: 관리사명(+배지) · 사이트 · 플랜/상태 · 차량 용량 사용률(미터) · QR 활성화율 ·
  응답 품질 · 미해결 · 계약 만료일(D-day) · **리스크 등급** · 작업
- **§7 스키마 전에는 없는 컬럼을 렌더하지 않는다.** 가진 것(이름·사이트수·계약차량한도·활성QR·상태·생성일)만.
- 우측 큐는 **현재 정직한 상태검토**(정지/종료)만. 승인 워크플로 흉내 금지.

### 6.4 관리회사 상세 (`.../management-companies/[companyId]`)
`_design-prototype-detail.html` 대조. 헤더(이름 + **관리코드 칩** + 리스크 pill) +
**기본 정보 수정 폼**(관리사명 · 관리코드 · 사업자등록번호 · **우편번호/주소/상세주소 + 주소 검색**) + 저장.
주소검색은 §4-3 규칙(Daum embed).

### 6.5 사이트 관리 / 사이트 상세
`_design-prototype-pages.html?p=sites` 대조. 현장 목록(현장명+관리코드 · 관리회사 · **주소** ·
계약차량 · 활성QR · **브랜드 등록 여부 배지** · 운영상태 · 작업) + `브랜드 미등록 N` 지표.
사이트 상세도 관리회사 상세와 동일 패턴(수정 + 주소검색 + 관리코드).

### 6.6 QR 제작 위자드 (`/{locale}/admin/qr-inventory`) — 6단계 유지
`_design-prototype-qr-wizard.html` 대조. 스테퍼(완료=✓/현재=brand/예정=neutral) + 좌 패널 + **우측 실시간 미리보기 레일**.

1. **현장 선택** — 검색 + 최근 사용 + 주소 표시 + **등록 브랜드 여부 배지**.
   상단 범위가 특정 현장이면 **자동 선택·스킵**.
2. **템플릿 선택** — 4종 카드, **미리보기는 실제 `renderSticker()` 렌더**(목업 금지). 마지막 사용 템플릿 기본 선택.
3. **브랜드 적용** — 상단 슬롯 = **현장 브랜드**. 우선순위: ①현장 등록 브랜드 자동 적용(기본)
   ②새 로고 업로드(PNG/SVG, 용량 제한, SVG sanitize, **사용권 보유 확인**) ③**없으면 상단 비움**.
   ⚠️ **taptolk 로고를 상단 슬롯 기본값으로 쓰지 않는다**(하단에 이미 항상 들어가므로 중복).
4. **수량 입력** — §6.6.1 상세
5. **검토·승인** — 실제 렌더 샘플 + **디코드 검증 통과 표시** + 인쇄 사양(85mm·300dpi) +
   **QR 호스트 표시** + 승인자 확인 → 승인(감사 기록)
6. **제작·입고** — 생성 진행률(배치별·실패·재시도) + 산출물(PDF/SVG ZIP/CSV/manifest) +
   인쇄→배송→수령→**재고 입고** 추적

#### 6.6.1 수량 단계 UX (반드시 이대로)
- **큰 수치 컨트롤**: `2.9rem/700 tabular-nums` + 원형 −/+ 버튼(10단위)
- **슬라이더 범위는 계약 규모에서 파생**: `max = ceil(계약차량한도 × 1.5 / 10) × 10`.
  **입력이 그보다 크면 슬라이더 max를 `ceil(total/100)×100`로 확장**해 슬라이더가 항상 실제 값을 표시.
  (❗ 고정 상한 금지 — 이전에 1,000 고정으로 "입력 2,000 / 슬라이더 1,000" 불일치 버그가 있었다)
- 눈금에 **`계약 규모 N` 마커** 표시
- **권장 수량 버튼**: `권장 = max(0, 계약차량한도 − 미배정 재고)`, 근거 문구 `계약 N대 − 미배정 재고 M개` 병기
- **프리셋도 계약 기반**: `100` · `계약 규모 N` · `계약 ×2` (권장값과 중복 제거)
- **배치 구성 시각화**: 세그먼트 바. 꽉 찬 배치=브랜드 그라디언트, **부분 배치=점선 info**,
  9개 이상이면 `…×N`으로 접기
- **원클릭 스냅 힌트**: 나머지 r>0일 때 `−r → k개 배치로 딱 맞추기` / `+(100−r) → 마지막 배치 100개 채우기`.
  딱 떨어지면 `✓ 모든 배치가 100개로 꽉 찹니다`
- **통계**: 배치 수 · 배치당 최대(100) · 마지막 배치 · 예상 생성 시간
- **초과 경고(차단 아님)**: `계약 N대를 M개 초과합니다. 초과 발주가 맞는지 확인하세요.`
  재고 합산 시 계약을 채우면 info 톤으로 안내
- **맥락 행**: 계약 차량 규모 · 미배정 재고 · 최근 발주 (전부 기존 데이터에서 파생 — 새 스키마 불필요)
- **per-Batch 1..100은 불변 계약**. 총수량은 100 이하 자식 배치로 원자 분할. 숨기지 말고 시각화로 설명.

#### 6.6.2 동적 QR / 호스트 게이트 (중요)
QR은 `PUBLIC_QR_BASE_URL + /q/{token}`을 인코딩하고 **서버가 토큰을 해석해 상태로 분기**한다
(미배정→활성화 / 활성→연락요청 / 정지·교체·폐기→fail-closed).
→ **재배정·차주변경·교체는 재인쇄 없이 처리된다(동적).**
그러나 **호스트는 QR 이미지에 구워진다 → 인쇄 후 변경 불가.**
- 승인 화면에 **사용할 QR 호스트를 명시 표시**
- **canonical 호스트 미확정 시 실인쇄용 생성은 fail-closed로 차단**(경고만으로 부족)
- 현재: `taptolk.com` 확보했으나 DNS 미연결 + apex vs www 미결정 → **사용자 결정 대기 항목**

### 6.7 운영 모니터링 (`/{locale}/admin/operations`)
지표 6종(연락요청·응답률·평균응답·미응답·에스컬레이션·발송실패) + **진행 중 세션 테이블** +
**알림 전달 상태** 카드.
- ⚠️ 세션 테이블에 **개인정보를 표시하지 않는다** — 세션 식별자·현장·사유·상태·경과만
- ⚠️ 알림은 **Provider 접수 기준**으로 표기. 낙관적 성공 표시 금지. 재시도/최종실패 분리

### 6.8 리포트 (`/{locale}/admin/reports`)
기간·관리회사·현장 필터 + 추이 차트 + 관리회사별 비교 테이블(요청·응답률·해결률·미해결·추세) + CSV 내보내기.

### 6.9 매출 관리 (`/{locale}/admin/platform/revenue`)
MRR·계약중·갱신임박·만료 타일 + 관리회사별 계약(플랜·현장수·월금액·갱신 D-day·상태) + 플랜 구성 미터.
**전망은 버전 기록**(예: `전망 v12 · 산정일`) 표기 유지.

### 6.10 계정·권한 (`/{locale}/admin/accounts`)
관리자 디렉터리(관리자·역할·범위·MFA·상태·작업) + 승인 대기 + **역할별 권한 매트릭스**.
문구 유지: *"화면 숨김은 권한이 아닙니다. RBAC와 RLS를 모두 통과해야 합니다."*,
*"승인만으로 권한이 생기지 않으며 서버가 역할·범위를 다시 확인합니다."*

### 6.11 공개 랜딩 · 관리자 로그인 (⚠️ 프로토타입 미작성 — Codex가 같은 시스템으로 설계)
사용자 지시: **랜딩·로그인도 같은 디자인 시스템으로 맞춘다.**
- 확장된 토큰 + 공유 프리미티브(Button/SemanticHeading/AuthCard/Footer) 사용
- **공개 표면 제약 유지**: 관리자 링크 **0개**, 전역 noindex·sitemap 제외,
  canonical 단일 `/{locale}/admin/login` 진입, WCJ 규칙 `J005` 준수
- 랜딩은 기존 카피·구조를 보존하고 **타이포·간격·컴포넌트만** 디자인 시스템으로 정렬
- 로그인은 기존 `admin-auth-*` 클래스를 `AuthCard` 프리미티브로 수렴
- 로고는 원본 그대로. KO/EN parity, SemanticHeading, 320/768/1280/1920 무overflow

---

## 7. 스키마 확장 (지표·관리코드·주소) — 각각 별도 수직 슬라이스

각 슬라이스 = migration + repository + application service + RBAC + RLS + pgTAP + UI 컬럼.
**임계·룰은 타입 있는 도메인 정책 모듈이 소유**(컴포넌트·Route Handler 하드코딩 금지).

| # | 항목 | 비고 |
|---|---|---|
| S1 | `management_code` (관리회사·사이트) | 상세페이지 전용 표시·수정 |
| S2 | `address`(우편번호·도로명/지번·상세) (관리회사·사이트) | Daum embed 연동 |
| S3 | 계약 시작/종료일 → **D-day·만료 임박(30일)** | 만료/임박 타일·컬럼의 소스 |
| S4 | 플랜 등급 `STANDARD/BUSINESS/ENTERPRISE` | 표시·분류용 라벨 (과금 로직 없음) |
| S5 | 차량 용량 사용률 = 활성 바인딩 ÷ 계약차량한도 | 한도 0이면 `—` |
| S6 | QR 활성화율 = 활성 QR ÷ 발급 총량 | 분모 소스 확인 필요 |
| S7 | 응답 품질 버킷 | **임계 미확정 — 사용자 확인 후 착수** |
| S8 | 미해결 건수 | 기존 operations aggregate의 company scope 재사용 가능성 **먼저 확인** |
| S9 | **리스크 등급** 스코어 룰 | **룰 미확정 — 사용자 확인 후 착수** |
| S10 | 현실적 합성 데모 시드 | E2E 픽스처 불변, 별도 시드 |

> S7·S9는 제품 정의가 확정되지 않았다. **임의로 임계값을 정하지 말 것.**
> 나머지(S1·S2·S10)는 지금 착수 가능하며 사용자 요구 우선순위가 높다.

---

## 8. 비협상 제약 (요약 — 상세는 `AGENTS.md`)

- 의존 방향 `UI → Route Handler → Application Service → Domain Policy → Repository → PostgreSQL`
- 컴포넌트·Route Handler에 비즈니스 규칙·문구·URL·보존기간·rate limit·임계값 **하드코딩 금지**
- 중앙 RBAC **와** PostgreSQL RLS를 **모두** 통과. 화면 필터는 권한이 아니다
- 보안 관련 mutation은 같은 트랜잭션에 **redacted audit**
- **QR 수량 1..100 per-Batch**, 단일 1,000-item Batch 금지
- **Production Cron 활성 정의 0 유지**, Vercel 요금제 변경 금지
- KO/EN typed dictionary parity, SemanticHeading, **immutable logo**, EN "caller"
- 전화번호·메시지·OTP·쿠키·인증헤더·토큰·Provider secret을 Git·문서·로그·스크린샷에 남기지 않는다
- **없는 데이터를 지어내지 않는다.** 데이터 없으면 `—`/빈 상태. 사용률 %는 실데이터 있을 때만
- 내부 계약 고객(tenant) 이름을 가시 행에 노출하지 않는다

---

## 9. 검증 게이트

```bash
corepack pnpm validate:wcj      # 웹 변경마다
corepack pnpm verify            # 화면/Phase 완료 보고 전 (lint/typecheck/unit/DB/secret/logo/stage-guard/WCJ/build)
corepack pnpm verify:production-cron:deferred   # 활성 Cron 0 유지 확인
corepack pnpm db:test:linked    # 승인된 staging 확인 후
corepack pnpm e2e:staging       # 인증 staging 여정
```
추가로: 반응형 **320/768/1280/1920** 가로 overflow 0, Axe clean, 키보드·스크린리더 수동 게이트,
인증 상태 시각 검증에서 콘솔 에러 0.

---

## 10. 실행 순서 (커밋 단위)

1. **프리미티브** — `packages/ui`에 §5.1 컴포넌트 신설 + 단위 테스트. (데이터 변경 0)
2. **공통 셸** — `admin-page-header.tsx`를 프리미티브로 리팩터 + 범위 전환기. 전 관리자 화면 즉시 정렬
3. **고객관리 목록** → **관리회사 상세**(S1·S2 포함) → **사이트 목록/상세**
4. **QR 위자드 6단계**(§6.6, 수량 UX 포함)
5. **대시보드 · 운영 · 리포트 · 매출 · 계정권한**
6. **공개 랜딩 · 관리자 로그인**(§6.11)
7. **S3~S6, S8, S10** 스키마 슬라이스 (S7·S9는 사용자 확정 후)
8. 프로토타입·`_proto/` 제거 → 최종 `verify` → handoff 작성

각 단계마다 `validate:wcj`, 단계 완료 전 `verify`.
214개 `admin-*` 클래스는 한 번에 지우지 말고 **프리미티브로 대체된 것부터** 제거한다.
중간 상태에서도 화면이 깨지지 않아야 한다.

---

## 11. 별도 명시 지시 없이 착수 금지

Production 배포 · `taptolk.com` 도메인 연결 · Cron 활성화 · live Kakao/SMS/CAPTCHA Provider ·
Production Supabase 프로젝트/리전/Secret · Enterprise SSO · Vercel 요금제 변경 · 담당자 지정 ·
Task 3 access grant / Test Lab / persona · **승인 워크플로 신설**(레퍼런스의 "승인 대기" 큐) ·
**S7·S9 임계·룰 임의 결정** · **canonical QR 호스트 확정**.

---

## 12. 보고 형식

- **구현 완료 / 자동 검증 완료 / 수동 검증 대기**를 구분한다
- PASS 주장에는 명령·범위·테스트 수 또는 CI run을 붙인다
- "Production"은 실제 Production에 배포·검증된 경우에만 사용한다
- 단계 완료 시 `docs/handoff-MMDD-HHmm.md`에 branch/commit, 완료 범위, 검증 증거, 미해결 위험,
  `Exact next step`, 사용자 소유 외부 설정을 기록한다. **credential·secret 금지**
