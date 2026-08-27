# admin-account-approval - Plan

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for implementation
> Phase: 1 · Tenant/Admin

## 1. Purpose

이메일 또는 Google SSO로 생성된 Supabase Auth 계정을 관리자 권한과 분리한 상태로
유지하면서, 기존 `SUPER_ADMIN`이 역할과 운영 범위를 검토해 승인하거나 거절할 수
있는 가입 승인 센터를 구현한다.

## 2. Journey

```text
신규 사용자 인증
→ Auth identity만 생성
→ 승인 대기 화면
→ Super Admin 가입 승인 센터
→ 역할·scope·표시 이름·사유 검토
→ Application Service 권한 검사
→ 단일 DB transaction으로 profile + membership + audit 반영
→ 승인된 사용자의 다음 로그인에서 역할별 console 진입
```

## 3. Scope

- 서버 전용 Secret Key 기반 Auth 사용자 목록 조회
- 미승인 사용자만 반환하는 bounded repository
- `SUPER_ADMIN` 전용 승인·거절 permission
- 역할과 scope 조합의 Domain 검증
- 승인 시 `admin_profiles`, `admin_memberships`, `audit_logs` 원자적 반영
- 거절 시 `CLOSED` profile과 redacted audit 반영
- KO/EN 승인 센터, empty/configuration/success/error 상태
- WCJ, Unit, DB policy, E2E 검증

## 4. Security gates

- `SUPABASE_SECRET_KEY`는 서버 모듈에서만 읽고 브라우저 bundle에 포함하지 않는다.
- `user_metadata`는 권한 판단에 사용하지 않는다.
- mutation RPC는 AAL2 `SUPER_ADMIN`과 PLATFORM membership을 DB에서 다시 확인한다.
- 대상 이메일과 provider는 화면 식별용으로만 사용하고 audit payload에 저장하지 않는다.
- 자기 계정 승인·거절은 금지한다.
- 역할과 tenant/company/site scope는 Application과 DB constraint가 각각 검증한다.

## 5. Acceptance

- 미승인 Google 사용자가 승인 목록에 나타난다.
- Platform 역할은 customer scope 없이 승인된다.
- customer 역할은 유효한 tenant/company/site 조합이 없으면 거부된다.
- 승인 후 profile/membership/audit가 모두 존재하거나 모두 rollback된다.
- 거절 사용자는 목록에서 제외되고 관리 권한을 얻지 못한다.
- Platform Operator와 customer role은 승인 endpoint를 실행할 수 없다.
- Secret Key가 없으면 안전한 configuration state를 표시한다.
- KO/EN, keyboard, mobile 320px, axe와 WCJ가 통과한다.
