# Google SSO Staging Setup

- 대상: Supabase `taptolk-staging`
- Project ref: `evpwzjkhfppdjivkyokh`
- 원칙: Google Client Secret은 Supabase Dashboard에만 입력하고 채팅, Git,
  `.env.local`, Vercel의 `NEXT_PUBLIC_*` 변수에 저장하지 않는다.

## 1. 애플리케이션 콜백

Taptolk는 Supabase Auth의 PKCE code를 아래 서버 Route에서 session으로 교환한다.

```text
Local app callback:
http://localhost:3000/api/admin/auth/callback

Google OAuth redirect URI:
https://evpwzjkhfppdjivkyokh.supabase.co/auth/v1/callback
```

두 URL의 용도는 다르다. Google Cloud에는 Supabase callback을 등록하고,
Supabase Auth의 Redirect URLs에는 Taptolk app callback을 등록한다.

## 2. Google Cloud 설정

1. Google Auth Platform에서 staging 전용 또는 승인된 개발 프로젝트를 선택한다.
2. Branding에서 앱 이름, 지원 이메일, 개발자 연락처를 입력한다.
3. Audience를 External로 선택하고 테스트 단계라면 허용할 Test user만 등록한다.
4. Data Access는 기본 인증 scope인 `openid`, `email`, `profile`만 사용한다.
5. OAuth Client를 `Web application`으로 생성한다.
6. Authorized JavaScript origins에 `http://localhost:3000`을 등록한다.
7. Authorized redirect URIs에 아래 주소를 정확히 등록한다.

```text
https://evpwzjkhfppdjivkyokh.supabase.co/auth/v1/callback
```

8. 발급된 Client ID와 Client Secret을 안전한 일회성 작업 화면에서만 사용한다.

## 3. Supabase Auth 설정

1. Dashboard → Authentication → Providers → Google로 이동한다.
2. Google provider를 활성화한다.
3. Google Cloud의 Client ID와 Client Secret을 직접 입력하고 저장한다.
4. Authentication → URL Configuration으로 이동한다.
5. Local 검증 중 Site URL은 `http://localhost:3000`으로 설정한다.
6. Redirect URLs에 아래 주소를 추가한다.

```text
http://localhost:3000/api/admin/auth/callback
```

Vercel Preview가 준비되면 Preview origin의 동일 callback을 별도로 추가한다.
운영 도메인 wildcard를 staging에 넓게 허용하지 않는다.

## 4. Taptolk 환경변수

Local `apps/web/.env.local`에는 다음 공개 설정과 app origin만 둔다.

```text
APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://evpwzjkhfppdjivkyokh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging publishable key>
```

Google Client Secret은 Taptolk 환경변수에 넣지 않는다.

## 5. Acceptance

1. `/ko/admin/signup`에서 이메일 가입 후 확인 메일 callback을 통과한다.
2. 새 사용자는 Auth identity만 생성되고 `/ko/admin/access`로 이동한다.
3. `/ko/admin/signup`에서 Google 가입 후 같은 접근 대기 상태를 확인한다.
4. 플랫폼 관리자가 별도 승인 절차로 active profile과 membership을 연결한다.
5. 승인된 관리자만 MFA를 완료한 뒤 역할별 console에 진입한다.
6. KO/EN 전환, 로그아웃, 재로그인과 다른 tenant 데이터 0건을 확인한다.

## 6. 운영 전 보안 항목

- Supabase Security Advisor의 Leaked Password Protection을 사용 가능한 요금제에서
  활성화한다.
- Google OAuth consent screen을 Production으로 전환하기 전에 도메인·개인정보처리방침·
  지원 연락처를 검토한다.
- Google provider token은 현재 제품에서 저장하거나 업무 API 호출에 사용하지 않는다.
- 계정 생성은 관리자 권한 부여가 아니며, profile과 membership의 승인 감사 로그를
  별도 보안 mutation으로 남긴다.
