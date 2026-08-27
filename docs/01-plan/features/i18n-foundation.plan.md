# i18n-foundation - Plan

> Version: 1.0.0 | Date: 2026-07-18 | Status: Approved
> Level: Enterprise

## 1. Purpose

Taptolk의 최초 공개 화면부터 한국어·영어를 동등한 제품 언어로 제공한다. 방문자의
브라우저/OS 언어가 한국어가 아니면 영어로 자동 진입시키고, 사용자가 KO/ENG를
직접 선택하면 이후 방문에서도 그 선택을 우선한다.

## 2. Goals

- URL locale을 단일 기준으로 사용한다: `/ko`, `/en`.
- 최초 `/` 요청은 locale cookie와 `Accept-Language` 순으로 판정한다.
- 한국어 이외의 언어는 영어 fallback으로 처리한다.
- 모든 페이지의 `<html lang>`, metadata, 문구를 현재 locale과 일치시킨다.
- KO/ENG 선택기를 키보드·스크린리더로 사용할 수 있게 한다.
- 번역 키 누락과 UI 하드코딩을 WCJ/TypeScript/E2E에서 차단한다.

## 3. Scope

### In

- locale domain module, detection, normalization
- Next.js locale route와 proxy redirect
- 선택 locale cookie
- Foundation, Loading, Error, Not Found의 한·영 출력
- 언어 선택기와 반응형 스타일
- locale redirect/선택/browser tests

### Out

- 제3언어
- 외부 번역 SaaS
- 사용자 계정에 locale 저장
- Geo-IP 기반 언어 판정

## 4. Success Criteria

- 한국어 `Accept-Language`의 최초 `/` 방문은 `/ko`로 이동한다.
- 다른 모든 언어의 최초 `/` 방문은 `/en`으로 이동한다.
- 선택한 언어는 `taptolk_locale` cookie로 기억된다.
- `/ko`와 `/en`의 HTML language와 제목/본문이 일치한다.
- locale selector와 axe 검사에 위반이 없다.
- WCJ, typecheck, unit, build, Playwright가 통과한다.

## 5. Risks

| 위험 | 통제 |
|---|---|
| CDN cache가 언어를 섞음 | locale URL을 canonical content boundary로 사용 |
| cookie와 URL 불일치 | URL을 현재 화면의 최종 기준으로 사용 |
| 번역 키 drift | English dictionary를 Korean key contract에 `satisfies` |
| Client에서 OS API에 의존 | 최초 판정은 서버 `Accept-Language` 사용 |
| 언어 전환 시 잘못된 경로 | locale segment만 교체하는 순수 함수와 test |

## 6. Delivery

Plan → Design → Implementation → WCJ/Browser Check → Report 순으로 진행한다.

## 7. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`
- `docs/architecture/wcj-web-compliance-journey-standard.md`
