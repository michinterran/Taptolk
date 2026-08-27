# Gap Analysis: i18n-foundation

> Date: 2026-07-18 | Design: `docs/02-design/features/i18n-foundation.design.md`

---

## Match Rate: 100%

## Summary

설계의 locale URL, 서버 판정, cookie 우선순위, 한·영 사전, 접근 가능한 선택기,
metadata와 검증 항목을 모두 구현했다. 전체 `verify:full`에서 정적·unit·build·browser
게이트가 통과했다.

## Implemented Items

- [x] `/ko`, `/en` canonical locale route와 static generation
- [x] cookie 우선, `Accept-Language` 후순위의 서버 locale 판정
- [x] 한국어 선호는 `/ko`, 그 외 언어와 헤더 누락은 `/en` fallback
- [x] typed KO/EN dictionary와 localized loading/error/not-found
- [x] 현재 locale의 `<html lang>`, metadata, canonical/alternate
- [x] 키보드·스크린리더용 KO/ENG 선택기와 `aria-current`
- [x] HttpOnly, SameSite=Lax, 1년, HTTPS Secure locale cookie
- [x] 안전한 local return path와 외부 redirect 차단
- [x] locale unit test, desktop/mobile E2E, axe, 320px overflow test
- [x] WCJ의 locale module·proxy·selector·dictionary 계약 검사

## Missing Items

- 없음.

## Changed Items (Deviations from Design)

- 없음.

## Evidence

- `pnpm verify:full`: 통과
- Vitest: 8 files / 25 tests 전체 통과
- Playwright: Desktop/Mobile 12 tests 전체 통과
- WCJ: W/C/J 100/100/100
- Next build: `/ko`, `/en`, `/api/locale`, Proxy 생성 확인

## Recommendations

1. 후속 페이지도 같은 locale segment와 typed dictionary 계약을 사용한다.
2. 새 화면의 한국어와 영어 semantic line group을 각각 의미 기준으로 검토한다.
3. 제3언어가 필요해질 때 URL·사전·E2E를 하나의 변경으로 확장한다.

## Next Steps

- [x] Match rate 90% 이상이므로 report 단계로 진행한다.
