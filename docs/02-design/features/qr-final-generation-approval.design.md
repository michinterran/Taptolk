# qr-final-generation-approval - Design

> Version: 1.0.0 | Date: 2026-07-19 | Status: Implementation in progress — Application + DB slices
> Level: Dynamic
> Plan: `docs/01-plan/features/qr-final-generation-approval.plan.md`

## 1. Design outcome

최종 생성 승인을 두 command로 분리하고, Super Admin 승인 transaction이 Batch 상태,
redacted audit, durable generation job intent를 함께 commit하도록 설계한다. Queue
provider publish는 transaction 밖의 dispatcher가 수행한다.

이 문서는 다음을 승인 가능한 구현 계약으로 고정한다. 현재 Do 단계는
Application command/read-model과 PostgreSQL 승인·durable job intent까지 구현했으며,
Queue, Worker, Route, UI는 아직 구현하지 않는다.

```text
Customer final-approval request
→ Super Admin final approval
→ durable generation job intent
→ Queue dispatcher
→ separately deployed Node Worker
→ future issuance/render Application Service
```

## 2. Architecture

### 2.1 Command path

```text
Localized Admin UI
→ Server Action / Route Handler
→ QrFinalGenerationApprovalService
→ central RBAC + scope + MFA + maker-checker policy
→ authenticated reviewed PostgreSQL RPC
→ qr_batches + qr_generation_jobs + audit_logs in one transaction
```

- UI receives typed copy, DTOs, policy limits, and current-actor booleans.
- Route/Server Action normalizes transport data only.
- Application and PostgreSQL independently enforce authority, scope, state, optimistic version,
  active parents, approved Design/Sample, and maker-checker.
- Browser code receives no service-role client, Queue client, actor UUID, token field, storage
  location, reason, or provider identity.

### 2.2 Queue handoff path

```text
qr_generation_jobs.PENDING_DELIVERY
→ dispatcher claims bounded rows with a lease
→ publish stable job payload to Supabase Queue qr-generation
→ record queue message identity and Batch GENERATION_QUEUED
→ Worker receives at least once
→ Worker claims job/revision before side effects
→ Application Service performs one resumable generation step
→ commit checkpoint
→ acknowledge Queue delivery
```

- `qr_generation_jobs` is both the durable generation ledger and transactional outbox for this
  job type. A second generic outbox table is not introduced without a real cross-domain owner.
- Provider publish and PostgreSQL commit are not presented as one distributed transaction.
- If publish succeeds but acknowledgement persistence fails, dispatcher republishes the same
  `jobId`; duplicate delivery is expected and harmless.
- Queue acknowledgement occurs only after the relevant Application transaction commits.
- Exactly-once delivery is not claimed. Business side effects are idempotent under at-least-once
  delivery.

### 2.3 Runtime boundary

- Supabase Queues/pgmq remains the queue system required by the master specification.
- A bounded Vercel Cron/Function may dispatch pending job intents and perform recovery sweeps.
- QR generation/render consumption runs in `apps/worker` on a separately deployed Node 24
  container runtime; it is not a resident Vercel Function or Supabase Edge Function.
- Exact container host selection remains a deployment decision after benchmark evidence. This
  does not reopen the runtime-class decision.
- Full reasoning and production gates are in
  `docs/architecture/worker-runtime-decision.md`.

## 3. Roles and authorization

### 3.1 Commands

| Application command | Preconditions | Authorized actor |
|---|---|---|
| `requestFinalGenerationApproval` | `SAMPLE_APPROVED`, current Sample `APPROVED`, current Design `APPROVED`, active full scope | Original Batch requester with `qr-batch:request` |
| `approveFinalGeneration` | `FINAL_APPROVAL_PENDING`, no job for revision 1, same approved Sample/Design | Independent `SUPER_ADMIN` with AAL2 and `qr-batch:generation-approve` |
| `cancelBeforeGenerationApproval` | `SAMPLE_APPROVED` or `FINAL_APPROVAL_PENDING`, no durable generation job | Original Batch requester with `qr-batch:request` |
| `requestGenerationRetry` | future `FAILED` or `PARTIALLY_COMPLETED` reviewed result | Scoped role with `qr-batch:retry-request` |
| `approveGenerationRetry` | future pending retry request and resumable checkpoint | `SUPER_ADMIN` or `PLATFORM_OPERATOR` with `qr-batch:retry` |

### 3.2 Final maker-checker

- `generation_approved_by <> requested_by` is mandatory.
- The comparison uses verified `auth.uid()` in PostgreSQL and the trusted actor context in
  Application; no actor ID is accepted from form input.
- The approval RPC rejects non-Super roles even if a stale or forged client claims the permission.
- A Super Admin who originally requested the Batch cannot approve it.
- The final approver is not required to differ from the sample approver in version 1. Expanding
  this rule is a later governance change and must not silently appear in code.

## 4. State design

### 4.1 Batch state

```text
SAMPLE_APPROVED
  -- requestFinalGenerationApproval -->
FINAL_APPROVAL_PENDING
  -- approveFinalGeneration -->
GENERATION_APPROVED
  -- recordQueuePublished -->
GENERATION_QUEUED
```

Transition ownership:

| From | To | Owner | Meaning |
|---|---|---|---|
| `SAMPLE_APPROVED` | `FINAL_APPROVAL_PENDING` | Original requester | Customer asks for platform final review |
| `FINAL_APPROVAL_PENDING` | `GENERATION_APPROVED` | Independent Super Admin | Approval, audit, and durable job intent committed |
| `GENERATION_APPROVED` | `GENERATION_QUEUED` | Server-only dispatcher acknowledgement | Provider accepted stable job identity |

No UI or provider adapter may infer a later state. `GENERATION_APPROVED` does not mean queued;
`GENERATION_QUEUED` does not mean execution began.

### 4.2 Generation job state

```text
PENDING_DELIVERY
→ DELIVERY_LEASED
→ QUEUED
→ PROCESSING
→ RETRY_WAIT
→ PROCESSING
→ COMPLETED
```

Terminal/exception states:

```text
FAILED | ABORTED | PARTIALLY_COMPLETED
```

- Delivery lease expiry returns `DELIVERY_LEASED` to `PENDING_DELIVERY` or `RETRY_WAIT`.
- Queue publish failure affects job delivery state, not Batch execution failure.
- `FAILED` means attempts are exhausted before a committed partial output.
- `PARTIALLY_COMPLETED` means a committed generation checkpoint exists and a reviewed resume is
  required.
- `ABORTED` is reserved for the future platform abort command. Customer cancellation cannot write
  it after `GENERATION_APPROVED`.

### 4.3 Cancellation and race policy

- Before `GENERATION_APPROVED`, `cancelBeforeGenerationApproval` locks the Batch and confirms no
  generation job exists, then writes terminal `CANCELLED` plus audit.
- Approval and cancellation lock the same Batch row, so exactly one may commit.
- After a generation job exists, `cancelBeforeGenerationApproval` returns `CONFLICT`.
- A future abort command must set an abort marker under the job lock. Worker checks that marker
  after claim and before each side-effect boundary.
- Revoked approval, invalidated Sample, archived Design, or inactive Site prevents a pending final
  approval from completing. It does not physically delete history.

## 5. Data model

### 5.1 Existing `qr_batches` fields

The existing columns remain the Batch authority:

- `status`
- `requested_by`
- `sample_approved_by`, `sample_approved_at`
- `generation_approved_by`, `generation_approved_at`
- `cancelled_by`, `cancelled_at`
- `version`

Future migration must extend the guard trigger for the exact new transitions and must not loosen
identity, Site ownership, Design version, quantity, or idempotency immutability.

### 5.2 Planned `qr_generation_jobs`

| Field | Type | Contract |
|---|---|---|
| `id` | uuid | Stable `jobId`; generated server-side |
| `tenant_id` | uuid | Highest isolation boundary |
| `management_company_id` / `site_id` | uuid | Composite Batch scope |
| `qr_batch_id` | uuid | Composite Batch FK |
| `job_type` | enum/text | `QR_GENERATION` in first implementation |
| `generation_revision` | integer | Starts at 1; increases only through reviewed retry |
| `approval_request_id` | uuid | Approval command idempotency identity |
| `status` | enum | Frozen job state |
| `attempt_count` / `max_attempts` | integer | Server policy, default max 5 |
| `available_at` | timestamptz | Backoff eligibility |
| `lease_expires_at` | timestamptz nullable | Crash recovery |
| `queue_message_id` | text nullable | Provider acknowledgement; never exposed to browser |
| `processed_count` / `passed_count` / `failed_count` | integer | Durable checkpoint counters |
| `last_error_code` | text nullable | Allowlisted code only |
| lifecycle timestamps | timestamptz | approved/queued/started/completed/failed/aborted |
| `version` | integer | Optimistic concurrency |

Required uniqueness:

```text
unique (tenant_id, approval_request_id)
unique (tenant_id, qr_batch_id, generation_revision, job_type)
unique (tenant_id, id)
```

Required composite FK:

```text
(tenant_id, management_company_id, site_id, qr_batch_id)
→ qr_batches(tenant_id, management_company_id, site_id, id)
```

No update/delete grant is given to authenticated browser roles. Browser-accessible read uses a
redacted RPC/DTO or safe-column grant under RLS.

### 5.3 Audit

Each mutation writes an audit row in the same transaction with allowlisted metadata:

```json
{
  "batchStatus": "GENERATION_APPROVED",
  "batchVersion": 5,
  "generationRevision": 1,
  "jobStatus": "PENDING_DELIVERY"
}
```

Audit excludes actor UUID in browser output, request reason from JSON, Queue message identity,
provider response, payload, public/activation token, storage path, cookie, authorization header,
and credential material. The validated human reason stays in the dedicated audit reason column.

## 6. Application contracts

### 6.1 Repository interface

```ts
interface QrFinalGenerationApprovalRepository {
  requestFinalApproval(input: FinalApprovalRequestCommand): Promise<FinalApprovalResult>;
  approveFinalGeneration(input: FinalGenerationApprovalCommand): Promise<FinalApprovalResult>;
  cancelBeforeGenerationApproval(input: FinalApprovalCancellationCommand): Promise<FinalApprovalResult>;
  getBatchForCommand(batchId: string): Promise<FinalApprovalQueueItem | null>;
  getApprovalReadModel(): Promise<QrFinalGenerationApprovalReadModel>;
}
```

The implementation may split line length/types across files. The public contract owns normalized
UUIDs, expected versions, trimmed reasons, and request IDs; React and Route modules do not own
policy constants.

Command flow authorizes the actor's membership permission before repository access, then loads an
RLS-scoped authoritative Batch snapshot with `getBatchForCommand`. Application policy evaluates
requester ownership, current status, parent activation, approved Sample/Design, existing job, exact
resource scope, and optimistic version from that snapshot. Browser-supplied hidden booleans or
status strings are not command authority. The later PostgreSQL RPC independently locks and
revalidates the same invariants.

### 6.2 Command inputs

```ts
type FinalApprovalRequestCommand = {
  batchId: string;
  expectedBatchVersion: number;
  reason: string;
  requestId: string;
};

type FinalGenerationApprovalCommand = FinalApprovalRequestCommand;
```

- Tenant/Site/actor/role/AAL come only from authenticated server context.
- `requestId` is a UUID generated for the user intent. Identical normalized input returns the
  stored result; changed input with the same ID returns `CONFLICT`.
- Reason length follows the existing typed 3–500 policy unless a later approved common policy
  changes both Application and DB.

### 6.3 Read model

```ts
interface QrFinalGenerationApprovalReadModel {
  finalApprovalQueue: readonly FinalApprovalQueueItem[];
  requestableBatchIds: ReadonlySet<string>;
  cancellableBatchIds: ReadonlySet<string>;
}
```

- Queue items include Batch/Site/Design display DTOs, quantity, status, versions, and timestamps.
- They do not include requester or approver UUIDs. A scoped RPC returns
  `requestedByCurrentActor` and `canApproveByCurrentActor` booleans.
- Super Admin sees the bounded final approval queue. Customer roles see only RLS-scoped Batches
  and their own action eligibility.
- Stable sort is `created_at`, then `id`; first version is bounded to 100 rows with explicit
  truncation.

## 7. PostgreSQL command design

### 7.1 `request_qr_batch_final_approval`

Transaction steps:

1. Resolve verified actor and active membership; enforce AAL.
2. Lock Batch and verify `expected_batch_version`.
3. Verify actor equals immutable `requested_by` and has `qr-batch:request`.
4. Lock current Sample and Design; require `APPROVED`, matching full scope, and immutable versions.
5. Reject existing generation job or terminal/cancelled Batch.
6. Move Batch to `FINAL_APPROVAL_PENDING`, increment version, and write redacted audit.
7. Return safe DTO.

### 7.2 `approve_qr_batch_final_generation`

Transaction steps:

1. Resolve verified actor; require active `SUPER_ADMIN`, AAL2, and
   `qr-batch:generation-approve`.
2. Lock Batch and verify `FINAL_APPROVAL_PENDING`, expected version, active full scope,
   `auth.uid() <> requested_by`, and current approved Sample/Design.
3. Resolve `request_id` idempotently and reject mismatched reuse.
4. Insert exactly one `qr_generation_jobs` row with `generation_revision = 1` and
   `PENDING_DELIVERY`.
5. Move Batch to `GENERATION_APPROVED`; set approver/time and increment version.
6. Write redacted audit.
7. Return safe DTO including `generationRevision` and business status, never job/provider secrets.

All three writes commit or roll back together.

### 7.3 Server-only delivery functions

Planned functions are not granted to `authenticated`:

- `claim_pending_qr_generation_jobs(limit, lease_seconds)`
- `record_qr_generation_job_published(job_id, expected_version, queue_message_id)`
- `record_qr_generation_delivery_failure(job_id, expected_version, error_code, available_at)`

They require a dedicated least-privileged server/Worker role or an authenticated internal service
boundary. `PUBLIC`, `anon`, and browser `authenticated` execution are revoked. Provider calls do
not happen inside PostgreSQL functions.

The first dispatcher-only implementation uses `service_role` as the reviewed server boundary and
adds no Queue provider call:

- `claimPending({ limit, leaseSeconds })` accepts `limit` 1–50 and lease 5–300 seconds. It claims
  eligible `PENDING_DELIVERY`, `RETRY_WAIT`, or expired `DELIVERY_LEASED` rows with
  `FOR UPDATE SKIP LOCKED`, increments only `delivery_attempt_count`, and returns a redacted
  delivery DTO.
- `recordPublished({ jobId, expectedVersion, queueMessageId })` requires the active lease version
  and atomically moves the job to `QUEUED` and the Batch to `GENERATION_QUEUED`. The provider
  message ID is validated and stored but never returned to browser or customer DTOs.
- `recordDeliveryFailure({ jobId, expectedVersion, errorCode, availableAt })` requires the active
  lease version, stores only an allowlisted error code, clears the lease, and moves the job to
  `RETRY_WAIT`. The Batch remains `GENERATION_APPROVED`.
- An expired lease reclaim increments the optimistic version. A late acknowledgement from the
  previous lease therefore conflicts instead of overwriting the new lease.
- Final approval and pre-generation cancellation compete for the same Batch row lock. Both DB lock
  waits are limited to 3 seconds, and a `55P03` lock timeout is reduced to a retryable conflict so
  an outer request timeout cannot hide the winning commit behind a long loser wait.
- The Application service validates UUIDs, bounds, provider identifier shape, allowlisted error
  code shape, and a future retry time no more than 24 hours away. Exact backoff calculation remains
  operational configuration owned by the later dispatcher runtime.

The claim DTO contains only `jobId`, job type/status/version, Tenant/Site/Batch identity,
generation revision, delivery attempt count, and creation/lease timestamps. It excludes approval
request ID, actor identity, reason, provider identity, token material, storage metadata, and
arbitrary payload.

## 8. Queue payload

```json
{
  "schemaVersion": 1,
  "jobId": "uuid",
  "jobType": "QR_GENERATION",
  "tenantId": "uuid",
  "siteId": "uuid",
  "batchId": "uuid",
  "generationRevision": 1,
  "deliveryAttempt": 1,
  "createdAt": "ISO_DATE",
  "traceId": "uuid"
}
```

The v1 consumer schema is strict. An unknown version, job type, extra field, missing Site, delivery
attempt below 1, or generation revision below 1 is rejected before handler lookup. This ensures
token/code/contact data, reasons, storage paths, cookies, authorization headers, credentials, and
provider payloads cannot be smuggled through a structurally valid Queue message.

- The Application layer owns the typed Queue DTO and provider-neutral dispatch coordinator. The
  Worker imports that public contract and independently validates runtime input with strict Zod.
- The coordinator receives a publisher port and retry policy. It imports no Queue SDK, credential,
  Cron route, or resident Worker runtime.
- Publish success calls `recordPublished` with the active lease version and provider message ID.
- A typed publish failure stores only `QUEUE_RATE_LIMITED` or `QUEUE_UNAVAILABLE` and uses the
  injected retry policy to record `RETRY_WAIT`. Unknown errors reduce to `QUEUE_UNAVAILABLE`.
- If publish succeeds but acknowledgement persistence fails, the coordinator does not falsely
  record provider failure. The lease remains recoverable so expiry can republish the same stable
  `jobId`.
- If delivery-failure acknowledgement also fails, the lease remains recoverable. Bounded results
  expose only job ID and a safe outcome status.
- Delivery retry timing is an injected Application policy with validated base delay, maximum
  delay, and jitter ratio. It uses the delivery-attempt counter, exponential growth, a 24-hour
  absolute ceiling, bounded symmetric jitter, and injected clock/random sources for deterministic
  testing. No Route, React component, provider adapter, or Queue payload owns retry values.
- `@taptolk/db` owns the server-only RPC repository adapter for the dispatcher Application port.
  It accepts an injected RPC client, calls only the three reviewed service-role functions, maps
  responses into allowlisted DTOs, reduces database errors to safe categories, and never owns or
  reads credentials. Runtime composition remains outside the package.
- Worker does not trust Tenant/Site IDs in the payload as authorization. It loads the job by
  `jobId`, verifies the stored Batch relationship, and treats payload scope as consistency input.
- No reason, user identity, actor UUID, contact data, token material, storage metadata, HTML/SVG,
  provider credential, or arbitrary JSON enters the Queue.

## 9. Retry and idempotency

### 9.1 Layers

| Layer | Stable identity | Duplicate behavior |
|---|---|---|
| Final approval command | `(tenant_id, request_id)` | Return stored result or conflict on changed input |
| Generation revision | `(tenant_id, batch_id, revision, job_type)` | One durable job |
| Queue publish | `job_id` | Same payload may be delivered more than once |
| Worker claim | `job_id + revision + version/lease` | One active lease; completed returns no-op |
| QR issuance | future deterministic ordinal under job revision | DB unique constraints reject duplicates |
| Render output | `qr_asset_id + sticker_design_id + version` | Reuse stored output/checksum |

### 9.2 Attempts

- Default maximum is five and lives in validated server configuration/application policy.
- Backoff is exponential with bounded jitter; exact schedule is an operational config, not a UI
  promise.
- Delivery retries and generation attempts are recorded separately so Queue outage does not
  consume business-execution attempts.
- Error code is allowlisted and redacted. Raw provider responses, SQL payloads, SVG, token values,
  and stack-local secrets are never stored in the job row.

### 9.3 Reviewed retry

- Exhausted `FAILED`/`PARTIALLY_COMPLETED` jobs are not automatically replayed forever.
- Customer retry request records intent only.
- Platform approval creates `generation_revision + 1` with a new `job_id`, pointing to the last
  safe checkpoint. It never mutates or reuses the exhausted job.
- `PARTIALLY_COMPLETED` resumes missing ordinals; it does not regenerate committed QR Assets from
  zero.

## 10. Errors and observable states

| Error class | Examples | Retry behavior |
|---|---|---|
| `VALIDATION` | malformed ID/version/reason | User corrects input |
| `FORBIDDEN` | role, scope, MFA, self-approval | No automatic retry |
| `CONFLICT` | stale version, cancelled Batch, duplicate/mismatched request ID | Reload state |
| `BLOCKED` | inactive parent, invalidated Sample, archived Design, failed QA | Resolve prerequisite |
| `UNAVAILABLE` | temporary repository/provider failure | Safe command retry with same request ID |

Dispatcher/Worker structured logs include operation, stable internal job ID, attempt, duration,
safe status, and allowlisted error code. They exclude all values prohibited by `AGENTS.md`.

## 11. Planned UI and i18n

Canonical surface remains `/{locale}/admin/qr-inventory`.

- Customer view: “최종 생성 승인 요청” is available only on eligible `SAMPLE_APPROVED` Batches.
- Pending view states that generation has not started.
- Super Admin view has a separate bounded final approval queue and explicit quantity/Site/Design
  confirmation.
- Approval success states “승인 및 생성 작업 준비 완료”; it does not claim queued/generated.
- Dispatcher states distinguish approval committed, Queue delivery waiting, queued, processing,
  retry waiting, partial completion, failure, and completion.
- KO/EN copy ships together in the typed dictionary.
- Reasons and IDs are not placed in redirect query strings.
- Web implementation must use `SemanticHeading`, language-aware wrapping, no-wrap controls, and run
  `pnpm validate:wcj` after each page/component change.

## 12. Test plan

### 12.1 Unit

- role/permission/MFA matrix for request, approve, cancel, retry request, retry approval
- requester-only transition to pending
- Super Admin-only final approval and requester self-approval denial
- state/version/Sample/Design/parent checks
- idempotent same-request replay and mismatched reuse conflict
- redacted read-model queue and current-actor booleans
- cancellation/approval race decision
- retry revision and checkpoint rules
- Queue payload allowlist/schema validation

### 12.2 Database

- composite Tenant/Company/Site/Batch FK and RLS
- authenticated safe-column read only; no direct mutation
- definer functions deny `PUBLIC`/`anon` and browser delivery access
- approval transaction rollback leaves no partial Batch/job/audit state
- unique approval request and generation revision under concurrency
- cancellation and approval row-lock race
- job lease expiry/reclaim and stale version rejection
- append-only approval/job/audit history
- terminal cancellation prevents job creation

### 12.3 Authenticated staging

1. Original requester moves its `SAMPLE_APPROVED` Batch to `FINAL_APPROVAL_PENDING`.
2. Another customer actor and Platform Operator fail final approval.
3. Requesting Super Admin fails self-approval.
4. Independent AAL2 Super Admin approves; exactly one job intent and one audit row exist.
5. Repeated identical approval returns the same revision; changed replay conflicts.
6. Cross-tenant and sibling-Site tampering fail.
7. Cancellation wins one forced race and approval wins another; no split state appears.
8. Cleanup returns Auth/profile/membership/tenant/business/audit/job residue to `0`.

### 12.4 Queue/Worker failure injection

- DB commit failure before publish creates neither approval nor job.
- Provider unavailable retains `PENDING_DELIVERY`/`RETRY_WAIT`; Batch is not `FAILED`.
- Provider success plus acknowledgement DB failure causes safe duplicate delivery.
- Worker crash before commit retries the same job.
- Worker crash after commit sees the stored checkpoint and no-ops/restarts from the next ordinal.
- Lease expiry permits one recovery claimant.
- Five exhausted attempts produce `FAILED` or `PARTIALLY_COMPLETED` according to committed output.
- Late delivery after abort/cancellation marker performs no side effect.
- 1,000-item acceptance proves duplicate token/Asset count `0`, QR decode `100%`, interruption
  resume, and duplicate-job safety before Phase 3 completion.

## 13. Implementation files

Implemented in the current Application, DB, and Web approval units:

- `apps/worker/src/queue-consumer.ts`
- `apps/worker/src/queue-consumer.test.ts`
- `packages/application/src/qr-generation-dispatch-coordinator.ts`
- `packages/application/src/qr-generation-dispatch-coordinator.test.ts`
- `packages/application/src/qr-generation-delivery-retry-policy.ts`
- `packages/application/src/qr-generation-delivery-retry-policy.test.ts`
- `packages/db/src/qr-generation-dispatcher-rpc-repository.ts`
- `packages/db/src/qr-generation-dispatcher-rpc-repository.test.ts`
- `packages/application/src/qr-final-generation-approval-service.ts`
- `packages/application/src/qr-final-generation-approval-service.test.ts`
- `packages/application/src/index.ts`
- `packages/db/src/schema/tenant-admin.ts`
- `packages/db/src/schema/index.ts`
- `supabase/migrations/20260719050000_qr_final_generation_approval.sql`
- `supabase/tests/database/qr_final_generation_approval.sql`
- `apps/web/admin/supabase-qr-final-generation-approval-repository.ts`
- `apps/web/admin/qr-final-generation-approval-actions.ts`
- `apps/web/app/[locale]/admin/qr-inventory/page.tsx`
- `apps/web/components/qr-inventory-sample-view.tsx`
- `apps/web/content/messages.ts`
- `e2e/staging/qr-inventory-sample.spec.ts`
- `e2e/staging/staging-fixture.ts`

Still planned:

- `packages/domain/src/admin-permission-catalog.ts` only if permission semantics change
- `apps/worker/src/jobs/qr-generation.ts`

New packages such as `qr-engine` or `sticker-renderer` require a concrete owner, public API, tests,
and actual Phase 3 use. Empty placeholder packages remain forbidden.

## 14. Release gates

Before implementation completion may be reported:

- Docker Supabase Local `db reset` and runtime pgTAP pass
- `pnpm validate:wcj` after web changes
- `pnpm verify`
- Desktop/Mobile smoke
- authenticated Staging approval/isolation/race E2E
- Queue/Worker failure-injection suite
- ADR benchmark and Production runtime gates
- manual keyboard, screen-reader, computed contrast, responsive, and real-journey review

The Application, DB, and Web approval units do not satisfy those full implementation gates. Do
remains active until the explicitly approved remaining layers are implemented and verified. The
migration is applied to staging, the authenticated requester-to-Super-Admin journey passes with
zero fixture residue, and `pnpm verify` passes. Docker-local reset/runtime pgTAP,
approval-cancellation race coverage, Queue/Worker failure injection, and manual assistive and
responsive review remain open.

## 15. Review checklist

- [x] Two approval transitions have distinct actors and meanings.
- [x] Super Admin authority and requester separation are explicit.
- [x] Approval/job/audit atomicity avoids lost handoff intent.
- [x] At-least-once Queue delivery does not claim exactly-once execution.
- [x] Publish failure, execution failure, partial completion, cancellation, abort, and retry differ.
- [x] Queue payload and logs satisfy the secret/PII prohibition.
- [x] Runtime class and Production benchmark gates are recorded in an ADR.
- [x] Current DB slice remains provider-, Queue-, Worker-, renderer-, Asset-, and token-free.
- [x] Current UI distinguishes requested, approved/prepared, queued, and generated meanings.
