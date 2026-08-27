# Completion Report: admin-registration-tenant-catalog

> Date: 2026-07-18 | Phase: 1

## 1. 결과

KO/EN 관리자 계정 생성 화면에 이메일/비밀번호와 Google SSO 두 경로를 구현했다.
Supabase Auth identity 생성과 관리자 권한 부여를 분리했으므로 신규 계정은 active
profile과 membership 승인 전까지 관리 데이터에 접근하지 못한다.

다음 기능으로 Super Admin Tenant Catalog를 application service와 RLS-backed
repository로 연결했다. 현재 staging에는 tenant가 없어 정상적인 empty state를
표시한다. 생성·수정 mutation은 동일 transaction audit 경계가 준비될 때까지 열지
않았다.

## 2. 구현 항목

- [x] 이메일 가입 입력 검증과 12자 이상 비밀번호 정책
- [x] Supabase `signUp`과 이메일 확인 PKCE callback
- [x] Google OAuth 시작과 PKCE callback code exchange
- [x] 가입/로그인 흐름별 안전한 고정 callback route
- [x] 신규 Auth identity의 권한 자동 부여 금지
- [x] KO/EN 로그인·가입 문구와 의미 기반 heading lines
- [x] Desktop/Mobile axe·320px browser acceptance
- [x] `tenant:read` application permission과 PLATFORM scope 강제
- [x] authenticated Supabase repository와 PostgreSQL RLS 이중 통제
- [x] server pagination과 deterministic ordering
- [x] Super Admin dashboard에서 Tenant Catalog 진입

## 3. 보안 경계

```text
Email signup or Google OAuth
→ Supabase Auth identity
→ No automatic admin profile/membership
→ Existing server authorization decision
→ Access pending until approved
→ MFA AAL2
→ Platform permission
→ Tenant Catalog service
→ PostgreSQL RLS
```

- OAuth `redirectTo`는 `APP_URL`에서 생성한 고정 callback만 사용한다.
- callback은 locale과 flow allowlist, PKCE code exchange만 처리한다.
- Google Client Secret과 provider token을 앱 코드·로그·환경변수에 저장하지 않는다.
- Tenant 목록은 UI가 Supabase table을 직접 호출하지 않고
  UI → page → application service → repository 경계를 따른다.
- 미승인 Auth user RLS 시뮬레이션에서 active membership과 tenant 모두 0건이었다.

## 4. 검증

| 검증 | 결과 |
|---|---|
| Biome | 통과 |
| TypeScript | 10 workspace packages 통과 |
| Vitest | 12 files / 48 tests 통과 |
| WCJ | W/C/J 100/100/100 |
| Playwright | Desktop/Mobile 20 tests 통과 |
| axe | 가입·로그인 포함 위반 0건 |
| Staging RLS | Super Admin active membership 2건, 미승인 user 0건 |
| Staging tenant | 현재 0건, empty state 대상 |

## 5. 외부 설정 게이트

Google SSO 실계정 acceptance에는 사용자가 Google Cloud와 Supabase Dashboard에서
Client ID/Secret 및 redirect URL을 연결해야 한다. 세부 순서는
`docs/deployment/google-sso-staging-setup.md`를 따른다.

Security Advisor에는 Leaked Password Protection 비활성 경고 1건이 있다. 현재 구현
오류는 아니지만 이메일 가입을 운영에 열기 전 사용 가능한 요금제에서 활성화한다.

## 6. 다음 개발 순서

1. Google Cloud/Supabase staging provider 연결
2. 이메일 가입·Google 가입의 실제 신규 계정 access-pending acceptance
3. 관리자 profile/membership 승인 mutation과 동일 transaction audit
4. Tenant 생성/상태 변경 command와 감사 로그
5. Tenant-scoped Site repository/API와 KO/EN CRUD UI
6. 서로 다른 tenant 계정의 authenticated isolation E2E
