# Completion Report: admin-auth-mfa-foundation

> Date: 2026-07-18 | Phase: 1

## 1. 결과

Supabase SSR 세션을 기반으로 관리자 신원을 검증하고, 활성 프로필·멤버십·역할과
MFA AAL을 서버에서 판정하는 Auth foundation을 구현했다. KO/EN 로그인, TOTP 등록,
챌린지, 접근 거부, 플랫폼/테넌트 진입 화면을 포함한다.

이 완료는 소스와 비인증 브라우저 상태의 acceptance다. 실제 `taptolk-staging`
사용자의 Email/Password→TOTP→AAL2 journey를 아직 증명하지 않았으므로 Phase 1
전체 완료로 판정하지 않는다.

## 2. 구현 항목

- [x] Supabase SSR cookie client와 Proxy의 `getClaims()` session refresh
- [x] active `admin_profiles`와 `admin_memberships` 서버 조회
- [x] 여러 membership의 권한을 합치지 않는 단일 active context 선택
- [x] privileged role의 verified TOTP와 AAL2 강제
- [x] KO/EN Email/Password 로그인
- [x] TOTP QR·수동 설정 키 등록과 6자리 코드 검증
- [x] 플랫폼 역할과 테넌트 역할의 서버 route 분리
- [x] Admin route `force-dynamic` 캐시 금지
- [x] 원본 Taptolk 로고 byte 보존
- [x] WCJ, lint, typecheck, unit, secret, logo, build 검증

## 3. 보안 경계

```text
Verified Supabase JWT
→ Active Admin Profile
→ One Active Membership Context
→ Role MFA Policy
→ AAL2 or Deny/Enroll/Challenge
→ Role-specific Admin Route
```

- 브라우저가 role, tenant, site 또는 AAL을 주장할 수 없다.
- MFA action은 active admin decision을 다시 확인하고 현재 session 소유 factor만
  challenge한다.
- TOTP secret과 QR은 URL·로그·저장소에 기록하지 않고 등록 세션 화면에만 반환한다.
- Supabase Secret Key는 이 로그인/MFA UI에 사용하지 않는다.

## 4. 검증

| 검증 | 결과 |
|---|---|
| Biome | 통과 |
| TypeScript | 10 workspace packages 통과 |
| Vitest | 10 files / 38 tests 통과 |
| WCJ | W/C/J 100/100/100 |
| Secret scan | 통과 |
| Logo integrity | 통과 |
| Next production build | Admin Auth/MFA route 포함 통과 |
| Browser | KO/EN·axe·320px 비인증 상태 통과 |

## 5. 실연결 게이트

다음 작업 전에 사용자가 Supabase/Vercel 화면에 직접 설정할 항목은 아래와 같다.
값은 채팅이나 저장소에 붙여 넣지 않는다.

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Supabase Auth의 Site URL과 허용 Redirect URL
4. 최초 Auth user와 동일 UUID의 ACTIVE `admin_profiles`
5. PLATFORM scope의 ACTIVE `SUPER_ADMIN` membership

`SUPABASE_SECRET_KEY`는 브라우저 환경에 넣지 않는다. 최초 관리자 bootstrap을
자동화할 때만 별도의 서버 전용 provisioning 경계에서 사용한다.

## 6. 다음 개발 순서

1. Staging 공개 Auth 환경변수와 최초 Super Admin bootstrap
2. 실제 로그인→TOTP 등록→AAL2→`/admin/platform` acceptance
3. tenant-scoped Site repository와 API
4. KO/EN Site CRUD UI
5. 서로 다른 tenant 계정으로 isolation E2E
6. MFA recovery와 Admin idle timeout 운영 정책
