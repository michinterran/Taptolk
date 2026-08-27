# QR Generation Staging Queue Live Proof — Plan

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for Design
> Level: Dynamic | Target: `taptolk-staging` only

## 1. Purpose

Provision the first durable Supabase Queue for QR generation in staging, lock its Data API surface
to server roles, and prove one complete live delivery path:

```text
durable PENDING_DELIVERY job
→ internal authenticated dispatcher
→ pgmq_public.send
→ strict v1 Queue message
→ durable QUEUED acknowledgement
→ test message cleanup
```

The proof must use an isolated staging fixture, leave no Queue or application residue, and avoid
starting QR generation.

## 2. Verified starting state

Read-only inspection on 2026-07-19 confirmed:

- Project: `taptolk-staging`
- Project ref: `evpwzjkhfppdjivkyokh`
- Region: Seoul (`ap-northeast-2`)
- Status: `ACTIVE_HEALTHY`
- Postgres: 17.6
- `pgmq` extension: absent
- `pgmq_public` schema: absent
- `qr-generation` Queue tables: absent
- Queue API functions/grants: absent

No remote mutation was performed during this inspection.

## 3. Goals

- Create a durable Basic Queue named `qr-generation`.
- Expose only the reviewed Queue API needed by backend components.
- Ensure `PUBLIC`, `anon`, and browser `authenticated` cannot send, read, archive, or delete Queue
  messages.
- Enable RLS on the active Queue table as defense in depth.
- Allow only trusted server roles to use the required Queue functions.
- Extend authenticated staging E2E to invoke the real internal dispatcher Route.
- Verify the strict v1 message, provider message ID acknowledgement, aggregate response, and zero
  residue.
- Run Supabase security/performance advisors after provisioning.

## 4. Scope

### In scope

- Supabase Dashboard Queue module enablement for staging.
- Durable Basic Queue creation.
- `pgmq_public` PostgREST exposure required by the existing server publisher.
- Queue table RLS and role/function privilege review.
- Secure staging `CRON_SECRET` and Queue/runtime environment configuration.
- A controlled Playwright staging proof using the existing isolated QR fixture.
- Queue message readback for structural evidence, followed by explicit delete/archive cleanup.
- Read-only SQL verification and advisor evidence.

### Out of scope

- Production Queue provisioning.
- Browser/public Queue access or Queue UI.
- Resident Worker polling.
- QR issuance, activation/public tokens, rendering, Storage output, or consumer-side effects.
- Vercel production Cron schedule.
- Creating a second Queue or generic event bus.
- Claiming Phase 1 complete without Docker reset/runtime pgTAP.

## 5. Security requirements

1. Secret/service-role credentials stay in server environment and test process memory only.
2. `PUBLIC`, `anon`, and `authenticated` receive no Queue table or Queue API privilege.
3. The active Queue table has RLS enabled before live Data API proof.
4. Queue payload remains the strict v1 allowlist and contains no actor, reason, contact, token,
   storage, cookie, authorization, or provider credential fields.
5. E2E errors report only HTTP/status codes and safe operation names.
6. Cleanup executes even when assertions fail.
7. The test refuses every project except the locally linked `taptolk-staging` ref.
8. Database advisors must report no insecure exposed Queue error before completion.

## 6. Success criteria

- [ ] `pgmq` is installed in staging.
- [ ] `pgmq.q_qr-generation` and its archive table exist as logged durable tables.
- [ ] `pgmq_public.send/read/delete/archive` exist only with reviewed server-role execution.
- [ ] Active Queue table RLS is enabled and no public/browser Queue policy grants access.
- [ ] Unauthorized public/publishable-key Queue calls fail.
- [ ] The isolated fixture has exactly one eligible delivery job before invocation.
- [ ] Internal Route returns `200`, `claimedCount=1`, and aggregate `PUBLISHED=1`.
- [ ] Queue message exactly matches the strict v1 payload.
- [ ] `qr_generation_jobs.queue_message_id` equals the live Queue message ID.
- [ ] Batch/job state becomes `GENERATION_QUEUED` / `QUEUED`.
- [ ] Test message and all application/Auth fixture rows are removed.
- [ ] Security/performance advisors and `pnpm verify` pass.

## 7. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Queue exposed without protection | RLS, no browser grants, advisor gate before live proof |
| Test dispatches an unrelated pending job | Require exactly one fixture-owned eligible row |
| Message remains after failed assertion | Track provider ID and delete/archive in `finally` |
| Secret appears in trace/log | No trace/video, safe error reducer, secret scan |
| Dashboard state cannot be reproduced locally | Record exact settings and read-only verification SQL; defer migration ownership until managed objects are understood |
| Remote setup diverges from local Docker | Keep Phase 1 open; add local `pgmq_public` config only when Docker is available |

## 8. Delivery order

1. Approve this Plan and the matching Design.
2. User enables Supabase Queues, creates the Basic Queue, and exposes Queue API in staging.
3. Agent runs read-only SQL and advisors before granting/using any public API surface.
4. Correct role/RLS settings through the approved Dashboard path.
5. Configure secure staging runtime variables.
6. Implement the isolated live proof in the existing staging E2E.
7. Run the live proof, verify cleanup, then run full repository verification.

## 9. References

- `docs/handoff-0719-1735.md`
- `docs/02-design/features/qr-generation-queue-dispatch-runtime.design.md`
- `docs/architecture/worker-runtime-decision.md`
- Supabase Queues Quickstart:
  https://supabase.com/docs/guides/queues/quickstart
- Supabase Queue API:
  https://supabase.com/docs/guides/queues/api
- Supabase insecure Queue advisor:
  https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0019_insecure_queue_exposed_in_api
