# Completion Report: QR Generation Queue Dispatch Runtime

> Date: 2026-07-19 | Level: Dynamic | Environment: Staging only

## 1. Summary

Implemented the first real Supabase Queues publication boundary for QR generation delivery. A
server-only internal Route now composes the durable dispatcher RPC repository, bounded
Application runtime, exponential retry policy, and strict `pgmq_public.send` publisher.

The runtime is deliberately staging-only. It authenticates with the internal Cron credential,
claims one job at a time, caps total claims and elapsed budget, times out Queue sends, and returns
only aggregate outcomes. QR issuance, rendering, Storage output, resident Queue consumption, and
Production enablement remain outside this unit.

### Final match rate

100% (36/36 code-level Design obligations; target 90%)

## 2. Completed items

- [x] Removed five byte-identical untracked migration duplicates.
- [x] Restored the canonical 22-file migration history.
- [x] Added validated Queue/runtime/retry server configuration.
- [x] Added strict Supabase `pgmq_public.send` publisher adapter.
- [x] Added bounded one-at-a-time dispatch runtime.
- [x] Added staging-only environment and timing-safe bearer gates.
- [x] Added internal Node Route with safe HTTP/error mapping.
- [x] Added configuration, provider, runtime, authentication, and handler tests.
- [x] Preserved publish-success/ack-failure duplicate safety.
- [x] Passed full repository verification and production builds.

## 3. Intentional deviations

- Added pure configuration and HTTP handler modules beyond the initial file map. They allow
  staging/auth/status behavior to be tested without importing server-only Next composition.
- Kept the Queue adapter SDK-agnostic through an injected structural client. The Web runtime owns
  the existing Supabase SDK client and `@taptolk/db` owns only the provider mapping.
- Did not add a Vercel Cron manifest. This unit is staging-only and Production scheduling remains
  behind benchmark and release gates.

## 4. Quality metrics

| Metric | Result |
|---|---|
| PDCA Design match | 100% |
| PDCA iterations | 1 |
| Full tests | 30 files / 234 tests passed |
| Focused new-boundary tests | 69 passed |
| Typecheck | 10 packages / 17 tasks passed |
| Database static check | 22 migrations / 12 database tests |
| Secret scan | 302 text files |
| WCJ | Total 100 · C 100 · J 100 · W 100 · 50 files |
| Builds | Application, DB, Worker, Web and all workspace packages passed |
| Internal Route smoke | `503` when unavailable; `401` without valid bearer |
| Files in working unit before report/handoff | 20 |
| New/changed implementation and PDCA lines before report | approximately 1,800 |

## 5. Evidence boundaries

- No authenticated live Queue publication was executed.
- No staging job row or Queue message was mutated during verification.
- Queue enablement/creation and server permission verification remain external staging setup.
- Docker is not installed, so local Supabase reset and runtime pgTAP remain open.
- Phase 1 is therefore still not complete.
- Production is disabled.

## 6. Learnings

1. Claiming one row per coordinator call avoids leasing work that a nearly exhausted invocation
   has already decided not to publish.
2. A provider response must be parsed as a strict single positive identifier before the durable
   job can be acknowledged as queued.
3. Separating pure HTTP policy from server-only composition gives direct proof of 200/401/500/503
   behavior without weakening the credential boundary.
4. Static migration checks became trustworthy again only after removing the five duplicate
   timestamp artifacts.

## 7. Follow-up

- [ ] Install/start Docker and run local reset plus all runtime pgTAP tests.
- [ ] Enable/create the durable `qr-generation` Queue in `taptolk-staging`.
- [ ] Verify `pgmq_public.send` server-role access without granting browser roles.
- [ ] Configure the new staging-only Queue/runtime variables in the secure deployment environment.
- [ ] Create one controlled staging generation job and prove publish plus durable acknowledgement.
- [ ] Inject publish-success/ack-failure against staging and confirm stable-job republish safety.
- [ ] Keep QR issuance/rendering/Storage and Production manifests out until their separate approved
      Plan/Design and runtime gates.
