# Phase 5 Owner Activation Completion Report

- 완료일: 2026-07-20
- 브랜치: `codex/phase-1-foundation`
- 기준: `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`
- Plan: `docs/01-plan/features/owner-activation.plan.md`
- Design: `docs/02-design/features/owner-activation.design.md`
- Analysis: `docs/03-analysis/owner-activation.analysis.md`

## 구현 완료

- QR 공개 토큰 확인, activation code, 차량번호, 휴대전화 OTP, 동의, 활성화 완료의
  KO/EN 실제 여정
- Owner, device, Vehicle 관계, OTP challenge, one-time proof, hash-only session 데이터 모델
- QR/code/proof/Binding/Vehicle/Owner를 잠그는 service-only 원자적 activation RPC
- QR `ACTIVE`, activation code `USED`, proof `CONSUMED`, Owner session cookie 동시 commit
- Owner 전용 masked vehicle read model과 `/ko|en/owner` PWA shell
- 고정 OTP 제한, 동일 QR 동시 활성화 충돌, redacted audit, tenant/site isolation
- service-only bounded staging fixture와 정확한 cleanup

## 변경 영역

- `packages/domain`: Owner activation과 OTP 정책
- `packages/application`: activation orchestration과 DTO/repository/provider 계약
- `packages/db`: Owner schema와 복합 FK
- `apps/web/owner`, `apps/web/app/api/owner`: crypto/provider/repository/runtime/API
- `apps/web/app/[locale]/activate`, `apps/web/app/[locale]/owner`: KO/EN journey
- `supabase/migrations/2026071914*.sql`: Phase 5 schema/RPC/fixture/cleanup
- `supabase/tests/database/phase_5_owner_activation.sql`: linked pgTAP
- `e2e/staging/owner-activation.spec.ts`: actual staging owner journey

## DB Migration

- `20260719140000_phase_5_owner_activation.sql`
- `20260719141000_phase_5_owner_activation_staging_fixture.sql`
- `20260719142000_phase_5_owner_activation_cleanup_order.sql`

세 migration은 linked `taptolk-staging`에 적용했고 로컬/원격 migration history가
일치한다. Docker가 없어 local reset은 실행하지 못했지만 전체 linked pgTAP chain을
통과했다.

## 테스트

| Gate | 결과 |
|---|---|
| Phase 5 linked pgTAP | 43/43 PASS |
| Full linked pgTAP | 전체 file PASS |
| Authenticated staging E2E | 21 passed / 1 expected skip |
| Owner staging E2E | 2/2 PASS |
| 동시 activation | 1×200, 1×409, duplicate row 0 |
| Owner/Auth fixture cleanup | residue 0 |
| Axe | violation 0 |
| Keyboard | 첫 초점 activation code PASS |
| Responsive | 320/768/1280/1920 overflow 0 |
| WCJ | 100 / C100 / J100 / W100 |
| `pnpm verify` | PASS |

## 보안 확인

- raw phone, OTP, activation code, public QR token, proof, session token을 DB lookup column,
  audit, 문서, 테스트 artifact, 로그에 남기지 않았다.
- browser가 service-role credential, DB client, encryption/HMAC key, provider secret을
  import하지 않는다.
- Owner table은 RLS enable/force와 service-only privilege를 적용했다.
- HttpOnly/SameSite owner cookie와 same-origin/no-store Route 정책을 적용했다.
- audit payload에는 상태와 내부 관계 ID만 기록하고 민감 key 검사를 통과했다.

## 미완료·리스크

- 실제 국내 SMS provider 연결과 실패/재시도는 Phase 7 범위다.
- 실제 screen reader, 대표 iOS/Android, 85mm 물리 인쇄 검증은 Phase 9 pilot gate다.
- Docker local reset은 환경 제약으로 미실행이며 linked staging pgTAP이 실행 증거다.

## 다음 작업

Phase 6 Public Contact를 별도 Plan/Design으로 시작한다. Public QR ACTIVE 확인, 차량
뒷자리 확인, reason/제한된 message, anonymous recovery cookie, Contact Session 생성,
owner 정보 비노출, 3초 polling과 재접속 복구를 우선 구현한다.
