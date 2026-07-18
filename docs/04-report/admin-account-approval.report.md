# Completion Report: admin-account-approval

> Date: 2026-07-19 | Phase: 1

## 1. 결과

이메일 또는 Google SSO로 생성된 Auth identity를 관리자 권한과 분리한 상태로 유지하고,
기존 `SUPER_ADMIN`이 역할과 운영 범위를 검토해 승인하거나 거절하는 가입 승인 센터를
구현했다.

승인은 UI가 테이블을 직접 변경하지 않는다. Server Action, Application Service,
Domain Policy, authenticated RPC를 거쳐 단일 PostgreSQL transaction에서 profile,
membership, audit를 함께 반영한다. 거절은 Auth identity를 삭제하지 않고 `CLOSED`
profile과 redacted audit를 남긴다.

## 2. 구현 항목

- [x] 서버 전용 Supabase Secret Key client
- [x] 최대 1,000명 bounded Auth directory scan
- [x] 미승인 또는 `INVITED` 계정만 포함하는 승인 큐
- [x] `membership:approve-account` Super Admin permission
- [x] 역할과 PLATFORM/TENANT/MANAGEMENT_COMPANY/SITE scope 조합 검증
- [x] 활성 tenant/company/site 계층 관계의 DB 재검증
- [x] 승인 profile + membership + audit 원자적 command
- [x] 거절 profile + invited membership revoke + audit 원자적 command
- [x] 자기 계정 승인·거절 차단
- [x] KO/EN 승인 센터와 의미 기반 제목 줄 구성
- [x] empty/configuration/success/error/conflict 상태
- [x] desktop/mobile 반응형과 폼 레이블 연결
- [x] Super Admin Platform Console 내비게이션 연결

## 3. 보안 경계

```text
Auth user directory
→ server-only Secret Key client
→ bounded pending-account read model
→ Super Admin review
→ Application permission + role/scope validation
→ authenticated RPC
→ DB auth.uid + AAL2 + active PLATFORM SUPER_ADMIN recheck
→ atomic profile + membership + redacted audit
```

- `SUPABASE_SECRET_KEY`는 서버 모듈에서만 읽으며 값은 코드·로그·문서에 기록하지 않는다.
- Auth `user_metadata`는 표시 이름 제안에만 사용하고 권한 판단에는 사용하지 않는다.
- Secret client는 Auth directory에만 사용하며 profile 상태는 AAL2 Super Admin RLS로
  조회한다.
- 익명 역할은 승인·거절 RPC 실행 권한이 없다.
- RPC는 고정 `search_path=pg_catalog`를 사용한다.
- 승인 사유는 감사 로그에 남지만 이메일과 provider는 감사 payload에 저장하지 않는다.
- AAL1 세션은 DB 함수에서 다시 거절된다.
- 테스트 승인 transaction은 검증 후 rollback하여 실제 대기 계정을 변경하지 않았다.

## 4. Staging 검증

| 검증 | 결과 |
|---|---|
| 마이그레이션 | `phase_1_admin_account_approval` 적용 |
| 승인 대기 계정 | 1건 유지 |
| 활성 Super Admin | 2건 |
| 익명 RPC 실행 | 차단 |
| AAL1 승인 | `MFA_REQUIRED`로 차단 |
| AAL2 Super Admin 승인 | profile/membership/audit 각 1건 원자적 생성 확인 후 rollback |
| 잔존 테스트 데이터 | 0건 |

## 5. Supabase Advisor

Security Advisor는 authenticated 역할이 호출 가능한 `SECURITY DEFINER` RPC 2개를
의도된 경고로 표시한다. 이 RPC는 브라우저 직접 mutation을 막고 원자적 감사 기록을
수행하기 위한 command boundary이며, 익명 실행 차단, AAL2, 활성 PLATFORM
`SUPER_ADMIN`, 자기 작업 차단, scope 계층 검증을 함수 내부에서 다시 적용한다.

별도로 Auth의 Leaked Password Protection이 비활성 상태다. 이메일 가입을 Production에
열기 전 Supabase Dashboard에서 활성화해야 한다.

## 6. 품질 검증

| 검증 | 결과 |
|---|---|
| Biome | 138 files 통과 |
| TypeScript | 10 workspace packages 통과 |
| Vitest | 14 files / 57 tests 통과 |
| WCJ | W/C/J 100/100/100 |
| Production build | `/[locale]/admin/platform/access` 포함 통과 |
| Playwright | Desktop/Mobile 22 tests 통과 |
| 실제 로그인 브라우저 | KO/EN, 대기 1건, form label, 안전한 기본 역할 확인 |

## 7. 다음 개발 순서

1. 사용자가 대기 Google 계정의 역할을 확정하고 실제 승인 실행
2. 승인된 계정의 역할별 console 진입 확인
3. Tenant 생성·수정·상태 변경 command와 감사 로그
4. Tenant-scoped Site repository/API와 KO/EN CRUD UI
5. 서로 다른 tenant 계정의 authenticated isolation E2E
