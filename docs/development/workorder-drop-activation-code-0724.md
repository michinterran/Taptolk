# Codex 작업지시 — 활성화 코드 제거 (2026-07-24)

**운영자 확정:** 차주 활성화에서 **활성화 코드 입력을 없앤다.** 스티커를 가진 것이
자격이고, 잘못 등록된 스티커는 **폐기·재발급**으로 되돌린다(`qr-asset:revoke`).

**디자인은 이미 반영됐다.** `apps/web/components/owner-activation-view.tsx`가 코드를
묻지 않고 `complete` 요청에 `activationCode`를 싣지 않는다.

## 🔴 지금 상태 — 활성화가 완료되지 않는다

서버가 아직 코드를 필수로 요구하므로 `/api/owner/activation/complete`가
`VALIDATION`으로 400을 돌려준다. **아래 작업이 끝나야 차주 활성화가 다시 동작한다.**

## 왜 없애기로 했나

- 승인된 실물 스티커(`docs/design-canon/pwa/sticker-physical.png`)에 **코드를 인쇄할
  자리가 없다.** 그래서 차주가 코드를 어디서 받는지 정의된 적이 없다
- 코드를 스티커와 **같은 봉투로** 전달하면 둘이 함께 움직이므로 보안 이득이 거의 없다.
  다른 경로(문자 등)로 보내야 의미가 있는데, 그건 관리사무소 절차와 발송 화면이
  새로 필요하다
- 이미 있는 방어로 충분하다고 판단했다: **휴대폰 OTP 인증**, **폐기·재발급**,
  그리고 활성 스티커를 스캔하면 등록이 아니라 연락 요청 화면이 뜬다는 점

## 해야 할 것

### 1. 라우트 스키마

`apps/web/owner/owner-activation-route.ts` — `completeSchema`에서 `activationCode` 제거.

### 2. 서비스·리포지터리

`packages/application/src/owner-activation-service.ts`와
`apps/web/owner/supabase-owner-activation-repository.ts`에서 `activationCodeHash` 경로 제거.

### 3. RPC — `complete_owner_activation`

`supabase/migrations/20260719140000_phase_5_owner_activation.sql` §528~712 기준:

- 입력 검증에서 `activation_code_hash` 요구 제거
- `qr_activation_codes` 조회·검증 블록 제거
- **§710의 코드 `USED` 처리는 남긴다.** 그 자산에 발급된 코드가 있으면 활성화 시점에
  소진 처리해서, 나중에 코드를 되살릴 때 이미 쓰인 코드가 유효하게 남지 않도록 한다

**새 마이그레이션 파일로 한다.** 기존 파일을 고치지 않는다.

### 4. 테이블·워커는 그대로 둔다

`qr_activation_codes`를 지우지 않고, 워커의 코드 발급도 멈추지 않는다. 이유:

- 발급을 멈추면 `qr-generation-handler`와 QR 생성 인수 테스트까지 건드리게 된다
- 코드는 나중에 **지원·복구 수단**(관리사무소가 수동으로 확인)으로 쓸 여지가 있다
- 되돌리는 비용이 낮게 유지된다

### 5. E2E

`e2e/staging/owner-activation.spec.ts`가 `활성화 코드` 입력칸을 기다린다(149~163행).
그 단계를 빼고, `provision_owner_activation_staging_fixture`의 코드 인자는 픽스처
호환을 위해 남겨도 된다. 271행의 `qr_activation_codes` 정리 검증은 유지한다.

### 6. pgTAP

`supabase/tests/database/phase_5_owner_activation.sql` — 코드 검증 실패 케이스를
빼고, **"코드 없이도 활성화가 성공한다"**를 새로 추가한다.

## 완료 판정

- `/api/owner/activation/complete`가 `activationCode` 없이 200
- `qr_bindings`·`owners`·`vehicles`가 이전과 동일하게 기록된다
- `corepack pnpm verify` 통과, staging E2E 통과
