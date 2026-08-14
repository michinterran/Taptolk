# ADR-006 — Queue and Worker Runtime

> Date: 2026-07-19
> Status: Accepted for bounded Vercel staging pilot; Production runtime pending benchmark
> Owners: QR Issuance / Platform Operations

## 1. Context

The master specification requires Supabase Queues/pgmq, a separate Worker, resumable QR
generation, and duplicate-safe jobs. `apps/worker` currently owns only Queue payload validation,
handler registration, structured logging, health, and graceful shutdown contracts.

Final generation approval adds the first durable handoff into Phase 3. Approval, Queue publish,
and generation cannot be treated as one distributed transaction:

- PostgreSQL approval may commit while provider publish fails.
- Provider publish may succeed while the acknowledgement write fails.
- Queue delivery is at least once.
- QR generation/render work is CPU/file intensive and may exceed one bounded invocation.
- A Vercel Function is not a resident polling consumer, but Vercel Queues can now invoke a
  bounded push consumer and retry it durably.

## 2. Decision

### 2.1 Queue and durable source of truth

- Use Supabase Queues/pgmq as required by `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`.
- Store a durable `qr_generation_jobs` intent in the same PostgreSQL transaction as final approval
  and audit.
- Treat the database job ledger as business truth. Queue messages are delivery signals, not the
  only record that work exists.
- Publish a stable, minimal `jobId` payload. Expect duplicate publish/delivery and make claims and
  side effects idempotent.

### 2.2 Dispatcher

- A bounded Vercel Cron/Node Function may claim and publish pending generation intents.
- Each invocation uses fixed batch size, duration budget, lease expiry, and validated concurrency.
- It never loops indefinitely and never performs QR token issuance or rendering.
- Recovery sweeps reclaim expired delivery leases and republish with the same `jobId`.

### 2.3 Generation consumer

- Keep Supabase Queues/pgmq as the required durable work queue and database job ledger as business
  truth.
- In staging, enqueue a redacted Vercel Queue pipeline trigger before the final approval mutation.
  The trigger uses the approval request ID as an idempotency key and a short delivery delay. A
  rejected approval therefore leaves only a bounded no-op trigger, while an accepted approval
  cannot commit without an already-durable wake signal.
- A Vercel Queue push Function runs the bounded dispatcher and then consumes at most one Supabase
  Queue message. It validates the versioned pgmq payload, loads authoritative scope/state by
  `jobId`, invokes Application Services, persists 50-item checkpoints, and archives pgmq only
  after commit.
- The Function and pgmq visibility budget are both bounded at 300 seconds on the current Vercel
  Hobby staging project. Function timeout or a retry result leaves pgmq unarchived; Vercel Queue
  redelivery resumes from committed checkpoints.
- Do not run an infinite polling loop inside a Vercel Function. The standalone Node.js 24 worker
  remains available for local acceptance and as a Production fallback until the benchmark gate
  selects the final runtime.
- Runtime secrets are server-only and least-privileged. Queue messages and logs contain no token,
  code, ciphertext, contact data, reason, storage path, cookie, authorization header, or provider
  credential.

### 2.4 Host selection

The bounded Vercel push Function is selected for the staging pilot because it reuses the current
project's Preview secrets and needs no additional vendor. Production runtime selection still must
compare at least:

- Seoul or nearest supported region and Supabase latency
- Node 24 and native Sharp/PDF dependency support
- always-on versus scale-to-zero behavior
- graceful shutdown and maximum job duration
- concurrency and CPU/memory controls
- secret management, egress, logs/metrics, rollback, and cost

Do not add a non-Vercel container provider unless the benchmark proves the bounded Vercel runtime
cannot satisfy the acceptance gates and the operator approves that provider.

## 3. Delivery semantics

```text
Vercel Queue pipeline trigger (delayed, idempotent)
→ approval transaction
→ job PENDING_DELIVERY
→ dispatcher lease
→ Supabase Queue publish
→ job QUEUED + Batch GENERATION_QUEUED
→ bounded Vercel Function pgmq consume/PROCESSING
→ checkpointed Application transaction
→ Queue acknowledgement
```

- Delivery is at least once; exactly-once is not claimed.
- Initial generation uses revision 1. Reviewed retry creates revision `n + 1` and a new `jobId`.
- Publish retries reuse the same `jobId`; they do not create a new generation revision.
- Delivery and execution attempt counters remain separate.
- Default maximum execution attempts are five with bounded exponential backoff and jitter.
- Provider delivery failure does not set Batch `FAILED`.
- Exhausted execution becomes `FAILED` before side effects or `PARTIALLY_COMPLETED` after committed
  partial output.
- Dead-letter behavior is a durable failed job plus an operator queue. Queue-provider DLQ alone is
  not sufficient business history.

## 4. Alternatives rejected

### 4.1 Publish directly in the approval Route/RPC

Rejected because PostgreSQL and Queue provider acknowledgement cannot be committed atomically.
Direct publish creates lost-job or duplicate-job gaps.

### 4.2 Long-running Vercel Function consumer

An infinite or resident Vercel Function poller remains rejected because Functions are bounded
invocations. This does not reject the Vercel Queue push Function pilot: each invocation performs
one bounded pgmq iteration, relies on durable redelivery, and resumes from database checkpoints.

### 4.3 Supabase Edge Function generation

Rejected for the generation/render consumer because the approved stack is Node 24 and the work
depends on Node/native image/PDF libraries. A short orchestration function does not solve the
durable consumer requirement.

### 4.4 Browser-triggered generation

Rejected because browser retries, disconnects, tenant input, and exposed credentials cannot be an
authority or durability boundary.

### 4.5 Queue message as the only job record

Rejected because provider delivery state cannot preserve approval audit, retries, partial
checkpoints, or operator recovery as the business source of truth.

## 5. Production acceptance gates

Before Production generation is enabled:

1. Docker Supabase Local reset and runtime pgTAP pass.
2. Staging proves approval/job/audit atomicity and Tenant isolation.
3. Failure injection proves publish-success/ack-failure duplicate safety.
4. Worker crash before and after commit resumes without duplicate side effects.
5. Lease expiry and graceful shutdown recovery pass.
6. A 1,000-item run proves token/Asset duplicate count `0`, QR decode `100%`, interruption resume,
   retry safety, and bounded memory/disk use.
7. Benchmark records p50/p95 job/chunk duration, Queue lag, DB connections, CPU, memory, temporary
   disk, error rate, and cost estimate.
8. Alerts cover oldest pending intent, Queue lag, expired leases, repeated retries, terminal
   failures, partial completion, and cleanup failure.
9. Runtime host, region, minimum/maximum concurrency, resource limits, deploy/rollback runbook,
   and secret ownership are approved.

Until these gates pass, only the Plan/Design and local contract remain approved. No document may
claim that Queue/Worker generation is operational.

## 6. Consequences

Positive:

- Approval cannot be committed without a durable handoff intent.
- Queue/provider outages are recoverable without lying about Batch failure.
- Queue delivery and bounded worker invocations scale independently from UI requests.
- Duplicate delivery is an expected tested path.

Cost:

- Requires a dispatcher lease protocol, durable job ledger, Vercel Queue trigger, and bounded
  retry observability.
- Creates explicit operational metrics and runbooks before Production.
- May still add one deployment target if the Production benchmark rejects bounded Vercel compute.

## 7. Follow-up

- Implement only after
  `docs/02-design/features/qr-final-generation-approval.design.md` is approved for Do.
- Add versioned Queue payload schema and compatibility policy before first publish.
- Benchmark at least one realistic 1,000-item batch before choosing the Production runtime host.
- Revisit this ADR if measured jobs are short enough for a different bounded runtime, but do not
  silently change the runtime class inside implementation code.
