# qr-final-generation-approval - Plan

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for implementation
> Level: Dynamic

## 1. Purpose

샘플 승인이 대량 QR 생성을 암묵적으로 시작하지 않도록, 고객의 최종 승인 요청과
Super Admin의 대량 생성 승인을 별도 상태·권한·감사 경계로 고정한다.

이 기능은 승인 결과를 유실 없이 Queue 단계로 넘길 수 있는 durable handoff 계약까지
설계한다. 실제 Queue publish, Worker 실행, QR Asset·token 발행, 렌더링은 후속
구현이며 이번 Plan/Design checkpoint에서는 소스나 migration을 추가하지 않는다.

## 2. Background

`qr-inventory-sample-foundation`은 다음 상태와 필드를 이미 예약했다.

```text
SAMPLE_APPROVED
→ FINAL_APPROVAL_PENDING
→ GENERATION_APPROVED
→ GENERATION_QUEUED
```

현재 구현은 `SAMPLE_APPROVED`에서 멈춘다. 이 경계를 유지하지 않고 승인 Route에서
Queue를 직접 publish하면 DB 승인과 Queue 메시지 사이에 dual-write 유실이 생기며,
재요청 시 중복 생성도 발생할 수 있다. 따라서 최종 승인과 Queue 전달 의도를 같은
PostgreSQL transaction에 기록하고, 실제 publish는 별도 dispatcher가 처리해야 한다.

## 3. Goals

### 3.1 Primary goals

- `SAMPLE_APPROVED → FINAL_APPROVAL_PENDING → GENERATION_APPROVED` 두 command를
  명시적으로 분리한다.
- Batch requester와 final approver가 같을 수 없도록 Application policy와 PostgreSQL
  command에서 각각 검증한다.
- `GENERATION_APPROVED`는 Super Admin, active session, AAL2에서만 도달 가능하게 한다.
- 최종 승인과 durable Queue handoff intent를 같은 transaction에 기록한다.
- command retry, Queue redelivery, Worker retry가 중복 Asset·token·render를 만들지 않는
  idempotency identity를 고정한다.
- 실패·재시도·취소가 가능한 마지막 상태와 책임 주체를 구분한다.
- Queue/Worker 운영 runtime 선택과 배포 전 측정 gate를 ADR로 남긴다.

### 3.2 Non-goals

- Queue publisher, dispatcher, Worker polling loop 구현
- QR Asset, public token, human code, activation code 생성
- render job, SVG/PDF/CSV/ZIP 생성 또는 Storage write
- Batch progress/retry UI 및 generation command 구현
- Supabase migration, RPC, Application service, Route, React component 변경
- Worker provider 또는 Production host 연결
- `GENERATION_QUEUED` 이후의 전체 Phase 3 상태 전이 구현

## 4. Scope

### 4.1 In

- 두 단계 command와 권한·MFA·scope·optimistic version 계약
- final approval maker-checker와 redacted audit 계약
- generation handoff intent/outbox identity와 payload allowlist
- approval command와 handoff intent의 transaction 원자성
- Queue publish, delivery, Worker claim의 at-least-once/idempotent 경계
- 승인 전 취소, 승인 후 중단 요청, retryable failure, terminal failure 구분
- Queue/Worker runtime ADR와 운영 결정을 위한 측정 기준
- unit, DB integration, authenticated staging, failure-injection acceptance 설계

### 4.2 Out

- 이번 checkpoint의 실제 코드·DB·UI·Queue 변경
- Queue 메시지 안의 token, ciphertext, storage path, actor UUID, reason, payload 원문
- 브라우저의 service-role/Queue credential 접근
- 승인과 동시에 `GENERATION_QUEUED` 또는 `GENERATING`으로 건너뛰는 전이
- 고객 역할의 direct retry 또는 Super Admin 승인 우회
- 취소된/실패한 Batch, 승인, handoff, job 이력의 물리 삭제

## 5. Authority and maker-checker

| Action | Allowed actor | Required permission | Separation |
|---|---|---|---|
| Request final generation approval | Original Batch requester in active matching scope | `qr-batch:request` | Batch must still be requester-owned |
| Read final approval queue | Super Admin | `qr-batch:read` + `qr-batch:generation-approve` | Actor UUIDs remain hidden |
| Approve final generation | Super Admin at AAL2 | `qr-batch:generation-approve` | `auth.uid() <> requested_by` |
| Cancel before generation approval | Original Batch requester | `qr-batch:request` | Only through `FINAL_APPROVAL_PENDING` |
| Request retry after generation failure | Scoped customer admin | `qr-batch:retry-request` | No direct execution |
| Execute approved retry | Super Admin or Platform Operator per central catalog | `qr-batch:retry` | Separate reviewed command |

- Platform Operator, Management Admin, Site Admin, Site Operator, and Read Only cannot perform
  final generation approval.
- Final approver may have participated in sample review; the mandatory separation in this feature
  is from the original Batch requester. Expanding separation requires a later policy decision.
- Every command independently verifies Tenant, Management Company, Site, active parents, role
  scope, and the current approved Sample/Design version.

## 6. Frozen state and cancellation boundaries

### 6.1 Happy path

```text
SAMPLE_APPROVED
  -- original requester submits -->
FINAL_APPROVAL_PENDING
  -- independent Super Admin approves + durable handoff intent committed -->
GENERATION_APPROVED
  -- later dispatcher publishes and records provider message identity -->
GENERATION_QUEUED
```

- No command in this feature moves directly from `SAMPLE_APPROVED` to
  `GENERATION_APPROVED`.
- `GENERATION_APPROVED` means approval and durable handoff intent are committed. It does not claim
  that Queue publish or generation has begun.
- `GENERATION_QUEUED` is written only after the Queue provider accepts the message and the
  provider identity is durably recorded.

### 6.2 Cancellation

- The original requester may cancel in `SAMPLE_APPROVED` or `FINAL_APPROVAL_PENDING`; the Batch
  becomes terminal `CANCELLED` and all Design/Sample/approval history remains.
- Once `GENERATION_APPROVED` is committed, customer cancellation is rejected because a durable
  generation intent exists.
- After `GENERATION_APPROVED`, stopping work requires a separately audited platform abort command.
  That command and compensating behavior are Phase 3 design scope and are not implied by
  `cancel_qr_batch`.
- Queue redelivery or a late Worker attempt must treat a terminal cancellation/abort marker as a
  no-op before side effects.

### 6.3 Failure and retry

- Validation, authorization, stale version, or handoff-intent insert failure rolls back the entire
  approval transaction. The Batch remains `FINAL_APPROVAL_PENDING`.
- Queue publish failure leaves the durable handoff intent retryable and does not set Batch
  `FAILED`.
- Queue delivery is at least once. The same durable `job_id` is reused across provider publish
  retries and delivery attempts.
- A Worker claims a job by `job_id + batch_id + generation_revision`. Duplicate or stale claims
  return the stored outcome without repeating side effects.
- Retryable execution failures use exponential backoff with a typed/configured maximum of five
  execution attempts. Delivery retry counters remain separate. Limits do not live in React,
  Route, or provider adapter code.
- Exhausted execution before any Asset side effect produces terminal `FAILED`. Exhaustion after a
  committed partial side effect produces `PARTIALLY_COMPLETED`; it must not be flattened to
  `FAILED`.
- A customer may request retry, but only a platform-authorized reviewed command can create the
  next `generation_revision` and a new durable `job_id`. The original idempotency history remains
  immutable.

## 7. Idempotent handoff contract

- Final approval accepts `request_id` and `expected_batch_version`.
- Repeating the same `request_id` with the same normalized command returns the stored result.
  Reusing it with different input returns `CONFLICT`.
- The approval transaction writes:
  1. Batch `GENERATION_APPROVED`, approver and timestamp;
  2. one redacted audit row;
  3. one generation handoff intent with immutable `job_id`, `generation_revision = 1`, and
     `PENDING_DELIVERY` state.
- Unique keys cover both `(tenant_id, request_id)` and
  `(tenant_id, batch_id, generation_revision, job_type)`.
- Queue payload contains only internal IDs, `jobType`, revision, attempt, created time, and trace
  identity. It contains no public/activation token, ciphertext, human code, storage path, reason,
  user contact data, cookie, authorization header, or Queue credential.
- Publisher and Worker service credentials remain server-only and least-privileged.

## 8. Success criteria

- Plan/Design state, authority, transaction, payload, cancellation, retry, and failure contracts
  have no ambiguous owner.
- Super Admin self-approval of a Batch it originally requested is rejected.
- Non-Super roles cannot move a Batch to `GENERATION_APPROVED`.
- A failed transaction cannot leave an approved Batch without a durable handoff intent, or an
  intent without the approval/audit rows.
- Repeated approval, publish, delivery, claim, and retry requests cannot create duplicate
  generation revisions or side effects.
- Queue provider failure is distinguishable from terminal generation failure.
- Cancellation is allowed only before durable generation approval; later abort is a separate
  reviewed Phase 3 command.
- ADR states the interim runtime direction, rejected options, measurement gates, and conditions
  that block Production enablement.
- Review confirms that no Queue, Worker, renderer, Asset issuance, token generation, migration,
  Route, or UI code was implemented in this checkpoint.

## 9. Risks and mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Approval succeeds but Queue message is lost | Batch never generates | Transactional handoff intent/outbox; asynchronous publisher |
| Queue redelivery duplicates tokens/assets | Security and inventory corruption | Stable job identity, generation revision, DB unique constraints, idempotent claim |
| Super Admin approves own request | Governance bypass | Application and DB maker-checker checks |
| Provider outage marks business work failed | False terminal failure | Keep delivery state separate from Batch execution failure |
| Cancellation races Worker claim | Unwanted side effects | Row lock/lease plus terminal marker check before side effects |
| Partial generation is retried from zero | Duplicate assets | Persist checkpoints and use `PARTIALLY_COMPLETED` with resume contract |
| Vercel Function treated as resident consumer | Missed work and timeout | ADR forbids resident loop; measure batch drain or choose container worker |
| Retry values drift across layers | Inconsistent behavior | Typed server policy plus matching DB constraints/config validation |

## 10. Delivery order after approval

1. Review this Plan, Design, and Queue/Worker ADR.
2. Close the open Docker reset/runtime pgTAP gate when Docker is available.
3. Implement Domain/Application commands and unit tests without Queue provider connection.
4. Add migration, reviewed RPCs, handoff table, RLS/grants, audit, and pgTAP.
5. Add authenticated repository/actions and KO/EN approval queue UI; run WCJ.
6. Add dispatcher/Worker provider integration only after ADR measurement gates are satisfied.
7. Add issuance/render transaction boundaries and failure-injection E2E in a separate Phase 3
   implementation unit.

## 11. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` sections 3.1–3.2, 4.1–4.2, 6.2, 7.1, 8.8, 11.4,
  12.4–12.5, 14, 18.3, 25, Phase 3, ADR-002
- `docs/01-plan/features/qr-inventory-sample-foundation.plan.md`
- `docs/02-design/features/qr-inventory-sample-foundation.design.md`
- `docs/architecture/worker-runtime-decision.md`
- `docs/handoff-0719-1331.md`
