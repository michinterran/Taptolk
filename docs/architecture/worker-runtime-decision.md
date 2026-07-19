# ADR-006 — Queue and Worker Runtime

> Date: 2026-07-19
> Status: Accepted for runtime class; Production host pending benchmark
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
- QR generation/render work is CPU/file intensive and may exceed a short web request.
- A Vercel Function is not a resident Queue consumer.

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

- Run `apps/worker` as a separately deployed Node.js 24 container for QR generation/render jobs.
- Do not use a resident Vercel Function, browser process, Next.js request lifecycle, or Supabase
  Edge Function as the generation consumer.
- The Worker polls Supabase Queue, validates the versioned payload, loads authoritative scope/state
  by `jobId`, claims a lease, invokes Application Services, persists checkpoints, and acknowledges
  only after commit.
- On `SIGTERM`, it stops claiming, completes or safely abandons the current transaction, and lets
  the lease/Queue visibility timeout recover unfinished work.
- Runtime secrets are server-only and least-privileged. Queue messages and logs contain no token,
  code, ciphertext, contact data, reason, storage path, cookie, authorization header, or provider
  credential.

### 2.4 Host selection

The runtime class is decided; the container vendor is not. Production host selection must compare
at least:

- Seoul or nearest supported region and Supabase latency
- Node 24 and native Sharp/PDF dependency support
- always-on versus scale-to-zero behavior
- graceful shutdown and maximum job duration
- concurrency and CPU/memory controls
- secret management, egress, logs/metrics, rollback, and cost

No provider manifest or new runtime dependency is added until the benchmark gate passes.

## 3. Delivery semantics

```text
approval transaction
→ job PENDING_DELIVERY
→ dispatcher lease
→ Supabase Queue publish
→ job QUEUED + Batch GENERATION_QUEUED
→ Worker lease/PROCESSING
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

Rejected because Vercel Functions are request/bounded invocation runtimes, not resident polling
workers. It also mixes web release scaling with generation throughput.

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
9. Container host, region, minimum/maximum concurrency, resource limits, deploy/rollback runbook,
   and secret ownership are approved.

Until these gates pass, only the Plan/Design and local contract remain approved. No document may
claim that Queue/Worker generation is operational.

## 6. Consequences

Positive:

- Approval cannot be committed without a durable handoff intent.
- Queue/provider outages are recoverable without lying about Batch failure.
- Web and Worker deployments scale independently.
- Duplicate delivery is an expected tested path.

Cost:

- Requires a dispatcher lease protocol, durable job ledger, recovery sweep, and container
  operations.
- Creates explicit operational metrics and runbooks before Production.
- Adds one deployment target after benchmark/provider approval.

## 7. Follow-up

- Implement only after
  `docs/02-design/features/qr-final-generation-approval.design.md` is approved for Do.
- Add versioned Queue payload schema and compatibility policy before first publish.
- Benchmark at least one realistic 1,000-item batch before choosing the Production container host.
- Revisit this ADR if measured jobs are short enough for a different bounded runtime, but do not
  silently change the runtime class inside implementation code.
