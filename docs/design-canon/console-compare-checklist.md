# 콘솔·플랫폼 정본 눈대조 체크리스트

> 작성: Claude(디자인) 2026-07-25. **실행 시점: 스텝 D(스테이징 로그인 복구) 이후.**
> 콘솔·플랫폼은 로그인 게이트라 지금은 대조 불가 → 로그인 복구되는 즉시 이 표로 빠르게 끝낸다.
> 정본: `reference-1-admin-console.png` + `console-shell.html`·`console-pages.html`·
> `console-detail.html`·`console-qr-wizard.html`·`console-site-operations.html` +
> 상태는 `console-states.md`. 대조 폭 **1487px**(정본 실측 폭).

## 대조 방법
1. 스테이징 로그인 → 대상 역할(슈퍼어드민/관리회사/사이트)로 화면 진입.
2. 정본을 같은 1487px에서 나란히 띄운다.
3. 아래 공통 7항목 + 화면별 항목을 확인. 다르면 고치거나(토큰/정본), 못 고치면 구체적으로 질문.
4. 각 화면 결과를 `✅/⚠️(수정필요)/❓(질문)`로 기록.

## 공통 7항목 (모든 콘솔 화면)
- [ ] **셸** — 사이드바 206px, 항목 높이 2.5rem·pitch 50px, 활성=브랜드 8% 틴트 알약(왼쪽 inset 바 없음), 그룹 라벨 대문자·`--tt-font-size-2xs`
- [ ] **페이지 헤더** — eyebrow(브랜드색) › h1(`--tt-heading-1-size`) › 설명(muted). 같은 줄 오른쪽에 주 액션 **하나만**
- [ ] **지표 스트립** — 한 카드 안 셀, 셀 사이 세로 헤어라인, 셀마다 카드 그리지 않음. 값 없으면 `—`
- [ ] **목록** — 본문 카드 + 우측 레일 2단, 필터바·테이블·페이지네이션이 같은 카드 안 헤어라인 구분, 행 48px
- [ ] **카드 안 카드 없음** — 구분은 헤어라인 하나
- [ ] **토큰 준수** — padding·radius·font-size가 토큰에서(일회성 리터럴 0, `validate:design-system`)
- [ ] **상태** — 빈·로딩·오류·권한없음·한도·알수없음이 `console-states.md`대로

## 화면별 항목
| 화면 | 정본 | 특히 볼 것 |
|---|---|---|
| 대시보드 `/admin/dashboard` | reference-1 | 지표 스트립 셀 구성, 추이 그래프, 조치 항목 리스트, 우측 레일 |
| 운영 `/admin/operations` | console-pages | 연락 세션 테이블(세션·현장·사유·상태·경과·작업) + 알림 전달 상태. **전화번호 열 없음** |
| 사이트 목록 `/admin/sites` | console-pages | 컬럼(현장명·관리회사·주소·계약차량·활성QR·브랜드·운영상태·작업), test데이터 숨김 |
| 사이트 운영 `/admin/sites/[siteId]` | console-site-operations | 입고 대기·재고·입고확인·디자인 보관. 입고는 이 화면에서만 IN_STOCK |
| QR 재고+위자드 `/admin/qr-inventory` | console-qr-wizard | 스텝퍼 6단계, 패널+미리보기 레일, 라이프사이클 카운트 |
| 계정 `/admin/accounts` | console-pages | 관리자 디렉터리(관리자·역할·범위·MFA·상태·작업) + 역할별 권한 매트릭스 |
| 권한 `/admin/access` | console-pages | 권한 × SA·MA·SO 매트릭스 |
| 리포트 `/admin/reports` | console-pages | 관리회사·현장·요청·응답률·해결률·미해결·추세. 없으면 `—` |
| 내 정보 `/admin/profile` | console-detail | 기본 정보, MFA 상태(시크릿 미표시), 언어 |
| 플랫폼 루트/테넌트 `/admin/platform`·`/tenants` | console-pages | 목록 패턴, 등록은 슈퍼어드민 직접만, 승인 큐 미표시 |
| 관리회사 목록/상세 `/admin/platform/management-companies` | console-pages/detail | 상세 = 기본정보 수정(Daum 주소), 소속 현장·멤버십. 과금 `—` |
| 매출 `/admin/platform/revenue` | console-pages | 계약(관리회사·플랜·현장·월금액·갱신일·상태). 과금 미확정=`—` |
| 플랫폼 권한 `/admin/platform/access` | console-pages | 관리자×역할×범위, 배정/회수 |

## 대조 후
- ⚠️ 항목은 토큰/정본 수정으로 처리(Claude). 정본에 답이 없으면 §3 패턴으로, 그래도 애매하면 질문.
- 전부 ✅면 해당 화면 인벤토리 상태를 ⚪ → 완료로 갱신.
