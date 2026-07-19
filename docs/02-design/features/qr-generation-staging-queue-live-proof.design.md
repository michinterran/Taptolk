# QR Generation Staging Queue Live Proof — Design

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved; Do blocked by external Queue setup
> Level: Dynamic
> Plan: `docs/01-plan/features/qr-generation-staging-queue-live-proof.plan.md`

## 1. Design intent

Prove the already-implemented publisher against a real durable Supabase Queue without introducing
a Queue consumer or generation side effects. The proof extends the existing isolated staging QR
journey so the durable application job, Queue message, and provider acknowledgement share one
fixture identity and are all removed afterward.

The Queue is a staging infrastructure dependency, not a browser feature. The Data API schema is
exposed only because the server-side Supabase client publishes through `pgmq_public`; browser
roles retain no access.

## 2. Current-state evidence

Read-only SQL against `taptolk-staging` (`evpwzjkhfppdjivkyokh`) returned:

```json
{
  "pgmqExtensionInstalled": false,
  "pgmqPublicSchemaExists": false,
  "queueTables": [],
  "queueFunctions": [],
  "queueTableRoleGrants": []
}
```

Therefore the live proof must not be implemented or reported as passing before the external
Dashboard setup below is complete.

## 3. Infrastructure design

### 3.1 Queue

| Setting | Value |
|---|---|
| Project | `taptolk-staging` only |
| Queue name | `qr-generation` |
| Queue type | Basic / durable logged Queue |
| Message delay | `0` |
| Data API wrapper | `pgmq_public` enabled |
| Browser use | prohibited |

Creating the Queue through the current Supabase Queues Dashboard module is preferred for this
first proof because Supabase owns the managed wrapper schema/functions. Do not hand-copy
`pgmq_public` function definitions into a project migration.

### 3.2 Role privileges

Queue settings must resolve to:

| Role | Select | Insert | Update | Delete | Purpose |
|---|---:|---:|---:|---:|---|
| `anon` | no | no | no | no | no Queue access |
| `authenticated` | no | no | no | no | no browser Queue access |
| `service_role` | yes | yes | yes | yes | staging publisher plus proof read/delete |
| `postgres` | yes | yes | yes | yes | managed administration |

The runtime publisher only needs send privileges (`Select` + `Insert`). The temporary live-proof
test also reads and deletes its own message (`Update` + `Delete`). A later dedicated Worker role
should replace broad service-role consumer access after its own Plan/Design.

`PUBLIC` execute on relevant `pgmq_public` functions must not provide an effective path around
these table privileges. Verification checks effective function and table privileges for
`PUBLIC`, `anon`, `authenticated`, and `service_role`.

### 3.3 RLS

- Enable RLS on the active table created for `qr-generation`.
- Do not add `anon` or `authenticated` policies.
- `service_role` remains a backend-only bypass-RLS role.
- Re-run the Supabase security advisor and specifically require absence of
  `0019_insecure_queue_exposed_in_api`.
- Do not infer safety from RLS alone; table and function privileges remain independently checked.

## 4. Secure environment

The existing staging environment must provide:

- `APP_ENV=staging`
- `NEXT_PUBLIC_SUPABASE_URL` matching the linked staging ref
- `SUPABASE_SECRET_KEY` through the server environment only
- `CRON_SECRET` through the server environment only
- Queue/runtime variables from the approved dispatcher Design, or their validated defaults

The test runner already refuses a Supabase hostname that differs from
`supabase/.temp/project-ref`. Extend the staging environment loader to require `CRON_SECRET` for
the Queue live-proof path without printing or returning it in diagnostics.

## 5. E2E design

### 5.1 Existing journey reused

Reuse `e2e/staging/qr-inventory-sample.spec.ts` through:

1. ephemeral Tenant/Management/Site/Auth setup;
2. Design and Sample approval;
3. requester final approval request;
4. independent Super Admin final approval;
5. exactly one durable `PENDING_DELIVERY` job.

Do not add a second fixture or hardcoded database row.

### 5.2 Queue API helper

Extend `StagingServiceApi` with a schema-scoped Queue RPC helper:

```ts
queueRpc<T>(functionName, input): Promise<T>
```

It calls the existing Supabase REST endpoint with:

```text
Accept-Profile: pgmq_public
Content-Profile: pgmq_public
```

It uses the already loaded server secret and the existing safe HTTP/error reducer. It never logs
request headers, payloads, or response bodies.

The proof uses only:

- `read(queue_name, sleep_seconds, n)`
- `delete(queue_name, message_id)`

The application publisher remains the only code path that calls `send`.

### 5.3 Live dispatch test

Replace the synthetic publication portion of the current dispatcher staging test:

1. Assert exactly one fixture-owned eligible job and no other `PENDING_DELIVERY` job.
2. Claim it once and record `QUEUE_UNAVAILABLE` to preserve the existing retry transition proof.
3. Wait until `available_at` is eligible.
4. Call `GET /api/internal/qr-generation-dispatch` with the in-memory staging Cron bearer.
5. Assert HTTP `200`, `claimedCount=1`, and `PUBLISHED=1`; assert the JSON response contains no
   job, Tenant, Site, Batch, Queue message, or secret identity.
6. Read one Queue message with a short visibility timeout.
7. Assert the exact strict v1 payload:

```json
{
  "schemaVersion": 1,
  "jobId": "fixture job UUID",
  "jobType": "QR_GENERATION",
  "tenantId": "fixture tenant UUID",
  "siteId": "fixture site UUID",
  "batchId": "fixture batch UUID",
  "generationRevision": 1,
  "deliveryAttempt": 2,
  "createdAt": "persisted job creation timestamp",
  "traceId": "fixture job UUID"
}
```

8. Assert the live Queue `msg_id`, `qr_generation_jobs.queue_message_id`, and the job/batch
   `QUEUED` states agree.
9. Delete that exact Queue message in `finally`.
10. Run the existing application/Auth fixture cleanup and zero-residue assertions.

No `pop` is used because it is at-most-once and would delete before assertions. No consumer
handler is invoked.

## 6. Failure and cleanup policy

| Failure point | Required behavior |
|---|---|
| Queue not configured | preflight fails before fixture mutation |
| Unauthorized Route | `401`; no claim |
| Provider send failure | durable `RETRY_WAIT`; no Batch failure |
| Publish success / DB acknowledgement failure | leave lease recoverable; test message ID tracked for cleanup |
| Queue payload mismatch | delete tracked message in `finally`, then fail |
| Application assertion failure | Queue cleanup then existing fixture cleanup |
| Queue cleanup failure | report safe operation/status code; do not hide primary failure |

The live test must not delete or archive any message whose ID it did not observe from its own
fixture dispatch.

## 7. Read-only verification queries

Before and after the live proof, inspect:

- `pg_extension` for `pgmq`;
- `pg_namespace` for `pgmq_public`;
- `pg_class` for Queue table persistence and RLS flags;
- effective function execution for `anon`, `authenticated`, and `service_role`;
- Queue table grants for those roles;
- Queue table row count and fixture message absence after cleanup;
- application job/audit/Auth fixture residue.

Do not return message bodies from general Queue inventory queries.

## 8. Advisor gate

Run both:

- Supabase security advisors;
- Supabase performance advisors.

Security completion requires no Queue exposure error, no newly unprotected table/view/function
path, and no regression in existing RLS findings. Advisor results are evidence, not a replacement
for the explicit privilege query.

## 9. Planned file changes

```text
e2e/staging/staging-fixture.ts
e2e/staging/qr-inventory-sample.spec.ts
docs/03-analysis/qr-generation-staging-queue-live-proof.analysis.md
docs/04-report/qr-generation-staging-queue-live-proof.report.md
```

No application migration is planned for the managed Dashboard-created Queue wrapper. If a later
repeatable-infrastructure review proves that Queue creation can be safely owned in SQL, create a
new migration with the Supabase CLI and validate it through Docker before applying it.

## 10. Validation

1. Read-only Queue security preflight.
2. Unauthorized public/publishable-key Queue call denial.
3. Focused authenticated live Queue E2E.
4. Queue and fixture zero-residue query.
5. Security/performance advisors.
6. `pnpm db:check`.
7. `pnpm validate:wcj`.
8. `pnpm verify`.

## 11. Blocker

Do is intentionally blocked until the user completes or authorizes the Supabase Dashboard steps:

1. enable the Queues module / `pgmq`;
2. create the durable Basic Queue `qr-generation`;
3. enable the `pgmq_public` Data API wrapper;
4. set role permissions exactly as reviewed;
5. add the secure staging `CRON_SECRET` if it is not already present.

No credential value belongs in chat, docs, Git, logs, or browser code.
