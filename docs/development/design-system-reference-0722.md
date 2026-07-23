# Taptolk 디자인 시스템 기준 문서 (Codex 필독) — 2026-07-22

> Claude가 사용자 지시로 관리자·공개 화면 디자인 시스템을 직접 확정하고 **브라우저에서 검증**했다.
> Codex는 이후 모든 관리자·공개 UI 작업을 **이 문서와 프로토타입에 정확히 맞춘다.** 재발명·임의
> 재해석 금지. 아래 파일을 먼저 읽고 시작한다.

## 0. 먼저 읽을 것 (source of truth)

- **토큰(이미 확장됨, WCJ PASS):** `packages/ui/src/styles/tokens.css`
- **비주얼 레퍼런스 프로토타입(참조 전용, 실제 배포에 포함 금지):**
  - `apps/web/public/_design-prototype.html` — **관리자 전체 셸**(사이드바+상단바+본문): 요약 타일
    스트립, 필터바, 데이터 테이블(플랜·용량 미터·응답품질·D-day·리스크 pill), 페이지네이션,
    승인 대기 사이드 큐, **범위 전환기(scope switcher)**, 미니멀 라인 아이콘.
  - `apps/web/public/_design-prototype-detail.html` — **관리회사 상세**: 관리사명/관리코드 수정,
    **Daum(카카오) 우편번호 embed 주소검색**.
- **로드맵:** `docs/development/workorder-admin-design-system-and-metrics-0722.md`
- **P1 상세 지시:** `docs/development/workorder-p1-design-system-0722.md`
- **엔지니어링 계약/제약:** `AGENTS.md`, `CLAUDE.md`

> 프로토타입 2개는 **참조용 정적 HTML**이다. 앱 라우트가 아니며, 프리미티브 이식이 끝나면
> `public/`에서 제거한다. 그 전까지는 Codex의 시각 기준으로 보존한다.

## 1. 확정된 결정 (정확히 준수)

1. **브랜드/CI 원본 유지·재해석 금지.** 로고는 원본 이미지 `/brand/taptolk-logo.png` 그대로
   (텍스트 치환·재도안·재색·크롭·필터 금지, SHA-256 불변). 브랜드 퍼플/오렌지 원본 유지.
   고도화는 **레이아웃·밀도·컴포넌트·지표 컬럼에만** 적용한다.
2. **관리사명 = 목록에 실제 이름 표시**(코드형 문자열을 이름 자리에 노출 금지).
   **관리코드(`management_code`)는 name과 별개 필드**로 **상세(관리)페이지에서만** 표시·관리.
3. **상세페이지 수정 기능**: 관리사명·관리코드 등 수정. **주소 필드 + 주소검색** =
   **Daum(카카오) 우편번호 서비스**(무료·API키/시크릿 불필요·클라이언트). **embed 모드**(팝업 아님).
   좌표 저장하지 않고 **도로명/지번 주소 문자열만** 저장. 스크립트 로드 실패 시 수동 입력 폴백.
4. **현실적 합성 데모 시드**로 목록이 실제 이름처럼 보이게(E2E 결정적 픽스처는 불변, 별도 시드).
5. **미니멀 라인 아이콘**(stroke SVG / 기존 Phosphor 라인) 사용. 이모지 금지.
6. **범위 전환기(Scope switcher, 슈퍼어드민 전용)**: 상단 스코프 칩 → 드롭다운으로
   **전체 플랫폼 / 특정 관리회사 / 특정 사이트** 선택해 그 범위 대시보드로 전환·확인·관리·수정.
   - 이는 persona/역할 가장(SERVICE 금지 테스트 표면)이 **아니다.** 슈퍼어드민 본인 플랫폼 권한을
     하위 트리로 **좁히는** 것. 서버가 범위 인가 + RLS 유지 + **감사에 실제 슈퍼어드민 actor + 범위**
     기록. 프론트 전환만으로 권한이 생기지 않는다. 하위 역할은 스코프 고정, 전환기 미노출.
   - 기존 `management-company-workspace-view`/`site-workspace-view`를 드릴다운 대상으로 재사용.
7. **용어:** `건강 상태` → **`리스크 등급` / `Risk level`** (값: 위험/주의/양호/보통).
   요약 타일 `건강한 고객` → **`저위험 고객`**. KO/EN dictionary 동시 반영.

## 2. 디자인 토큰 (`packages/ui/src/styles/tokens.css`, 확장 완료)

기존 26토큰 **이름 불변**(214 admin 클래스 의존). 추가된 것: `--tt-space-8`(미정의 버그 수정),
타입 스케일(`--tt-font-size-*`, `--tt-font-weight-*`, `--tt-line-tight`), 표면/보더 레벨
(`surface-subtle/muted`, `border-strong`), `--tt-color-info`, **상태 틴트 쌍**(success/warning/
danger/info/neutral/brand 각 `-surface`+`-fg`), elevation(`shadow-sm/md`), `radius-pill`/`radius-xs`,
`--tt-focus-ring`, z-index 스케일. 색은 브랜드 팔레트 내, 텍스트/배경 명암 AA 검증.

## 3. `packages/ui` 프리미티브 (프로토타입 CSS를 정식화)

Sidebar · TopBar(+ScopeSwitcher) · PageHeader · StatTile/StatStrip · FilterBar · DataTable ·
Badge(neutral/info/success/warning/danger) · StatusPill(점+tone) · **MeterBar(정직 — 가짜 % 금지,
실데이터만)** · Pagination(번호형+페이지당개수) · SideCard(승인 큐 카드) · Footer · AuthCard ·
**AddressField(Daum embed)** · Button 확장(variant/size). 문구는 props(타입 KO/EN dictionary 소비),
컴포넌트에 카피 하드코딩 금지. 접근성(role/aria/키보드), 상태(loading/empty/disabled/forbidden).

## 4. 레이아웃 규격 (프로토타입 기준)

- 셸: 좌측 사이드바 236px 고정/sticky(원본 로고 ~6.9rem, 그룹 라벨+라인아이콘 항목, active=
  `brand-surface` 배경+inset brand 바, 하단 `접기`+계정), 상단바 sticky(좌: 범위 전환기 / 우:
  KO·ENG 토글, 날짜+실시간 배지, 계정 아바타+역할).
- 본문: max-width ~1280, PageHeader(eyebrow+타이틀(SemanticHeading)+설명+우측 주요 액션),
  StatStrip(타일 6, 아이콘 원형 배지+값+보조맥락+tone), 그 아래 그리드 = 테이블 패널(1fr) + 사이드 큐(280px).
- 테이블: 헤더 `surface-subtle` 배경, 행 hover, 셀 nowrap + `overflow-x:auto` 래퍼(min-width~900),
  회사명 1줄 + 배지, 미터바/응답품질/ D-day(임박=danger)/리스크 pill.
- 반응형 320/768/1280/1920, KO/EN parity.

## 5. 데이터 모델 추가 (스키마 = P3, 각 슬라이스: migration+repo+service+RLS+pgTAP)

- `management_code`, `address`(관리회사·사이트)
- 지표: 플랜 등급, 계약 시작/종료일(D-day·만료임박 30일), 차량 용량 사용률(활성 바인딩÷한도),
  QR 활성화율(활성÷발급총량), 응답 품질 버킷, 리스크 등급 스코어.
- **정직성:** 없는 값은 지어내지 않는다. 데이터 없으면 `—`/빈 상태. 사용률 %는 실데이터 있을 때만.
- 임계·룰(응답품질 버킷, 리스크 등급 룰, 만료 임박 30일)은 **타입 있는 도메인 정책**이 소유
  (컴포넌트·Route Handler 하드코딩 금지). 응답품질·리스크 룰 수치는 착수 전 사용자 확정 필요.

## 5.0 레이아웃 규칙 (2026-07-23 확정 — 레퍼런스1 기준)

**왜 이 절이 생겼나:** globals.css의 **68개 규칙이 각자 카드를 정의**하고 있었다.
padding이 `0.85rem`/`1rem`/`1.1rem`/`1.25rem`, radius가 `0.8rem`/`1rem`/`2rem`으로 제각각이라
레퍼런스와 맞을 수 없었고, **한 화면을 고쳐도 다음 화면이 그대로**였다.
화면별로 고치는 접근이 실패한 원인이 이것이다.

### 레이아웃 토큰 (`packages/ui/src/styles/tokens.css`)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--tt-card-padding` | `1.5rem` | 콘솔 카드 내부 여백 |
| `--tt-card-padding-compact` | `1rem` | 좁은 카드 |
| `--tt-card-radius` | `0.875rem` | 카드 모서리 |
| `--tt-card-gap` | `1.5rem` | 카드 사이 간격 |
| `--tt-section-gap` | `1.5rem` | 섹션 사이 여백 |
| `--tt-console-max-width` | `none` | 콘솔은 사이드바 옆 공간을 채운다 |
| `--tt-console-gutter` | `clamp(1.25rem, 2.5vw, 2.5rem)` | 콘솔 좌우 여백 |

### 단일 카드 규칙

`apps/web/app/globals.css` **최하단**에 `콘솔 표면 규칙` 블록이 있다.
관리자 패널 20종이 여기서 shape·spacing을 가져온다.

- **새 관리자 패널을 만들면 그 블록에 셀렉터를 추가한다.**
  `background`/`border`/`border-radius`/`padding` 세트를 또 쓰지 않는다.
- 값을 바꿔야 하면 **토큰을 바꾼다.** 그러면 콘솔 전체가 함께 움직인다.
- 지표 스트립(`.tt-stat-strip`, `.admin-stat-strip`, `.operations-kpi-strip`)은
  자체 셀 구분선을 그리므로 **프레임만 갖고 padding은 0**이다.

### 카드 안에 카드 금지 (CSS로 강제됨)

레퍼런스는 카드 안에 카드를 두지 않는다. 구분이 필요하면 **헤어라인**이다.

- 지표는 개별 카드가 아니라 **한 카드 안의 셀**이다.
  `.tt-stat-tile`이 `.tt-side-card`와 카드 스타일을 공유하던 것이 박스-인-박스의 근원이었다.
- `.tt-data-table-wrap` · `.tt-filter-bar` · `.tt-empty-state` · `.tt-side-card`는
  **독립 사용을 위해** 카드 스타일을 갖는다. 패널 안에 놓이면 규칙 블록이 프레임을 제거한다.
- 패널 안에서 수치 그룹을 나눌 때 테두리 상자를 만들지 않는다. 구분선 하나면 된다.

## 5.1 버튼 (2026-07-23 확정 — 이 규격을 벗어난 버튼을 만들지 않는다)

버튼은 **하나의 정의**만 존재한다. 새 버튼을 만들 때 크기·모양·타입을 직접 쓰지 말고
`packages/ui`의 `Button` 프리미티브 또는 `.tt-button` 클래스를 쓴다.

| 항목 | 토큰 | 값 |
|---|---|---|
| 높이 | `--tt-button-height` | `2.5rem` |
| 높이(compact) | `--tt-button-height-compact` | `2.1rem` |
| 상하 padding | `--tt-button-padding-block` | `0.6rem` |
| 좌우 padding | `--tt-button-padding-inline` | `1.15rem` |
| 좌우 padding(compact) | `--tt-button-padding-inline-compact` | `0.85rem` |
| 글자 크기 | `--tt-button-font-size` | `0.85rem` |
| 글자 크기(compact) | `--tt-button-font-size-compact` | `0.79rem` |
| 글자 굵기 | `--tt-button-font-weight` | `600` |
| 모서리 | `--tt-button-radius` | `--tt-radius-pill` |
| 아이콘 간격 | `--tt-button-gap` | `0.4rem` |

- 채움색은 `--tt-color-brand`, 전경은 `--tt-color-on-brand`, 그림자는 `--tt-shadow-sm` 한 단계.
  hover에서만 `--tt-color-brand-strong`으로 진해진다.
- 변형: `primary`(기본) · `secondary`(흰 배경+헤어라인) · `ghost`(투명) · `danger`.
  크기: `default` · `compact`. 그 외 변형을 임의로 만들지 않는다.
- **컴포넌트 스타일시트에 버튼 수치를 다시 쓰지 않는다.** 값을 바꿔야 하면 `tokens.css`에서
  바꿔 제품 전체가 함께 움직이게 한다.
- 배경: 이전 정의가 `3rem`/`750`/`brand-strong`/그림자 없음이라 주변 카드보다 과하게 무거웠다.
  개별 화면이 아니라 전역 정의가 어긋나 있던 문제였다.

## 6. 비협상 제약 (요약, 상세는 AGENTS.md)

`UI→Route Handler→Application Service→Domain Policy→Repository→PostgreSQL`. 중앙 RBAC + RLS 둘 다
통과. 보안 mutation은 같은 트랜잭션 redacted audit. KO/EN parity, SemanticHeading, immutable logo,
QR 1..100 per-Batch, Production Cron 활성 0, 시크릿·전화번호·토큰 로그/문서/스크린샷 금지.
Production 배포·도메인·Cron·live Provider·Production Supabase·요금제는 별도 지시 없이 금지.

## 7. 작업/검증 절차

- 매 웹 변경 후 `corepack pnpm validate:wcj`, 화면/Phase 완료 보고 전 `corepack pnpm verify`.
- 관리자 화면은 로그인 뒤라 인증 시각검증 별도. 구현/자동검증/수동검증 대기를 구분 보고.
- 프리미티브 → 관리자 셸(로고 원본 유지) → 화면 → 스키마 순. 한 번에 한 슬라이스.
