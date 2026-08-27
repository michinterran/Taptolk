# TAPTOLK WCJ 1.0

WCJ는 **Web Compliance & Journey**의 약자이며, Taptolk의 모든 프론트엔드와
운영 화면 변경이 통과해야 하는 품질 게이트다.

## 합격 기준

- 전체 점수 90점 이상
- W/C/J 각 범주 80점 이상
- Critical 위반 0건
- 자동 검사 통과가 수동 접근성·시각 검토를 대체하지 않음

가중치는 Web Compliance 40%, Content & Consistency 30%, Journey 30%다.
Critical, Major, Minor 위반은 각각 35, 12, 4점을 범주 점수에서 감점한다.

## 자동 검사

`pnpm validate:wcj`는 다음 19개 규칙을 검사한다.

| 범주 | 규칙 | 핵심 계약 |
|---|---|---|
| W | W001–W008 | 문서 언어, main landmark, 네이티브 컨트롤, 대체 텍스트, 안전한 HTML, focus, reduced motion |
| C | C001–C006 | 중앙 문구 사전, 한·영 키 계약, 의미 단위 제목 줄, 언어별 줄바꿈, 토큰 경계, 로고 SHA-256 |
| J | J001–J005 | 이용자별 route policy, 공통 상태, live status, 오류 복구, 공유 journey primitive |

브라우저 스모크는 axe 접근성 위반, 320px 가로 넘침, 의미 기반 제목 줄,
health 응답의 개인정보·secret 부재와 locale 자동 판정·선택 유지까지 추가로
검사한다.

## i18n 계약

- 공개 페이지의 canonical URL은 `/ko/...` 또는 `/en/...`이다.
- 최초 `/` 요청은 `taptolk_locale` cookie를 먼저 확인하고, 없으면 서버에서
  `Accept-Language`를 해석한다.
- 한국어가 선호 언어이면 `/ko`, 그 외 언어와 헤더 누락은 `/en`으로 이동한다.
- KO/ENG 선택은 명시적 사용자 의사이므로 다음 방문의 자동 판정보다 우선한다.
- `<html lang>`, metadata, 제목, 본문, 상태·오류 문구는 현재 URL locale과
  일치해야 한다.
- 사용자 문구는 typed KO/EN dictionary에 함께 등록한다. 컴포넌트와 route handler의
  문구 하드코딩은 허용하지 않는다.
- 제3언어, Geo-IP, 외부 번역 서비스는 현재 범위가 아니다.

## 의미 기반 줄바꿈

- 제목은 글자 수나 특정 화면 폭에 맞춰 임의로 `<br>`을 넣지 않는다.
- 완결된 의미 덩어리를 `SemanticHeading.lines`에 각각 전달한다.
- 영어는 한국어 줄 위치를 복사하지 않고 번역된 문장의 의미와 호흡에 맞춰 독립적으로
  의미 덩어리를 정한다.
- 각 줄은 DOM에서 `.semantic-line`으로 구분하되, 접근성 이름은 하나의 자연스러운
  문장으로 합친다.
- 본문은 `text-wrap: pretty`와 `word-break: keep-all`을 기본으로 하고, 문장 중간에
  강제 줄바꿈을 넣지 않는다.
- 버튼, 탭, 짧은 상태 라벨은 `white-space: nowrap`을 유지한다.
- 반응형 환경에서 의미 줄이 너무 길면 문구 자체의 의미 단위를 다시 편집하며,
  화면별 `<br>` 예외를 늘리지 않는다.

## 수동 검사

배포 전 다음 항목은 사람이 확인한다.

- 320px, 375px, 768px, 1440px에서 제목의 의미와 시선 흐름
- 200% 확대와 키보드 전용 탐색
- VoiceOver에서 제목·상태·오류 복구 순서
- 한국어 조사나 고유명사가 부자연스럽게 분리되지 않는지
- 로딩, 대기, 빈 결과, 성공, 오류, 재시도, 완료 상태의 다음 행동이 명확한지
- 승인된 원본 로고가 찌그러지거나 잘리지 않는지

## 실행

```bash
pnpm validate:wcj
pnpm validate:wcj:json
pnpm e2e:smoke
```

JSON 결과는 `wcj-report.json`에 생성되며 Git에 포함하지 않는다.
