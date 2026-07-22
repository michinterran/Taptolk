# Work Order — P1 공유 디자인 시스템 (2026-07-22)

> 상위 로드맵: `docs/development/workorder-admin-design-system-and-metrics-0722.md`
> 작성: Claude. 구현: Codex. 브랜치: `codex/phase-1-foundation` (기준 커밋 `b442624`).
> 이 지시서는 **P1만** 다룬다. 지표 데이터(P3)·화면 재구성(P2/P4)·승인 워크플로(P5)는 별도.

## 0. 목표와 성격

`레퍼런스1`의 시각 언어를 **재사용 가능한 토큰 + `packages/ui` React 프리미티브**로 확정한다.
이건 greenfield가 아니라 **수렴 작업**이다. 현재:

- 공유 토큰은 `packages/ui/src/styles/tokens.css`에 **26개뿐** (타입 스케일·상태 틴트·info·elevation 없음).
- 공유 컴포넌트는 `packages/ui`에 `Button`, `SemanticHeading`, `JourneyStatus` **3개뿐**.
- 관리자 스타일은 `apps/web/app/globals.css` **5,555줄에 `admin-*` 클래스 214개**가 화면별로 증식.
- `globals.css`가 **미정의 토큰 `--tt-space-8`을 사용**(tokens.css는 space-7까지만 정의) → 수정 대상.

**데이터 변경 0.** 없는 지표/컬럼을 이 Phase에서 만들지 않는다. 정직성 규칙(§7) 준수.

## 1. 범위

**포함**: (a) `tokens.css` 확장, (b) `packages/ui` 구조 프리미티브 신설, (c) 관리자 **공통 셸**
(사이드바·상단바·페이지 헤더·푸터)을 프리미티브로 리팩터, (d) 공개 표면(랜딩·로그인) 공용
프리미티브 확보, (e) 사용 가이드 문서.

**제외**(P2/P4로): 화면 본문(테이블 행 내용·요약 타일 데이터·검토 큐)의 화면별 재구성.
단 프리미티브를 검증할 최소한으로 고객관리(P2)·랜딩·로그인 셸은 프리미티브에 연결한다.

## 2. 제약 (상위 로드맵 §1 전체 적용 — 핵심 재확인)

- `packages/ui` 프리미티브는 순수 UI. DB·Provider·server 모듈 import 금지. 브라우저 안전.
- **기존 토큰 이름을 바꾸지 않는다.** 214개 클래스가 의존한다. 추가·정리만.
- 문구 하드코딩 금지: 모든 라벨은 props로 주입(타입 있는 KO/EN dictionary 소비). 프리미티브 자체엔 카피 없음.
- immutable logo(SHA-256 고정), SemanticHeading으로 헤딩, EN "caller" 유지.
- 공개 표면: 관리자 링크 0, noindex·sitemap 제외, canonical 단일 `/{locale}/admin/login` 유지.
- 매 웹 변경 후 `corepack pnpm validate:wcj`, P1 완료 보고 전 `corepack pnpm verify`.
- 반응형 320/768/1280/1920, 키보드·스크린리더·명암 수동 게이트 유지.

## 3. Step 0 — 감사 먼저 (구현 전 필수)

1. `packages/ui/src/styles/tokens.css`, `packages/ui/src/index.ts`, `button.tsx`, `semantic-heading.tsx`,
   `journey-status.tsx` 현황 파악.
2. `apps/web/app/globals.css`의 214개 `admin-*` 클래스를 역할별로 그룹핑(셸/헤더/타일/필터/테이블/
   배지/pill/미터/페이지네이션/카드/푸터/폼/공개-auth). 중복·유사 클래스 목록화.
3. `admin-page-header.tsx`, `admin-dashboard-view.tsx`, `management-company-catalog-view.tsx`,
   그리고 공개 랜딩·로그인 컴포넌트가 쓰는 클래스 매핑.
4. `--tt-space-8` 등 미정의 토큰 참조를 모두 찾는다.
   산출: 감사 메모(어떤 클래스를 어떤 프리미티브로 수렴하는지 매핑표). 이후 단계의 기준.

## 4. 토큰 확장 (`packages/ui/src/styles/tokens.css`)

기존 값 유지 + 아래 **의미 기반** 토큰 추가. 정확한 색상값은 브랜드(brand `#8066ff`, accent
`#ff7a00`) 팔레트 안에서 Codex가 확정하고 명암(AA) 통과를 검증한다.

- **미정의 수정**: `--tt-space-8`(예 `4rem`) 정의. globals의 미정의 참조 제거.
- **타입 스케일**: `--tt-font-size-xs|sm|base|md|lg|xl|2xl|3xl`, `--tt-font-weight-regular|medium|semibold|bold`,
  `--tt-line-tight`(제목용, 기존 line-heading와 정리).
- **표면/보더 레벨**: `--tt-color-surface-subtle`(타일·테이블 헤더 배경), `--tt-color-surface-muted`,
  `--tt-color-border-strong`.
- **info 색**: `--tt-color-info`(파랑 계열, "신규"·정보 배지용).
- **상태 틴트 쌍**(배지·pill·타일 경고용, 배경+전경): success/warning/danger/info/neutral 각각
  `--tt-color-*-surface`, `--tt-color-*-fg`. 텍스트/배경 명암 AA 보장.
- **elevation**: `--tt-shadow-sm|md`(기존 shadow-card는 lg로 유지 또는 별칭).
- **radius**: `--tt-radius-pill`(9999px). 기존 sm/md/lg 유지.
- **포커스 링**: `--tt-focus-ring`(focus 색 기반 outline 정의).
- **z-index 스케일**: `--tt-z-sidebar|dropdown|modal|toast`.
- **테마**: 라이트를 canonical로 유지(레퍼런스가 라이트). 토큰을 의미 기반으로 정리해 이후 다크를
  레이어링 가능하게만 하고, **P1에서 다크를 구현하지 않는다.**

## 5. 프리미티브 컴포넌트 (`packages/ui`)

레퍼런스1 관찰 기반. 각 컴포넌트는 타입 있는 props, variant·상태(loading/empty/disabled),
접근성(role·aria·키보드), KO/EN 무관(문구는 props)로 만든다. `index.ts`에 export.

**셸/네비게이션**
- `AppShell` — 사이드바 + 상단바 + 콘텐츠 영역 레이아웃(관리자용). 공개용은 별도 슬롯 구성 허용.
- `Sidebar` — 로고 슬롯, 섹션 그룹, `SidebarItem`(아이콘+라벨+활성 표시), **접기 토글**(키보드 접근).
- `TopBar` — 좌측 범위 슬롯, 우측 locale 토글·날짜/실시간 배지 슬롯·계정 슬롯.
- `PageHeader` — eyebrow, 타이틀(SemanticHeading), 설명, 우측 primary action 슬롯.
- `Footer` — 저작권 슬롯 + 링크 슬롯(법적 링크는 값 있을 때만 렌더).

**데이터 표시**
- `StatTile` — 아이콘 원형 배지 + 라벨 + 값 + 보조 맥락 줄 + `tone`(default/success/warning/danger).
- `StatStrip` — 타일 반응형 그리드 래퍼.
- `DataTable` — 컬럼 정의(정렬·수치 우측정렬), 헤더/행 높이/구분선/hover, `EmptyState` 연동.
  (테이블은 접근성 위해 `<table>` 시맨틱 유지.)
- `Badge` — `tone`(neutral/info/success/warning/danger), 예 "신규"·"최우선 검토".
- `StatusPill` — 상태→tone 매핑 표시(값/문구는 props). 예 양호=success, 일시중지=warning, 종료=neutral.
- `MeterBar` — `value`/`max`/`tone`. **§7 정직성 규칙** 준수(사용률 % 위장 금지).
- `Pagination` — 번호형(1·2·3) + 이전/다음 + 페이지당 개수 셀렉트. href·상태 보존은 소비 측 주입.
- `SideCard` — 우측 레일 카드(아이콘 배지+제목+메타+액션 슬롯). 검토/큐 카드 공용 껍데기.
- `EmptyState` — 제목+설명+선택 액션.

**폼/공개**
- `Button` — 기존 확장: variant(primary/secondary/danger/ghost), size(default/compact). 기존 클래스 호환.
- `AuthCard`/`AuthShell` — 로그인·회원가입 공용(기존 `admin-auth-*` 수렴). 
- 랜딩 섹션 프리미티브는 감사 결과 필요한 것만 최소로(Hero/Section 래퍼 등). 과설계 금지.

## 6. 공통 셸 리팩터 + 앵커 화면 연결

1. 관리자 공통 셸(사이드바·상단바·페이지 헤더·푸터)을 새 프리미티브로 교체 → 모든 관리자 화면이
   즉시 동일한 chrome을 갖는다.
2. 검증용 앵커로 **고객관리(P2 대상)**, **공개 랜딩**, **관리자 로그인**을 프리미티브에 연결한다.
   본문 데이터 컬럼의 정렬 세부는 P2/P4에서 이어가되, 셸·헤더·푸터·버튼·배지·pill·페이지네이션은 P1에서 통일.
3. 214개 클래스는 한 번에 지우지 않는다. 프리미티브로 대체된 것부터 제거하고, 남은 건 P2/P4에서 수렴.
   중간 상태에서도 화면이 깨지지 않게 한다.

## 7. 정직성 규칙 (위반 시 반려)

- 없는 지표를 프리미티브 기본값·목업 값으로 채우지 않는다. `MeterBar`는 실제 값만.
- "차량 용량 사용률 %"는 P3 전까지 렌더하지 않는다. 계약 차량 **한도 규모**만 시각화 가능.
- 우측 `SideCard`는 P1에선 현재의 정직한 상태검토(정지/종료)만 담는다. 승인/거절 워크플로(P5) 흉내 금지.
- 내부 tenant 이름을 가시 행에 노출하지 않는다.

## 8. 수용 기준 (Definition of Done)

- 토큰 확장 반영, `--tt-space-8` 등 미정의 참조 0.
- 프리미티브 export + 타입 + 각 컴포넌트 상태(loading/empty/disabled/forbidden 해당분) 처리.
- 공통 셸 + 고객관리·랜딩·로그인이 프리미티브 사용. 남은 admin-* 클래스는 매핑표에 "미수렴"으로 기록.
- 프리미티브 단위 테스트(패턴/접근성 관련) 추가.
- KO/EN parity(문구는 소비 측), SemanticHeading 유지, immutable logo 유지, 공개 표면 관리자 링크 0.
- 반응형 320/768/1280/1920 가로 overflow 0, Axe clean, 사이드바 접기·드롭다운 키보드 동작.
- `corepack pnpm validate:wcj` 매 변경 PASS, `corepack pnpm verify` PASS(lint/typecheck/unit/DB/secret/
  logo/service-guard/WCJ/build), `verify:production-cron:deferred` PASS(활성 Cron 0 유지).
- 인증 상태 시각 검증(관리자 대시보드·고객관리·로그인·랜딩)에서 콘솔 에러 0.

## 9. 보고 형식

구현 완료 / 자동 검증 완료 / 수동 검증 대기를 구분한다. PASS 주장엔 명령·범위·테스트 수를 붙인다.
P1 완료 시 `docs/handoff-MMDD-HHmm.md`로 체크포인트(브랜치/커밋, 완료 범위, 검증 증거, 미해결,
Exact next step=P2 고객관리 본문 정렬 + P3 착수 전 §4 제품 정의 확정)를 남긴다.

## 10. 착수 금지 (별도 지시 필요)

Production 배포·도메인·Cron 활성·live Provider·Production Supabase·요금제·담당자 지정,
그리고 P3 지표 스키마(만료일·플랜·사용률·활성화율·응답품질·건강스코어), P5 승인 워크플로.
