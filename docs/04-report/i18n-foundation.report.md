# Completion Report: i18n-foundation

> Date: 2026-07-18 | Level: Enterprise

---

## 1. Summary

### 1.1 Feature Overview

Taptolk의 최초 공개 화면을 URL 기반 한국어·영어 구조로 전환했다. 저장된 사용자
선택을 우선하고, 최초 방문에서는 브라우저/OS 언어를 서버가 해석한다. 한국어가 아닌
방문자는 영어로 진입하며 UI의 KO/ENG 선택으로 언제든 변경할 수 있다.

### 1.2 Final Match Rate

100% (Target: 90%)

## 2. Completed Items

- [x] `/ko`와 `/en` locale route
- [x] cookie → `Accept-Language` 자동 판정
- [x] typed KO/EN content dictionary
- [x] localized metadata, loading, error, not found
- [x] 접근 가능한 KO/ENG 선택과 안전한 cookie 저장
- [x] 언어별 의미 단위 제목 줄바꿈
- [x] unit, WCJ, build, desktop/mobile E2E

## 3. Deviations from Design

없음.

## 4. Metrics

| Metric | Value |
|---|---|
| Design match | 100% |
| Unit suite | 8 files / 25 tests, all passed |
| Browser suite | 12 tests, all passed |
| WCJ | W/C/J 100/100/100 |
| Production build | `/ko`, `/en`, locale API, Proxy passed |
| PDCA iterations | 1 |

## 5. Learnings

1. locale URL을 content boundary로 사용하면 CDN cache와 SEO language 상태가 명확하다.
2. 모바일 header는 로고, locale, phase 정보를 각각 독립된 의미 그룹으로 배치해야
   320px에서도 안정적이다.
3. 영어 제목은 한국어 줄 위치를 복사하지 않고 영어 문장의 의미와 호흡에 맞춰야 한다.

## 6. Follow-up Items

- [ ] 모든 후속 Admin/Owner/Caller 화면을 KO/EN dictionary와 함께 구현
- [ ] 새 locale 추가 시 dictionary, metadata, selector, E2E를 같은 변경으로 확장
