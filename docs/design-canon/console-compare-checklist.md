# 콘솔·플랫폼 정본 눈대조 체크리스트

> 작성: Claude(디자인) 2026-07-25. **실행 시점: 스텝 D(스테이징 로그인 복구) 이후.**
> 콘솔·플랫폼은 로그인 게이트라 지금은 대조 불가 → 로그인 복구되는 즉시 이 표로 빠르게 끝낸다.
> 정본: `CONSOLE_DESIGN_SYSTEM_V2.md` + `reference-1-admin-console.png` +
> `console-shell.html`·`console-pages.html`·`console-detail.html`·`console-site-operations.html` +
> 상태는 `console-states.md`. 대조 폭 **1487px**(정본 실측 폭).

## 대조 방법
1. 스테이징 로그인 → 대상 역할(슈퍼어드민/관리회사/사이트)로 화면 진입.
2. 정본을 같은 1487px에서 나란히 띄운다.
3. 아래 공통 7항목 + 화면별 항목을 확인. 다르면 고치거나(토큰/정본), 못 고치면 구체적으로 질문.
4. 각 화면 결과를 `✅/⚠️(수정필요)/❓(질문)`로 기록.

## 공통 14항목 (모든 콘솔 화면)
- [ ] **다크 기본** — 첫 진입은 다크. canvas/sidebar/panel/row가 중성 단계로 구분되고 밝은 격자·그라디언트 없음
- [ ] **라이트 지원** — 상단 테마 버튼으로 전환, 선택 유지, 레이아웃과 정보 우선순위 동일
- [ ] **셸** — 고정 sidebar + 얇은 topbar + 좌측 정렬 본문. 활성 navigation은 neutral band + 브랜드 보라색 icon/text
- [ ] **브랜드 줄바꿈** — 로고 옆 `운영 콘솔`은 한 줄. 좁은 폭에서는 축약하며 단어 중간 줄바꿈 없음
- [ ] **범위 홈** — `전체 플랫폼`은 플랫폼 범위 홈 링크이며 주 액션·필터처럼 보이지 않음
- [ ] **전역 검색** — 충분한 입력 폭 + 명시적 검색 버튼. Enter와 버튼 결과가 같음
- [ ] **언어 control** — KO/ENG가 compact control 안에서 한 줄이며 topbar 높이를 가득 채우지 않음
- [ ] **소프트 내비게이션** — 내부 링크·검색·필터·pagination이 sidebar/topbar 전체를 다시 로드하지 않음
- [ ] **페이지 헤더** — 작은 h1(`--tt-heading-1-size`) + 짧은 설명. 같은 줄 오른쪽에 주 액션 **하나만**
- [ ] **지표 스트립** — 한 카드 안 셀, 셀 사이 세로 헤어라인, 셀마다 카드 그리지 않음. 값 없으면 `—`
- [ ] **목록** — panel + 선택적 우측 rail, filter·table·pagination이 같은 panel 안 헤어라인 구분, 조밀한 행
- [ ] **카드 안 카드 없음** — 구분은 헤어라인 하나
- [ ] **운영 데이터 위생** — fixture는 서버 플래그로 제외, 목록·지표 범위 일치, 내부 코드를 주 이름으로 표시하지 않음
- [ ] **토큰 준수** — padding·radius·font-size가 토큰에서(일회성 리터럴 0, `validate:design-system`)
- [ ] **상태** — 빈·로딩·오류·권한없음·한도·알수없음이 `console-states.md`대로

## 화면별 항목
| 화면 | 정본 | 특히 볼 것 |
|---|---|---|
| 대시보드 `/admin/dashboard` | reference-1 | 지표 스트립 셀 구성, 추이 그래프, 조치 항목 리스트, 우측 레일 |
| 운영 `/admin/operations` | console-pages | 연락 세션 테이블(세션·현장·사유·상태·경과·작업) + 알림 전달 상태. **전화번호 열 없음** |
| 사이트 목록 `/admin/sites` | console-pages | 컬럼(현장명·관리회사·주소·계약차량·활성QR·브랜드·운영상태·작업), test데이터 숨김 |
| 사이트 운영 `/admin/sites/[siteId]` | console-site-operations | 입고 대기·재고·입고확인·디자인 보관. 입고는 이 화면에서만 IN_STOCK |
| QR 운영 `/admin/qr-inventory` | CONSOLE_DESIGN_SYSTEM_V2 §6 | 현재 UI 계승 금지. 선택 확정/수정, 1..10,000 수량, 생성 progress, 다운로드 완료, 테이블+페이지네이션 |
| 계정 `/admin/accounts` | console-pages | 관리자 디렉터리(관리자·역할·범위·상태·작업) + 역할별 권한 매트릭스 |
| 권한 `/admin/access` | console-pages | 권한 × SA·MA·SO 매트릭스 |
| 리포트 `/admin/reports` | console-pages | 관리회사·현장·요청·응답률·해결률·미해결·추세. 없으면 `—` |
| 내 정보 `/admin/profile` | console-detail | 기본 정보, 언어 |
| 플랫폼 루트/테넌트 `/admin/platform`·`/tenants` | console-pages | 목록 패턴, 등록은 슈퍼어드민 직접만, 승인 큐 미표시 |
| 관리회사 목록/상세 `/admin/platform/management-companies` | console-pages/detail | 상세 = 기본정보 수정(Daum 주소), 소속 현장·멤버십. 과금 `—` |
| 매출 `/admin/platform/revenue` | console-pages | 계약(관리회사·플랜·현장·월금액·갱신일·상태). 과금 미확정=`—` |
| 플랫폼 권한 `/admin/platform/access` | console-pages | 관리자×역할×범위, 배정/회수 |

## v2 마이그레이션 판정

| 범위 | 현재 판정 | 다음 승인 조건 |
|---|---|---|
| 공통 sidebar·topbar·검색·테마·언어 | 기준선 구현 · 수동 QA 대기 | 다크/라이트, 검색 버튼·Enter, 내부 이동 무재로딩 확인 |
| QR 운영 `/admin/qr-inventory` | 첫 정본 구현 · 수동 QA 대기 | 선택 확정/수정, 수량, progress, 다운로드, pagination 실제 journey |
| 매출 `/admin/platform/revenue` | 목록 패턴 구현 · 수동 QA 대기 | 중첩 패널 없음, 헤더 band 연속성, 실제 회사명, 원화 아이콘 비율 |
| 대시보드·운영 모니터링·리포트 | 확장 대기 | 공통 셸 + 대시보드/분석/목록 패턴 대조 |
| 관리회사·사이트 목록/상세 | 확장 대기 | 목록/상세 패턴, fixture 경계, 관리회사 → 사이트 계층 대조 |
| 계정·권한·프로필 | 확장 대기 | 목록/설정 패턴과 역할별 범위 대조 |

`기준선 구현`은 해당 패턴을 다음 화면에 재사용할 수 있다는 뜻이다. `수동 QA 대기`가 남아
있으면 전체 백오피스 마이그레이션 완료로 보고하지 않는다.

## 대조 후
- ⚠️ 항목은 토큰/정본 수정으로 처리한다. 정본에 답이 없으면 §3 패턴으로, 그래도 애매하면 질문한다.
- 전부 ✅면 해당 화면 인벤토리 상태를 ⚪ → 완료로 갱신.
