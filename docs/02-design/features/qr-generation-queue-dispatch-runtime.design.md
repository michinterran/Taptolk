# QR Generation Queue Dispatch Runtime — Design

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for Do
> Level: Dynamic
> Plan: `docs/01-plan/features/qr-generation-queue-dispatch-runtime.plan.md`

## 1. Design intent

This unit connects the existing provider-neutral QR dispatch pipeline to the real Supabase Queues
Data API while keeping runtime authority, credentials, policy, and delivery state separated.

The implementation remains staging-only. It does not create Queue infrastructure, deploy a
resident consumer, or perform QR generation. The existing PostgreSQL job ledger and dispatcher
RPCs remain authoritative.

## 2. Architecture

### 2.1 Dependency flow

```text
Vercel Cron / controlled staging request
  → GET /api/internal/qr-generation-dispatch
  → internal bearer authorization
  → staging-only runtime composition
  → BoundedQrGenerationDispatchRuntime
  → QrGenerationDispatchCoordinator
      ├── QrGenerationDispatcherService
      │   → @taptolk/db dispatcher RPC repository
      │   → public.claim_pending_qr_generation_jobs
      │   → public.record_qr_generation_job_published
      │   → public.record_qr_generation_delivery_failure
      └── @taptolk/db Supabase Queue publisher
          → pgmq_public.send
          → durable qr-generation Queue
```

The Route Handler reads no request-controlled policy values. It delegates authorization and
runtime composition, then maps a redacted result to HTTP.

### 2.2 Layer ownership

| Layer | Ownership |
|---|---|
| `@taptolk/config` | Parse and bound server-only Queue/runtime configuration |
| `@taptolk/application` | Bounded invocation loop, coordinator, retry policy, safe outcomes |
| `@taptolk/db` | Supabase Queue and dispatcher RPC provider adapters; no credential ownership |
| `apps/web/internal` | Staging guard, bearer authorization, admin-client composition, aggregate logging |
| Internal Route | HTTP status/headers and safe JSON response only |

No React component, browser bundle, or user-facing locale dictionary participates in this
internal delivery path.

## 3. Runtime configuration

The validated `ServerEnvironment` gains:

| Variable | Default | Bounds / contract |
|---|---:|---|
| `QR_GENERATION_QUEUE_NAME` | `qr-generation` | lowercase letters/numbers plus `_` or `-`, 1–63 |
| `QR_GENERATION_DISPATCH_CLAIM_LIMIT` | `10` | 1–50 |
| `QR_GENERATION_DISPATCH_LEASE_SECONDS` | `60` | 5–300 |
| `QR_GENERATION_DISPATCH_DURATION_BUDGET_MS` | `8000` | 1000–60000 |
| `QR_GENERATION_QUEUE_SEND_TIMEOUT_MS` | `3000` | 250–10000 and less than/equal to duration budget |
| `QR_GENERATION_DELIVERY_RETRY_BASE_DELAY_MS` | `5000` | 1000–24 hours |
| `QR_GENERATION_DELIVERY_RETRY_MAX_DELAY_MS` | `300000` | base–24 hours |
| `QR_GENERATION_DELIVERY_RETRY_JITTER_RATIO` | `0.2` | 0–0.5 |

`CRON_SECRET`, `SUPABASE_SECRET_KEY`, and the existing Supabase URL are required by runtime
composition even though they remain optional for unrelated local commands. The runtime rejects
every `APP_ENV` except `staging`.

The queue send delay is fixed at zero in the provider adapter. Delivery retry timing is owned by
the durable job ledger and Application retry policy, not by delayed Queue messages.

## 4. Provider adapter

### 4.1 Contract

`createSupabaseQrGenerationQueuePublisher(client, config)` implements
`QrGenerationQueuePublisher`.

```ts
type SupabaseQrGenerationQueuePublisherConfig = {
  queueName: string;
  requestTimeoutMs: number;
};
```

For each strict v1 message it calls:

```ts
client
  .schema("pgmq_public")
  .rpc("send", {
    queue_name: queueName,
    message,
    sleep_seconds: 0,
  })
  .abortSignal(AbortSignal.timeout(requestTimeoutMs));
```

Supabase documents `pgmq_public.send` as returning a set of `bigint`. The adapter accepts exactly
one positive decimal identifier from the response, normalizes it to a string, and rejects null,
empty, multiple, fractional, negative, object, or unsafe numeric responses.

### 4.2 Error reduction

| Provider evidence | Application error |
|---|---|
| Explicit `429`, `TOO_MANY_REQUESTS`, or recognized rate-limit message | `QUEUE_RATE_LIMITED` |
| Abort, network, missing Queue/schema, permission, malformed response, or unknown error | `QUEUE_UNAVAILABLE` |

Raw provider messages, hints, details, response bodies, and credentials are never rethrown or
logged.

## 5. Bounded Application runtime

### 5.1 Contract

```ts
type QrGenerationDispatchRuntimePolicy = {
  claimLimit: number;
  durationBudgetMs: number;
  leaseSeconds: number;
};

type QrGenerationDispatchRuntimeResult = {
  claimedCount: number;
  completedWithinBudget: boolean;
  outcomeCounts: Readonly<Record<QrGenerationDispatchOutcomeStatus, number>>;
};
```

`BoundedQrGenerationDispatchRuntime` receives the coordinator, validated policy, and injected
monotonic clock.

### 5.2 Algorithm

1. Record the invocation deadline.
2. Before each claim, stop if the duration budget is exhausted.
3. Call the coordinator with `limit: 1` and the fixed lease.
4. Stop when no eligible job is claimed.
5. Merge only aggregate outcome counts.
6. Repeat until `claimLimit` jobs have been claimed or the budget is exhausted.

Claiming one row at a time prevents the invocation from leasing rows it has already decided not to
publish. A provider call is independently bounded by `QR_GENERATION_QUEUE_SEND_TIMEOUT_MS`.
Database RPC timeouts remain an infrastructure-level follow-up; the finite claim limit prevents
an unbounded loop.

`completedWithinBudget=false` means the runtime stopped before reaching an empty Queue or the
claim cap because the next operation could not safely start. It is operational evidence, not a
Batch/job failure.

## 6. Internal authentication and HTTP

### 6.1 Authorization

The internal authorization module accepts exactly:

```text
Authorization: Bearer <CRON_SECRET>
```

It rejects absent, repeated/comma-joined, wrong-scheme, empty, or mismatched values using a
timing-safe comparison. Neither the supplied header nor the expected secret enters errors or logs.

### 6.2 Route

```text
GET /api/internal/qr-generation-dispatch
```

Responses:

| Status | Meaning | Body |
|---:|---|---|
| 200 | Invocation completed safely | aggregate counts and request ID |
| 401 | Missing/invalid bearer credential | safe `UNAUTHORIZED` code |
| 503 | Not staging or runtime configuration unavailable | safe `UNAVAILABLE` code |
| 500 | Reduced dispatch/runtime failure | safe `DISPATCH_FAILED` code |

All responses set `Cache-Control: no-store` and `X-Request-Id`. They contain no job/provider
identity. Logs contain the request ID, aggregate counts, and safe internal code only.

The Route exports `runtime = "nodejs"` and `dynamic = "force-dynamic"`. No Vercel schedule
manifest is added in this staging-only unit.

## 7. File changes

```text
.env.example
apps/web/package.json
apps/web/internal/cron-authorization.ts
apps/web/internal/cron-authorization.test.ts
apps/web/internal/qr-generation-dispatch-runtime.ts
apps/web/app/api/internal/qr-generation-dispatch/route.ts
packages/application/src/index.ts
packages/application/src/qr-generation-dispatch-runtime.ts
packages/application/src/qr-generation-dispatch-runtime.test.ts
packages/config/src/env.server.ts
packages/config/src/env.shared.ts
packages/config/src/env.test.ts
packages/db/package.json
packages/db/src/index.ts
packages/db/src/supabase-qr-generation-queue-publisher.ts
packages/db/src/supabase-qr-generation-queue-publisher.test.ts
turbo.json
```

Lockfile changes are expected only for direct workspace dependency ownership; no new external
version is introduced beyond the already approved Supabase SDK version.

## 8. Test plan

### 8.1 Configuration

- Defaults parse for local development without inventing credentials.
- Every numeric bound and cross-field timeout/retry relation is enforced.
- Queue-name validation rejects whitespace, uppercase, path characters, and excessive length.
- Browser environment output never gains any Queue/secret value.

### 8.2 Publisher

- Sends the exact strict v1 DTO to `pgmq_public.send`, zero delay, configured Queue.
- Converts the single positive bigint/string result to `queueMessageId`.
- Rejects malformed/multiple response values.
- Reduces explicit rate limiting and all unknown errors.
- Attaches a bounded abort signal.

### 8.3 Bounded runtime

- Processes at most the configured claim limit with `limit: 1`.
- Stops on an empty claim.
- Stops before another claim after duration exhaustion.
- Aggregates every coordinator outcome without exposing job IDs.
- Rejects invalid policy and clock values.

### 8.4 Internal boundary

- Bearer authorization accepts one exact secret and rejects malformed variants.
- Local and Production runtime composition fail closed before client use.
- Missing secure configuration returns safe unavailable behavior.
- Existing coordinator and cross-layer duplicate-safety tests remain green.

### 8.5 Repository gates

- `pnpm db:check` reports 22 migrations.
- `pnpm validate:wcj` passes after the internal Route change.
- `pnpm verify` passes.
- Docker reset/runtime pgTAP remains open and is reported separately.

## 9. Security and operational boundaries

- Supabase secret keys are server-only and bypass RLS; the runtime invokes only the three reviewed
  dispatcher RPCs plus `pgmq_public.send`.
- Queue tables/functions are never granted to browser roles by this unit.
- The Queue payload contains only the reviewed v1 allowlist.
- Request inputs cannot choose a Queue, Tenant, job, policy, or provider.
- Authorization headers, secrets, Queue messages, provider errors, and job identifiers are
  redacted from responses and logs.
- Live staging execution requires user-owned Queue enablement/creation and secure environment
  configuration. Code completion alone does not prove a live Queue journey.
- Production remains explicitly disabled pending Docker, staging failure injection, worker crash
  recovery, benchmarks, monitoring, and host approval.
