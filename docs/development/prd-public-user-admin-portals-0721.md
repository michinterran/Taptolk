# PRD — 일반 사용자 랜딩과 관리회사 관리자 포털 분리

> 작성일: 2026-07-21  
> 작성 목적: Claude 구현 지시서  
> 대상 브랜치: `codex/phase-1-foundation`  
> 기준 커밋: `6c8413f`  
> 상태: 구현 승인용 PRD — Production 배포·도메인 연결은 제외

---

## 0. 문서 권한과 실행 순서

이 PRD는 다음 두 웹 표면을 먼저 정리하기 위한 독립 구현 지시서다.

1. 일반 사용자를 위한 Taptolk 소개 랜딩
2. 관리회사와 승인된 관리자를 위한 관리자 포털 소개·인증 진입

이 PRD는 `docs/development/prd-public-surface-0721.md`의 공개/관리 표면 관련 요구를
이번 사용자 결정에 맞게 구체화하며, **실행 순서를 변경한다.**

```text
이 PRD의 공개·관리 사이트 정리
→ 자동 검증·커밋·handoff
→ 별도 승인 후 Task 3 Staging Test Access Grant
→ 약관·처리방침·도입 문의 등 후속 공개 표면
```

따라서 이 PRD 수행 중에는 다음을 시작하지 않는다.

- Task 3 access grant
- Test Lab
- persona 세션
- live Kakao AlimTalk Provider
- Production 배포 또는 도메인 연결

기존 `docs/development/prd-public-surface-0721.md`와
`docs/development/workorder-kakao-alimtalk-live-provider.md`는 사용자 소유 문서다. 임의로
삭제·덮어쓰기·커밋하지 않는다. 충돌하는 실행 순서와 SMS 표현은 최종 handoff에
명시하고, 이 PRD 범위 안에서는 본 문서를 따른다.

---

## 1. 제품 결정

### 1.1 일반 사용자 랜딩

향후 대표 주소는 `www.taptolk.com`이다. 실제 도메인 연결 시점은 사용자가 별도로
지시한다. 이번 구현에서는 도메인을 코드에 하드코딩하지 않는다.

일반 사용자 랜딩은 다음 사람을 위한 설명 페이지다.

- 차량에 연락해야 하는 caller B
- QR 스티커를 부착한 차주 A
- Taptolk를 처음 접해 서비스 작동 방식을 알고 싶은 일반 사용자

이 페이지에는 로그인, 회원가입, 관리자 포털 링크 또는 관리회사 운영 기능을 노출하지
않는다. QR이 없는 방문자가 이 페이지에서 요청을 임의 생성하거나 차주 화면으로
진입하게 하지 않는다.

### 1.2 관리회사 관리자 포털

관리회사와 승인된 관리자는 `www.taptolk.com/admin`을 직접 전달받아 사용한다. canonical
locale 경로는 `/ko/admin`, `/en/admin`이다.

관리자 포털은 다음을 제공한다.

- 관리회사 관점의 Taptolk 서비스 소개
- 계약 이후 QR 발급·입고·배포·활성화·운영 흐름 설명
- 운영 기능·보안·승인 구조 설명
- 기존 관리자 로그인
- Google 계정으로 계속하기
- 이메일·비밀번호 계정 가입 요청

일반 랜딩은 관리자 포털 링크를 제공하지 않는다. `/admin` 주소를 알고 직접 접근하는
것은 허용하지만, 주소 비노출을 보안 수단으로 간주하지 않는다. 실제 보호는 기존
server-only profile, membership, role/scope, MFA, 중앙 RBAC와 PostgreSQL RLS가 담당한다.

### 1.3 인증 용어

현재 실제 구현은 Google OAuth와 이메일·비밀번호다.

- UI에는 `Google 계정으로 계속` / `Continue with Google`을 사용한다.
- 실제 SAML/OIDC 기업 SSO가 연결되기 전에는 `기업 SSO 지원`을 홍보하지 않는다.
- 신규 가입은 권한 부여가 아니라 계정 생성·승인 요청이다.
- 승인 대기 계정은 고객·QR·Owner·운영 데이터 접근이 0이어야 한다.

---

## 2. 확인된 현재 상태

### 2.1 일반 랜딩에 관리자 기능이 노출됨

현재 `apps/web/app/[locale]/page.tsx`와 `PublicSiteHeader`에는 다음이 존재한다.

- 관리자 로그인 navigation
- 고객·플랫폼 관리자 audience 카드
- `/[locale]/admin/login` 링크
- 차주 PWA와 onboarding으로 직접 이동하는 CTA

이번 결정에서는 일반 사용자 랜딩에서 관리자 언어와 로그인 기능을 제거해야 한다.

### 2.2 공개 경로도 관리자 Supabase Auth 갱신을 수행함

현재 `apps/web/proxy.ts`는 locale이 있는 모든 사용자 페이지에서
`client.auth.getClaims()`를 실행한다. `/ko`, QR scan, caller waiting room, activation,
Owner response 등 로그인하지 않는 공개 흐름도 관리자 Supabase Auth와 결합돼 있다.

### 2.3 `/[locale]/admin`은 소개 페이지가 아님

현재 `/[locale]/admin`은 `loadAdminContext()`를 호출해 비로그인 사용자를 바로
`/[locale]/admin/login`으로 보낸다. 관리회사가 서비스를 이해할 수 있는 별도 포털
소개 화면이 없다.

### 2.4 보존해야 하는 구현

- canonical 단일 관리자 로그인 `/{locale}/admin/login`
- 이메일 가입 `/{locale}/admin/signup`
- Google OAuth login/signup
- 서버가 profile, active membership, role/scope, MFA를 읽는 권한 판단
- 고객 관리자 `/admin/dashboard`와 플랫폼 관리자 `/admin/platform` 분리
- configuration/error/expired/access-denied/MFA 상태
- 중앙 RBAC, PostgreSQL RLS, MFA, redacted audit

---

## 3. 목표와 비목표

### 3.1 목표

1. 일반 사용자와 관리회사가 서로 다른 목적·문구·디자인의 진입 화면을 사용한다.
2. 일반 사용자 랜딩에서 로그인과 관리자 운영 언어를 완전히 제거한다.
3. `/admin`을 관리회사 설명과 인증 진입이 결합된 관리자 포털로 만든다.
4. 로그인한 관리자는 기존 서버 권한 판단으로 역할별 화면에 이동한다.
5. 공개 경로에서 관리자 Supabase Auth 갱신을 수행하지 않는다.
6. KO/EN, 모바일, 접근성, SEO와 기존 서비스 여정을 함께 보존한다.
7. 향후 `www.taptolk.com` 연결은 환경 설정만으로 가능하게 한다.

### 3.2 비목표

- 실제 `www.taptolk.com` DNS·Vercel 도메인 연결
- `admin.taptolk.com` 등 별도 관리자 host 도입
- Enterprise SAML/OIDC SSO
- 새로운 OAuth Provider 선택
- 가격·요금제·계약 자동화
- 도입 문의 폼
- 약관·개인정보처리방침의 법률 확정
- 실제 Kakao AlimTalk 발송
- Production Supabase·Secret·Cron·Vercel plan 설정
- Task 3 access grant/Test Lab/persona

---

## 4. 정보 구조와 라우팅

### 4.1 canonical URL

| 입력 URL | 동작 |
|---|---|
| `/` | locale cookie → `Accept-Language` 순서로 `/ko` 또는 `/en` redirect |
| `/admin` | 같은 locale 정책으로 `/ko/admin` 또는 `/en/admin` redirect |
| `/ko`, `/en` | 일반 사용자 랜딩 |
| `/ko/admin`, `/en/admin` | 관리자 포털 소개 또는 로그인 후 역할 라우팅 |
| `/{locale}/admin/login` | 기존 단일 관리자 로그인 |
| `/{locale}/admin/signup` | 이메일/Google 계정 가입 요청 |
| `/{locale}/admin/dashboard` | 승인된 고객 관리자 영역 |
| `/{locale}/admin/platform` | 승인된 플랫폼 관리자 영역 |

모든 사용자 노출 URL은 `/ko` 또는 `/en` locale segment를 유지한다.

### 4.2 `/[locale]/admin` 상태별 동작

| 서버 상태 | 결과 |
|---|---|
| UNAUTHENTICATED | 관리회사 대상 관리자 포털 소개 화면 렌더링 |
| CONFIGURATION_MISSING | 소개 화면 유지, 인증 CTA 비활성화, KO/EN 안내 |
| LOAD_ERROR | 사용자 이해 가능한 오류·재시도 상태 |
| ACCESS_DENIED | 기존 `/admin/access` |
| MFA_ENROLL_REQUIRED | 기존 `/admin/mfa/enroll` |
| MFA_CHALLENGE_REQUIRED | 기존 `/admin/mfa/challenge` |
| READY customer role | `/admin/dashboard` server redirect |
| READY platform role | `/admin/platform` server redirect |

역할은 browser query, local storage, user metadata, CTA 선택값으로 결정하지 않는다.

### 4.3 route group

URL을 변경하지 않고 다음 구조로 분리한다.

```text
apps/web/app/[locale]/
  (public)/
    page.tsx
    onboarding/
    q/
    c/
    activate/
    respond/
    owner/
    layout.tsx
  (admin)/
    admin/
      page.tsx
      login/
      signup/
      dashboard/
      platform/
      sites/
      qr-inventory/
      operations/
      access/
      mfa/
    layout.tsx
```

- route group 이동으로 기존 URL이 한 글자도 바뀌면 안 된다.
- public layout과 admin layout은 header, footer, metadata, cache/auth 정책을 공유하지 않는다.
- 관리 route는 기존 `no-store`와 인증 경계를 유지한다.
- 공개 QR·caller·Owner response 화면에 랜딩 header/footer를 강제로 씌우지 않는다.

### 4.4 typed URL boundary

- locale-aware public/admin route builder를 한 모듈에서 관리한다.
- React component에 절대 URL이나 `www.taptolk.com`을 하드코딩하지 않는다.
- 현재는 단일 host와 상대 경로가 기본이다.
- `APP_URL`, 공개 QR/Owner response base URL 등 기존 서버 환경 계약을 임의로 깨지 않는다.
- 실제 도메인 값은 사용자가 연결을 지시할 때만 설정한다.

---

## 5. Part P — 일반 사용자 랜딩

### 5.1 페이지 목적

일반 사용자가 첫 화면에서 다음을 이해해야 한다.

1. Taptolk는 차량 전화번호를 보여주는 서비스가 아니다.
2. 차량 QR을 스캔하면 필요한 차량 요청을 전달할 수 있다.
3. 차주는 Kakao AlimTalk의 Taptolk 링크로 요청을 확인하고 답한다.
4. caller는 같은 모바일 화면에서 답을 확인한다.
5. 완료·만료 시 임시 접근과 통신 콘텐츠가 정리된다.

개발, staging, Provider, Queue, RBAC, RLS, MFA, Cron 같은 내부 용어는 사용하지 않는다.

### 5.2 필수 섹션

#### P-1. Header

- immutable Taptolk logo
- KO/EN 전환
- `사용 방법` anchor
- `개인정보 보호` anchor
- `자주 묻는 질문` anchor
- 로그인·가입·관리자 링크 없음

#### P-2. Hero

의미 방향:

```text
차량에 연락이 필요할 때,
전화번호를 몰라도 괜찮습니다.

차량의 Taptolk QR을 스캔하면 전화번호를 서로 공개하지 않고
필요한 요청과 답변을 전달할 수 있습니다.
```

- 주 CTA는 `사용 방법 보기` anchor다.
- QR token 없이 요청을 시작하는 것처럼 보이는 CTA를 만들지 않는다.
- 앱 설치 또는 회원가입이 필요하다는 인상을 주지 않는다.

#### P-3. caller 사용 방법

1. 차량에 부착된 Taptolk QR 스캔
2. 차량 확인 후 필요한 요청 선택
3. 같은 화면에서 차주의 답변 확인

English copy에서는 `caller`를 유지한다.

#### P-4. 차주 사용 방법

1. 관리회사로부터 QR 스티커 수령
2. QR을 스캔해 자신의 차량에 활성화
3. 요청이 오면 Kakao AlimTalk의 Taptolk 링크 확인
4. Taptolk에서 빠른 답변 선택

AlimTalk 최종 템플릿 문구나 실제 발송 완료를 주장하지 않는다. 현재 live Provider가
연결되지 않았다는 내부 상태를 랜딩에 노출하지 않되, 구현되지 않은 실시간 기능을
과장하지 않는다.

#### P-5. 개인정보 보호

사용자 언어로 다음을 설명한다.

- caller와 차주의 전화번호를 서로 보여주지 않음
- 목적이 정해진 짧은 연락만 중계
- 요청 완료·만료 시 임시 접근 종료와 메시지 내용 정리
- 악의적·반복적 요청 통제

`완전 익명`, `추적 불가`, `100% 안전` 같은 보장 문구를 사용하지 않는다.

#### P-6. FAQ

최소 질문:

- 앱을 설치해야 하나요?
- 전화번호가 상대방에게 보이나요?
- QR이 없는 차량에도 요청할 수 있나요?
- 차주의 답변은 어디에서 확인하나요?
- 긴급 상황에서도 사용할 수 있나요?
- 반복적이거나 부적절한 요청은 어떻게 처리되나요?

긴급 상황은 관계 기관이나 관리사무소 등 적절한 수단을 사용해야 하며 Taptolk가 긴급
대응을 보장하지 않는다고 안내한다.

#### P-7. Footer

- Taptolk 설명 문구
- KO/EN 전환은 header에만 있어도 됨
- 로그인·관리자·가입 링크 없음
- 미구현 법적 문서 링크를 만들지 않는다.
- 약관·처리방침이 후속 작업으로 추가되면 해당 링크만 연결한다.

### 5.3 문구 규칙

- 모든 문구는 typed KO/EN dictionary에 둔다.
- page/component에 사용자 문구를 하드코딩하지 않는다.
- KO에서는 `익명`, `관리업체` 대신 `전화번호 공개 없이`, `관리회사`를 사용한다.
- EN에서는 `caller`를 유지한다.
- Taptolk를 메신저, 오픈채팅, 전화 서비스로 표현하지 않는다.
- Kakao Open Chat을 사용한다고 표현하지 않는다.
- 의미가 같은 KO/EN headline을 각각 자연스럽게 작성하고 줄 위치를 복사하지 않는다.

### 5.4 디자인 방향

- 모바일에서 QR을 스캔한 사용자가 읽기 쉬운 친근하고 명확한 인상
- 한 섹션에 한 가지 의미, 짧은 문단, 충분한 여백
- 운영 dashboard, 데이터 table, 관리자 권한 UI처럼 보이지 않게 함
- 실제 서비스 화면을 흉내 낸 가짜 interactive control 금지
- shared design token과 immutable logo 사용
- logo recolor/crop/filter/mask 금지
- `SemanticHeading`과 의미 단위 headline 사용
- 320, 768, 1280, 1920 CSS px에서 의미와 rhythm 검토

---

## 6. Part A — 관리회사 관리자 포털

### 6.1 페이지 목적

관리회사 담당자가 다음을 이해하고 로그인 또는 가입 요청으로 이동해야 한다.

1. Taptolk가 관리회사 운영에 어떤 문제를 해결하는가.
2. 계약 이후 QR이 생성·납품·배포·활성화되는 과정은 무엇인가.
3. 관리자가 어떤 운영 기능을 사용하는가.
4. 가입만으로 권한이 생기지 않고 승인이 필요하다는 점.

플랫폼 Super Admin 내부 운영 기능과 권한 구조를 영업 문구로 공개하지 않는다. 플랫폼
관리자는 같은 로그인 진입점을 사용하되 로그인 후 서버가 별도 platform 화면으로
라우팅한다.

### 6.2 필수 섹션

#### A-1. Admin header

- immutable Taptolk logo, admin portal context label
- 서비스 소개 anchor
- 운영 흐름 anchor
- 기능 anchor
- KO/EN 전환
- `로그인`과 `가입 요청` CTA
- logo는 일반 랜딩이 아니라 현재 locale의 `/admin`으로 연결

#### A-2. Hero

의미 방향:

```text
QR 발급부터 차량 연락 운영까지,
관리회사의 Taptolk 업무를 한곳에서 관리합니다.

스티커 발급·입고·배포·활성화와 차량 요청 운영 현황을
승인된 권한 범위 안에서 관리할 수 있습니다.
```

CTA:

- 주: `관리자 로그인`
- 보조: `관리자 계정 가입 요청`

#### A-3. 서비스 운영 흐름

1. Taptolk와 관리회사 계약
2. Site 등록과 QR Batch 요청·승인
3. Taptolk의 스티커 인쇄·납품
4. 관리회사의 입고 확인·재고 관리·배포 또는 차량 배정
5. 차주의 QR 활성화
6. 차량 연락 요청·답변·관리사무소 전달 운영
7. QR 교체·분실·폐기 이력과 운영 지표 확인

QR 수량은 per-Batch `1..100` 계약을 유지한다. 대량 1,000개를 단일 Batch로 표현하지
않는다.

#### A-4. 관리 기능

실제 구현된 범위만 설명한다.

- Site와 관리 범위
- QR 샘플 승인과 발급 진행 상태
- QR 재고·입고·배정·교체·폐기 이력
- 차주 활성화와 차량 연결
- 요청·응답·미해결·관리사무소 전달 현황
- 반복·악의 요청의 신고·차단
- 응답·미해결·알림 비용 등 운영 지표
- 역할·범위·MFA 기반 접근 통제와 주요 변경 감사

아직 구현되지 않은 계약 자동화, 결제, 실시간 위치, 음성 통화, 무제한 chat을 기능으로
표시하지 않는다.

#### A-5. 승인과 보안

사용자 언어로 다음을 설명한다.

- 계정을 만들면 승인 대기 상태가 됨
- 승인된 관리회사·Site 범위만 접근
- 중요한 관리자 역할은 추가 인증 필요
- 고객 관리자와 Taptolk 플랫폼 관리 화면은 분리
- 주요 운영 변경은 감사 가능한 상태 기록으로 남음

기술 구현 세부인 `RLS`, `AAL2`, JWT 같은 용어는 기본 소개 문구에 사용하지 않는다.

#### A-6. 인증 진입

- 로그인 페이지: 이메일·비밀번호 + `Google 계정으로 계속`
- 가입 페이지: 이메일·비밀번호 + `Google 계정으로 가입`
- 가입 화면에 승인 전 데이터 접근 불가 안내
- loading, configuration missing, OAuth unavailable, invalid credentials, expired session,
  approval pending, forbidden 상태를 KO/EN으로 제공

현재 OAuth callback과 서버 역할 라우팅을 재사용한다. 브라우저가 customer/platform을
선택하는 control을 다시 만들지 않는다.

#### A-7. Admin footer

- 일반 사용자 랜딩 footer와 별도
- 관리자 도움말·서비스 안내 문구
- 확정되지 않은 지원 이메일, 사업자 정보, 요금 링크를 만들지 않는다.
- 일반 랜딩으로 되돌아가는 링크는 기본 navigation에 노출하지 않는다. 필요하면
  접근성·브랜드 목적의 logo 동작도 `/admin` 내부로 제한한다.

### 6.3 디자인 방향

- 신뢰감 있고 정돈된 B2B 운영 제품 인상
- 일반 랜딩보다 정보 밀도는 높지만 실제 dashboard와 혼동되지 않는 소개 페이지
- lifecycle, 기능, 승인 경계를 card/step 형태로 설명
- 가짜 metric, 가짜 고객사 logo, 확정되지 않은 수치나 SLA 금지
- 관리 dashboard component를 소개 화면에 그대로 재사용하지 않는다.
- public landing과 font/token/logo는 공유할 수 있으나 header, navigation, section
  composition은 별도 component로 둔다.

---

## 7. 인증·보안·데이터 경계

### 7.1 공개 경로 인증 분리

`proxy.ts`는 locale resolution과 관리자 Supabase Auth 갱신을 분리한다.

- locale cookie와 `Accept-Language` 판단은 모든 사용자 경로에서 유지
- Supabase `getClaims()`는 typed admin path matcher를 통과한 경로에서만 실행
- `/`, `/ko`, `/en`, `/q`, `/c`, `/activate`, `/respond`, `/owner`, onboarding은 관리자
  claims 갱신 대상이 아님
- API authorization은 각 Route Handler의 기존 서버 경계를 유지
- matcher를 더 넓히지 않는다.

### 7.2 관리자 권한

- `/admin`을 아는 것, Google login 성공, email 확인은 business 권한이 아니다.
- 서버가 승인 profile, active membership, valid role/scope, MFA를 확인한다.
- 고객 관리자와 플랫폼 관리자의 화면·권한 경계를 합치지 않는다.
- 기존 중앙 RBAC와 PostgreSQL RLS를 모두 유지한다.
- shared URL, query parameter, browser metadata, `user_metadata`로 역할을 만들지 않는다.

### 7.3 로그와 비밀값

전화번호, 메시지, OTP, cookie, Authorization header, OAuth token, QR public token,
activation code, response token, Provider secret을 Git·문서·로그·스크린샷·테스트 출력에
남기지 않는다.

---

## 8. SEO와 검색 노출

### 8.1 일반 사용자 랜딩

- KO/EN별 title, description, Open Graph 기본 metadata
- `html lang` 정확성
- canonical URL은 typed configuration에서 생성하며 도메인 확정 전 하드코딩하지 않음
- 일반 랜딩은 index 가능
- sitemap에는 공개 랜딩만 포함하고 token route는 포함하지 않음

### 8.2 관리자 포털

- `/admin`, login, signup, MFA, dashboard, platform 등 전체 관리자 영역은 `noindex`
- 일반 sitemap에서 제외
- `noindex`는 보안 통제가 아니며 RBAC/RLS를 대체하지 않음

---

## 9. 구현 순서

### Step 0 — 변경 전 증거

- 현재 branch/commit/status 기록
- 기존 landing/admin/auth smoke와 WCJ baseline 확인
- 사용자 소유 untracked 문서 보존

### Step 1 — typed route/content 설계

- public/admin path 분류와 locale-aware route builder
- KO/EN typed dictionary key 설계
- public/admin metadata 계약

### Step 2 — route group과 proxy 분리

- `(public)` / `(admin)` layout
- URL 무변경 이동
- 공개 경로에서 `getClaims()`가 호출되지 않는 테스트
- 기존 admin `no-store`와 auth callback 유지

### Step 3 — 일반 사용자 랜딩

- admin/login/signup 링크 완전 제거
- P-1~P-7 구현
- 페이지·component 변경 직후 `pnpm validate:wcj`
- responsive/Axe/browser 증거

### Step 4 — 관리자 포털

- 비로그인 `/admin` 소개 화면
- 기존 로그인·가입 CTA와 상태 연결
- 로그인 이후 서버 역할별 redirect 유지
- 페이지·component 변경 직후 `pnpm validate:wcj`
- customer/platform authenticated staging E2E

### Step 5 — 회귀·문서·checkpoint

- linked pgTAP
- full authenticated staging E2E
- `pnpm verify`
- pilot readiness와 관련 PDCA/report 갱신
- 새 `docs/handoff-MMDD-HHmm.md`
- 공개 랜딩과 관리자 포털을 구분해 브라우저 검증 결과 기록

Part P와 Part A는 가능하면 별도 커밋으로 나눈다. route group/proxy 기반 변경은 먼저
독립 커밋해 회귀 원인을 분리한다. Production 배포·도메인 연결은 별도 사용자 지시가
있을 때만 수행한다.

---

## 10. 테스트 요구사항

### 10.1 정적·단위 테스트

- public/admin path classifier
- `/admin` locale redirect
- 일반 landing copy에 admin/login/signup key와 link가 없음
- admin metadata `noindex`
- public route에서 Supabase admin `getClaims()` 미호출
- admin route에서는 기존 session refresh 유지
- KO/EN dictionary key parity

### 10.2 브라우저 테스트

#### 일반 랜딩

- `/ko`, `/en` HTTP 200
- 로그인·가입·관리자 link/text 0
- caller·Owner 사용 방법, privacy, FAQ 존재
- keyboard navigation과 visible focus
- Axe violation 0
- 320/768/1280/1920 horizontal overflow 0
- 관리자 Supabase auth configuration이 없어도 소개 화면 렌더 가능

#### 관리자 포털

- `/admin` locale redirect
- 비로그인 `/ko/admin`, `/en/admin` 소개 화면
- 로그인·가입·Google CTA
- configuration missing/unavailable 상태
- Site Admin + MFA → customer dashboard
- Super Admin + MFA → platform dashboard
- Site Admin의 platform route 거부
- 승인 대기 계정의 운영 데이터 접근 0 유지
- keyboard/Axe/responsive

#### 기존 사용자 여정

- QR inspect/request/wait/reply/resolve
- Owner activation/PWA
- admin login/signup/MFA
- locale persistence
- 기존 URL 전부 무변경

### 10.3 필수 명령

```bash
pnpm validate:wcj
pnpm db:test:linked
pnpm e2e:staging
pnpm verify
pnpm verify:production-cron:deferred
```

웹 페이지나 component 변경 직후 `pnpm validate:wcj`를 실행한다. 마지막 verify 한 번으로
중간 WCJ 실행을 대체하지 않는다.

---

## 11. 수용 기준

### 11.1 일반 사용자 랜딩

- [ ] `/ko`, `/en`이 Taptolk 소개·caller/Owner 사용법·privacy·FAQ로 구성됨
- [ ] 로그인·가입·관리자 링크와 관리회사 운영 언어 0
- [ ] QR token 없이 요청을 시작하는 것처럼 보이는 control 0
- [ ] typed KO/EN dictionary, SemanticHeading, immutable logo 준수
- [ ] 공개 landing에서 관리자 Supabase Auth call 0
- [ ] indexable metadata, 관리자 영역과 분리된 layout
- [ ] WCJ 100, Axe 0, 320/768/1280/1920 overflow 0

### 11.2 관리자 포털

- [ ] 비로그인 `/ko/admin`, `/en/admin`에 관리회사 소개·운영 흐름·기능·승인 설명
- [ ] 이메일 login/signup과 Google OAuth CTA가 실제 기존 경로에 연결됨
- [ ] Enterprise SSO를 허위로 주장하지 않음
- [ ] 가입 즉시 권한이 생기지 않는다는 안내
- [ ] 로그인 이후 customer/platform 서버 라우팅과 MFA 경계 유지
- [ ] 일반 sitemap 제외 및 noindex
- [ ] 일반 landing에서 admin portal 링크 0
- [ ] WCJ 100, Axe 0, responsive PASS

### 11.3 전체 경계

- [ ] 기존 공개 QR/activation/response/admin URL 무변경
- [ ] 중앙 RBAC, PostgreSQL RLS, MFA, redacted audit 약화 없음
- [ ] QR 수량 1..100 per-Batch 유지
- [ ] EN `caller` 유지
- [ ] QR enum·action label 변경 없음
- [ ] Production Cron 활성 정의 0 유지
- [ ] linked pgTAP, authenticated staging E2E, `pnpm verify` PASS
- [ ] 구현 완료·자동 검증 완료·수동 검증 대기를 구분한 report/handoff

---

## 12. 사용자 승인·외부 대기 항목

Claude는 다음을 임의로 선택·생성·설정하지 않는다.

- `www.taptolk.com` DNS·Vercel 연결 시점
- Production Supabase 프로젝트와 리전
- Production Secret
- Kakao AlimTalk/CAPTCHA/Owner verification Provider
- Enterprise SSO Provider
- Vercel plan 변경
- Production Cron 활성화
- 모니터링·롤백·장애 대응 담당자
- 사업자 정보·법적 문서 시행일·개인정보 보호책임자

미확정 항목은 화면에서 숨기거나 fail-closed하며 가짜 값이나 임시 영업 문구를 넣지
않는다.

---

## 13. Claude 완료 보고 형식

### 구현 완료

- 일반 사용자 landing 변경
- 관리자 portal 변경
- route/layout/proxy/auth 경계
- KO/EN와 metadata

### 자동 검증 완료

- WCJ 점수와 파일 수
- unit/browser 테스트 수
- linked pgTAP 파일·테스트 수
- authenticated staging 역할별 결과
- `pnpm verify`
- GitHub Actions run

### 수동 검증 대기

- 실제 iOS/Android
- VoiceOver/TalkBack
- computed contrast
- 사용자 문구·디자인 최종 승인
- domain 연결

완료 후 pilot readiness checklist와 PDCA report를 갱신하고 새 handoff를 작성한다. Secret,
전화번호, 메시지, OTP, cookie, QR/activation/response token을 결과물에 남기지 않는다.

---

## 14. Claude 시작 프롬프트

```text
AGENTS.md와 docs/development/prd-public-user-admin-portals-0721.md를 읽고 이 PRD만 구현해.

먼저 현재 branch/commit/status와 사용자 소유 untracked 파일을 확인하고 보존해. 일반
사용자 landing과 관리회사 admin portal을 route/layout/auth 호출 경계까지 분리하되 기존
URL, canonical 단일 관리자 로그인, 서버 role routing, RBAC, RLS, MFA, 감사 경계를
유지해. 일반 landing에는 로그인·가입·관리자 링크를 노출하지 말고, 비로그인 /admin에는
관리회사 서비스 소개와 기존 이메일/Google login/signup 진입을 제공해.

웹 페이지·component 변경 직후 pnpm validate:wcj를 실행하고, linked pgTAP,
authenticated staging E2E와 pnpm verify를 통과시켜. Task 3, Test Lab, persona, live
AlimTalk Provider, Production 배포·domain·Secret·Cron·Vercel plan 설정은 시작하지 마.
완료 후 pilot checklist, PDCA report, 새 handoff를 작성하고 구현 완료/자동 검증 완료/수동
검증 대기를 구분해 보고해.
```
