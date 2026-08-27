# QR Generation Queue Dispatch Runtime — Plan

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for Design
> Level: Dynamic | Environment: Staging only

## 1. Purpose

Connect the completed provider-neutral QR generation dispatch coordinator to Supabase Queues in a
bounded, server-only staging runtime. The unit proves the real delivery boundary without starting
QR issuance, rendering, storage output, or a resident generation consumer.

The durable `qr_generation_jobs` row remains the business source of truth. Supabase Queue messages
are at-least-once delivery signals, and publish acknowledgement is recorded separately through the
reviewed PostgreSQL RPC contract.

## 2. Goals

- Add an injected Supabase Queues publisher adapter for the strict v1
  `QrGenerationQueueMessage`.
- Compose the publisher, dispatcher RPC repository, retry policy, and coordinator in a server-only
  runtime.
- Expose one authenticated, bounded staging-only invocation suitable for Vercel Cron/manual
  staging verification.
- Keep claim limit, lease, duration budget, Queue name, and retry values in validated server
  configuration rather than Route code.
- Preserve duplicate safety when Queue publish succeeds but PostgreSQL acknowledgement fails.
- Return and log only redacted aggregate outcomes.

## 3. Scope

### 3.1 In scope

- Supabase `pgmq_public.send` publisher adapter with injected client.
- Fixed Queue name and zero initial Queue delay from typed runtime configuration.
- Staging-only runtime guard using `APP_ENV=staging`.
- Bearer authentication using the server-only `CRON_SECRET`.
- One bounded claim/publish pass per invocation.
- A duration budget checked before each publication; no indefinite loop.
- Provider errors reduced to `QUEUE_RATE_LIMITED` or `QUEUE_UNAVAILABLE`.
- Unit tests for provider response validation, error reduction, authorization, environment guard,
  bounds, and safe result aggregation.
- Static migration verification against the canonical 22-file history.

### 3.2 Out of scope

- Queue creation or permission mutation in a migration or Dashboard.
- Production enablement or Production host manifests.
- Resident Queue polling or a QR generation Worker implementation.
- QR issuance, token generation, activation codes, SVG/PDF/image rendering, or Storage writes.
- Public/browser Queue access.
- Consumer acknowledgement, dead-letter processing, or execution retry policy.
- Any claim that Phase 1 is complete before Docker reset and runtime pgTAP pass.

## 4. Functional requirements

1. The publisher sends only the strict v1 DTO to the configured Queue and accepts only a positive
   provider message identifier.
2. Missing or malformed provider responses fail closed without leaking provider payloads.
3. The runtime rejects local and Production environments.
4. The runtime rejects missing or invalid internal bearer authentication before repository access.
5. Request query/body values cannot change Queue name, claim limit, lease, duration, or retry
   policy.
6. The coordinator reuses stable `jobId` identity for republish and never records a false delivery
   failure after provider success.
7. The invocation response contains aggregate counts only; it contains no credential, raw error,
   Queue payload, Queue message ID, job ID, Tenant ID, Site ID, or Batch ID.

## 5. Non-functional requirements

- Follow `Route Handler -> runtime composition -> Application Service -> repository/provider
  adapter -> Supabase`.
- Browser modules must not import the runtime, secret configuration, admin client, or Queue
  adapter.
- Provider/client credentials remain owned by the existing server-only Supabase client factory.
- The runtime has no resident loop and performs no generation work.
- All added source code has focused unit tests and passes lint, typecheck, secret scan, build, and
  WCJ.
- No new package is created for this bounded unit.

## 6. Success criteria

- [ ] Five untracked duplicate migrations are removed and `pnpm db:check` reports 22 migrations.
- [ ] Publisher contract tests prove valid send, malformed response rejection, rate-limit
  reduction, and unavailable reduction.
- [ ] Runtime tests prove staging/auth/config gates execute before claims.
- [ ] Bounded execution tests prove the duration gate stops additional publications.
- [ ] Pipeline tests still prove publish-success/ack-failure duplicate safety.
- [ ] The internal Route is Node-only, dynamic, no-store, and returns redacted aggregates.
- [ ] `pnpm validate:wcj` and `pnpm verify` pass.
- [ ] Live Queue publication is not claimed until the staging Queue and secure environment are
  externally configured and a controlled staging job is observed.

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Queue publish succeeds but DB acknowledgement fails | Duplicate delivery | Stable `jobId`, lease expiry, optimistic version, idempotent consumer contract |
| Secret key or Cron credential reaches browser/logs | Critical exposure | Server-only modules, redaction, aggregate responses, secret scan |
| An invocation runs beyond its web budget | Resource exhaustion | Fixed claim bound, pre-publication deadline check, no resident loop |
| Provider response shape changes | Incorrect acknowledgement | Strict message-ID parsing and fail-closed adapter |
| Route is accidentally enabled in Production | Premature release | Explicit staging-only runtime guard |
| Queue does not exist or Data API wrapper is unavailable | Delivery outage | Safe `QUEUE_UNAVAILABLE`, durable retry ledger, no Batch failure |
| Docker remains unavailable | Phase 1 evidence gap | Preserve Phase 1 open status; do not replace runtime pgTAP with static checks |

## 8. Delivery order

1. Verify canonical migration history and Docker availability.
2. Approve this Plan and the matching Design.
3. Add validated server runtime configuration.
4. Add the Supabase Queue publisher adapter.
5. Add bounded staging runtime composition and internal Route.
6. Add failure-injection and boundary tests.
7. Run PDCA gap analysis and repository verification.

## 9. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`
- `docs/02-design/features/qr-final-generation-approval.design.md`
- `docs/architecture/worker-runtime-decision.md`
- `docs/handoff-0719-1627.md`
- Supabase Queues Quickstart: https://supabase.com/docs/guides/queues/quickstart
- Supabase server API-key guidance:
  https://supabase.com/docs/guides/getting-started/api-keys
