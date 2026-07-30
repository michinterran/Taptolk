# Taptolk Console Design System v2

> 상태: binding baseline, operator-approved direction 2026-07-30.
> 적용 범위: 슈퍼어드민, 관리회사 어드민, 사이트 어드민의 모든 운영/관리 콘솔.
> 제외 범위: 랜딩, 로그인, 가입, 차주/호출자 PWA.

이 문서는 Taptolk 백오피스 전체의 시각·상호작용 권위다. 레퍼런스는 YouTube Studio의
다크 운영 콘솔이며, Taptolk는 그 정보 구조·밀도·상태 표현·상호작용 문법을 브랜드 보라색과
현재 제품 기능에 맞게 이식한다. YouTube의 브랜드, 로고, 카피, 영상 자산을 복제하지 않는다.

### 0.1 기준선의 의미

- 이 문서는 이후 콘솔 화면이 따라야 하는 **v2 기준선**이다. 화면별 즉흥 CSS나 handoff 문구가
  이 기준을 덮을 수 없다.
- 기준선 확정은 전체 콘솔 마이그레이션 완료를 뜻하지 않는다. 셸, QR 운영, 매출 목록에서
  검증한 문법을 먼저 고정하고 나머지 화면을 같은 규칙으로 이동한다.
- 화면이 아직 수동 대조를 통과하지 않았다면 마이그레이션 표에서 `수동 QA 대기`로 남긴다.
  자동 게이트 통과만으로 `완료`로 바꾸지 않는다.

## 0. 2026-07-30 교정

색상만 어둡게 바꾸거나 기존 카드 배치를 그대로 유지한 화면은 v2가 아니다. 아래 구현은
명시적으로 폐기한다.

- 기존 밝은 화면의 카드, 요약 스트립, 우측 카드, 폼 프레임을 그대로 두고 색상만 변경
- 목록 화면에서 `페이지 헤더 → 지표 박스 → 외곽 패널 → 패널 헤더 → 툴바 → 표`를 중첩
- 기능명이 아닌 설명 문장을 페이지 제목으로 사용
- 모든 화면에 동일한 지표 스트립과 카드 그리드를 기계적으로 적용
- 공통 CSS가 기존 마크업을 덮어 보이게만 만드는 방식

v2는 화면의 정보 구조부터 다시 만든다. 목록, 분석, 대시보드, 상세, 설정은 서로 다른
YouTube Studio 문법을 사용하며, 기존 DOM 계층이 그 문법과 다르면 마크업을 교체한다.

## 1. 확정 방향

- 콘솔 기본 테마는 **다크**다. 사용자가 상단 테마 버튼으로 라이트를 선택할 수 있다.
- 테마 선택은 같은 브라우저에 유지된다. 다크·라이트는 같은 의미 토큰과 같은 레이아웃을 쓴다.
- 좌측 고정 내비게이션, 얇은 상단 도구막대, 좌측 정렬 작업 영역을 모든 콘솔 화면이 공유한다.
- 페이지 제목 아래에는 필요할 때만 탭·기간·필터를 둔다.
- 지표는 하나의 스트립 안에서 헤어라인으로 나눈다. 지표마다 떠 있는 카드를 만들지 않는다.
- 목록은 행과 열이 중심이다. 반복 정보를 카드 그리드로 바꾸지 않는다.
- 상세와 설정은 넓은 본문 + 보조 레일 또는 좌측 섹션 내비게이션으로 구성한다.
- 브랜드 보라색은 선택, 진행, 주요 액션에만 쓴다.
- 큰 보라색 면, 밝은 격자 배경, 장식용 그라디언트, 중첩 카드, 대형 마케팅 제목은 금지한다.

## 2. 적용 화면

아래 라우트와 그 하위 운영 화면은 모두 v2를 사용한다.

| 패턴 | 화면 |
|---|---|
| 대시보드형 | `/admin/platform`, `/admin/dashboard`, `/admin/operations` |
| 목록형 | `/admin/platform/management-companies`, `/admin/sites`, `/admin/qr-inventory`, `/admin/reports`, `/admin/platform/revenue`, `/admin/accounts`, `/admin/access`, `/admin/platform/access`, `/admin/platform/tenants` |
| 상세형 | `/admin/platform/management-companies/[companyId]`, `/admin/sites/[siteId]`, `/admin/profile` |
| 편집형 | 관리회사 등록·수정, 사이트 운영 입력, 계정·권한 변경 |
| 설정형 | 계정 메뉴와 향후 콘솔 설정 dialog |

랜딩과 로그인·가입 화면은 이 목록에 포함하지 않는다.

## 3. 테마

### 3.1 다크 기본

- canvas와 sidebar는 거의 검정인 중성색이다.
- panel과 row hover는 canvas보다 한 단계만 밝다.
- 경계는 그림자보다 1px 헤어라인을 우선한다.
- 본문은 고대비 흰색, 보조 텍스트는 중성 회색이다.
- 입력, select, menu, dialog도 동일한 다크 표면 단계를 사용한다.

### 3.2 라이트 지원

- canvas는 차가운 중성 회색, panel은 흰색이다.
- 다크와 동일한 컴포넌트 계층·간격·반경을 유지한다.
- 라이트 전환 때문에 패널 수, 레이아웃, 정보 우선순위가 달라지지 않는다.

### 3.3 강조과 상태

- 브랜드 보라색: active navigation, active tab underline, progress, primary action.
- 성공·경고·오류·정보: 작은 badge, icon, inline notice에만 사용한다.
- 상태 배경은 저채도 surface로 제한한다. 패널 전체를 상태색으로 칠하지 않는다.

## 4. 공통 셸

```text
┌──────────────┬──────────────────────────────────────────────────────┐
│ brand        │ scope / global search / theme / locale / account    │
├──────────────┼──────────────────────────────────────────────────────┤
│ fixed nav    │ page title + compact actions                         │
│              │ optional tabs / filters                              │
│              │ metrics / table / chart / detail workspace           │
└──────────────┴──────────────────────────────────────────────────────┘
```

- sidebar는 200px 고정 폭이며 viewport 높이를 채운다.
- topbar는 56px 고정 높이고 sidebar 오른쪽 남은 폭을 사용한다.
- 본문은 중앙의 좁은 마케팅 column에 갇히지 않고 왼쪽에서 시작한다.
- 목록·표 화면은 남은 viewport 폭을 사용하고 좌우 32px gutter를 둔다.
- 대시보드 위젯 영역은 최대 1120px, 설정 본문은 최대 1040px다.
- 태블릿에서는 sidebar를 축약하고, 작은 화면에서는 가로 overflow보다 작업 순서를 보존한다.
- 검색은 실제 콘솔 내비게이션을 필터링하고 선택한 화면으로 이동한다.
- 테마, 언어, 계정은 topbar 오른쪽의 compact icon/control group에 둔다.

### 4.1 상단 도구막대 상호작용

- 로고 옆 제품명은 `운영 콘솔`처럼 한 줄로 유지한다. 폭이 부족하면 보조 문구를 숨기거나
  셸을 축약하며, 단어 중간 줄바꿈으로 두 줄 로고를 만들지 않는다.
- `전체 플랫폼`은 주 액션이나 목록 필터가 아니다. 현재 사용자에게 허용된 플랫폼 범위의
  홈으로 돌아가는 **범위 홈 링크**다. 관리회사·사이트 범위에서는 해당 범위 이름과 범위 홈을
  사용한다.
- 전역 검색은 입력창과 명시적인 검색 아이콘 버튼을 함께 제공한다. Enter와 버튼은 같은
  결과를 내며, 비어 있는 검색은 현재 화면을 새로고침하지 않는다.
- KO/ENG는 compact segmented control로 제공한다. 각 항목은 한 줄이며 topbar 높이를
  가득 채우지 않는다.
- sidebar, 범위 홈, 검색 결과, 탭, pagination, 화면 내부 링크는 클라이언트 내비게이션을
  사용한다. 전체 document reload는 로그아웃, 외부 URL, 파일 다운로드처럼 브라우저 문서
  전환이 실제로 필요한 작업에만 허용한다.
- query를 바꾸는 검색·필터·수량·페이지 크기 form도 client router로 이동한다. form 제출이
  화면 전체를 흰색으로 비우거나 셸을 다시 로드해서는 안 된다.

### 4.2 수치 계약

| 항목 | 값 |
|---|---:|
| sidebar | 200px |
| topbar | 56px |
| desktop content gutter | 32px |
| page title | 24px / 32px / 700 |
| section title | 18px / 26px / 600 |
| body | 14px / 20px / 400 |
| control text | 14px / 20px / 500 |
| muted/meta | 12px / 18px / 400 |
| table header | 12px / 18px / 500 |
| table row | 64px minimum |
| control height | 36px |
| primary tab | 48px |
| list divider | 1px |
| card radius | 8px |
| list/table radius | 0 |
| letter spacing | 0 |

한국어 제목은 의미 단위가 아닌 장식 줄바꿈을 하지 않는다. 페이지 제목은 `대시보드`,
`고객관리`, `QR 운영 관리`, `운영 모니터링`, `리포트`, `매출 관리`, `계정·권한`처럼
기능명을 사용한다. 설명 문장은 제목 아래 한 줄 보조문으로 둔다.

### 4.3 화면 유형

#### 목록 화면

`제목 → 관점 탭 → 필터 툴바 → 컬럼 헤더 → 64px 행 → 페이지네이션` 순서다. 표 전체를
카드로 감싸지 않고, 지표 스트립과 우측 검토 카드를 앞에 두지 않는다. 상태 수량은 탭 count
또는 툴바 요약으로 이동한다.

#### 분석 화면

`제목 → 기간/관점 탭 → 단일 분석 프레임` 순서다. 분석 프레임 안에서 지표 셀과 차트를
헤어라인으로 구분한다. 그 아래는 비교 표 하나를 둔다. 지표 프레임, 차트 카드, 설명 카드,
표 카드를 각각 만들지 않는다.

#### 대시보드

첫 viewport에는 독립 위젯 2~3열을 허용한다. 각 위젯은 하나의 업무 질문만 답하며 위젯
내부에 다른 카드를 넣지 않는다. 전체 폭 지표 스트립을 먼저 배치하지 않는다.

#### 설정·등록

좌측 220px 섹션 내비게이션과 우측 본문을 사용한다. 전체 폼을 다시 카드로 감싸지 않는다.
각 섹션은 배경 박스가 아니라 1px 구분선으로 나눈다. 하단 action bar는 한 번만 존재한다.

## 5. 공통 컴포넌트

### Page Header

- h1은 24/32px이며 기능명 한 줄을 우선한다. hero 문장과 강제 두 줄을 사용하지 않는다.
- 설명은 한두 줄 이내이며 사용법을 장황하게 안내하지 않는다.
- 주 액션은 최대 하나다. 나머지는 toolbar 또는 row action으로 이동한다.

### Tabs

- 주요 관점 전환에 쓴다.
- 활성 상태는 밝은 텍스트 + 2px 보라색 하단선이다.
- 컨테이너를 pill로 감싸지 않는다.

### Toolbar와 Filter

- 검색, select, 기간, 빠른 필터, 일괄 작업을 한 줄에 둔다.
- filter chip은 작은 neutral surface를 쓰며 active만 한 단계 밝게 한다.
- toolbar 자체를 떠 있는 카드로 만들지 않는다.

### Metric Strip

- 하나의 border frame 안에 여러 metric cell을 배치한다.
- icon은 보조 신호이며 값보다 크게 보이지 않는다.
- 숫자는 tabular numerals를 사용한다.
- 값 없음은 `—`, 실제 0은 `0`, 조회 실패는 `확인 불가`로 구분한다.

### Panel

- panel radius는 작고 shadow는 기본적으로 없다.
- header, toolbar, body, footer는 헤어라인으로 나눈다.
- panel 안에 다시 card를 넣지 않는다.

### Data Table

- header는 작은 muted semibold, body는 조밀한 행이다.
- 목록 화면의 table wrapper에는 radius, shadow, panel border가 없다.
- 첫 열은 주 텍스트 + 보조 텍스트의 entity cell이다.
- 숫자는 우측 정렬한다.
- row hover와 selected state는 surface 한 단계 차이로 표현한다.
- 반복 primary button을 만들지 않고 마지막 열에 compact row action을 둔다.
- pagination과 page size는 같은 panel footer 안에 둔다.
- 컬럼 header surface는 표 너비 전체를 연속해서 채우거나 완전히 투명해야 한다. 일부 열에만
  배경이 남는 상태는 허용하지 않는다.
- 관리회사·사이트의 주 표시값은 운영자가 등록한 이름이다. 내부 ID, 관리코드, fixture label을
  주 이름 대신 출력하지 않는다.

### Operational Data Hygiene

- 운영 목록과 지표는 `is_test_fixture = false`인 동일한 read model 범위를 사용한다.
- fixture 제외는 repository 또는 SQL read model에서 명시적 플래그로 수행한다. React에서
  이름 문자열을 검사하거나 숨기지 않는다.
- 목록에서 fixture를 제외했다면 상단 지표도 같은 행 집합으로 다시 집계한다.
- 실제 운영 이름이 없는 경우 내부 코드로 대체하지 않고 `—` 또는 계약된 빈 상태를 사용한다.

### Progress

- 상태 label → 현재/전체 수량 → bar → 다음 액션 순서다.
- 생성 중, 출력 준비, 다운로드 가능, 다운로드 완료, 실패·재시도를 서로 다른 상태로 표시한다.
- 장식용 stepper보다 실제 처리 수치가 우선한다.

### Dialog와 Settings

- backdrop + 넓은 dialog + 좌측 section navigation + scrollable body + 하단 action bar를 쓴다.
- 단순 확인은 작은 dialog, 긴 편집은 settings dialog 또는 detail page를 쓴다.
- dialog도 현재 콘솔 테마를 그대로 상속한다.

## 6. QR 운영 첫 정본

QR 운영은 v2 기능 상태를 가장 먼저 검증하는 화면이다. 기존 QR 카드형 위저드와 밝은 격자
캔버스는 계승하지 않는다. read model, 권한, 생성 action, SVG 다운로드 API는 유지한다.

```text
QR 운영 관리                                      [scope]
생성 작업 | 발행 묶음 | 다운로드 | 예외
metrics: 회사 / 사이트 / 발행 묶음 / 생성 / 대기 / 활성
┌──────────────────────────────────────────┬──────────────────┐
│ scope row                                │ request rail     │
│ quantity row 1..10,000                   │ confirmed scope  │
│ progress and result row                  │ progress         │
│                                          │ download state   │
├──────────────────────────────────────────┴──────────────────┤
│ batch table + single footer pagination                       │
└──────────────────────────────────────────────────────────────┘
```

1. 관리회사와 사이트를 선택하고 한 번 확정한다.
2. 확정 뒤 같은 위치에서 요약과 `수정`을 제공한다.
3. 수량은 1부터 10,000까지 직접 입력할 수 있다.
4. 빠른 값은 10, 50, 100, 500, 1,000, 5,000, 10,000이다.
5. 100개 단위 서버 분할 계획을 생성 전에 보여준다.
6. 생성 중에는 generated, rendered, passed, failed와 퍼센트를 보여준다.
7. 완료 시 다운로드 가능 상태와 SVG 버튼을 제공하고 다운로드 완료 상태도 남긴다.
8. 발행 묶음 목록은 table + footer pagination으로 운영한다.

## 7. 전체 화면 마이그레이션 규칙

- 공통 값은 `packages/ui/src/styles/tokens.css`에만 둔다.
- 공통 구조는 `packages/ui` console primitives와 관리자 공통 컴포넌트에서 제공한다.
- `apps/web/app/globals.css`는 의미 class의 배치와 상태만 가진다.
- 화면별 CSS는 컬럼 폭, overflow, 특수 grid만 허용한다.
- v1의 카드·radius·shadow·background 재정의는 새 화면에서 제거한다.
- 다크와 라이트를 별도 화면 CSS로 복제하지 않는다. 시맨틱 토큰 매핑만 전환한다.
- 기능, 서버 권한, read model, 개인정보 경계는 디자인 마이그레이션으로 변경하지 않는다.

### 7.1 토큰 소유권

| 영역 | 기준 토큰 |
|---|---|
| 셸 | `--tt-console-v2-sidebar-width`, `--tt-console-v2-topbar-height`, `--tt-console-v2-content-gutter` |
| 검색·control | `--tt-console-v2-search-width`, `--tt-console-v2-control-height`, `--tt-console-v2-icon-button-size` |
| page rhythm | `--tt-console-v2-page-gap`, `--tt-console-v2-workbench-gap`, `--tt-console-v2-panel-padding` |
| panel·rail | `--tt-console-v2-panel-radius`, `--tt-console-v2-rail-width`, semantic surface/border tokens |
| tabs·chips | `--tt-console-v2-tab-height`, `--tt-console-v2-tab-underline`, `--tt-console-v2-chip-height` |
| table | `--tt-table-*` 전체 |
| type | `--tt-heading-*`, `--tt-body-size`, `--tt-label-size`, `--tt-stat-value-size` |
| progress | `--tt-console-v2-progress-height`와 상태 semantic tokens |

토큰의 현재 값은 `packages/ui/src/styles/tokens.css`가 소유한다. 이 문서의 숫자가 토큰과
다르면 토큰을 임의로 바꾸지 말고 먼저 두 권위의 충돌을 해결한다.

### 7.2 공통 구현 소유권

| 책임 | 공통 구현 |
|---|---|
| sidebar·topbar·scope·account | `AdminPageHeader` |
| global search | `ConsoleSearch` |
| theme | `ConsoleThemeControl` |
| query soft navigation | `ConsoleQueryForm` |
| page title | `PageHeader` |
| tabs | `ConsoleTabs` |
| panel composition | `ConsolePanel`, `PanelBody`, `PanelScroll`, `PanelFooter`, `PageColumns` |
| table·pagination | `DataTable`, `Pagination`, `CellEntity`, `RowAction`, `Meter` |
| metrics·status | `StatStrip`, `StatTile`, `StatusPill` |

화면은 이 공통 구현을 조합한다. 동일 책임의 로컬 복제품을 추가하려면 먼저 공통 구현으로
흡수할 수 없는 이유를 권위 문서에 남겨야 한다.

## 8. 완료 기준

1. 전체 백오피스 라우트가 같은 sidebar/topbar/theme control을 사용한다.
2. 다크가 첫 진입 기본값이고 라이트 선택이 유지된다.
3. 모든 목록은 같은 table, row, filter, pagination 문법을 사용한다.
4. 모든 상세는 같은 page header, panel, rail 문법을 사용한다.
5. QR 생성·진행·다운로드 journey가 실제로 동작한다.
6. 1487px 다크 정본 대조와 1280/768/320px overflow 검사를 통과한다.
7. 다크·라이트 양쪽에서 focus, contrast, keyboard path를 수동 확인한다.
8. `validate:design-system`, `validate:wcj`, `verify`가 통과한다.
