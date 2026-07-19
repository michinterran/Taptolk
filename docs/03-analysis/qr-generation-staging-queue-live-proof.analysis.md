# Gap Analysis: qr-generation-staging-queue-live-proof

> Date: 2026-07-20 | Design:
> `docs/02-design/features/qr-generation-staging-queue-live-proof.design.md`

## Match Rate: 100%

## Summary

All 12 approved live-Queue criteria were later proven in the linked staging project. The durable
`qr-generation` Queue, protected wrapper, server-only publish path, strict payload, atomic
acknowledgement, cleanup, and advisor boundaries are present.

## Implemented Items

- [x] `pgmq` and the durable Queue/archive tables exist in staging.
- [x] Queue wrapper operations are restricted to reviewed server execution.
- [x] Active Queue RLS is enabled and browser roles have no Queue policy access.
- [x] Unauthorized public and publishable-key calls are rejected.
- [x] Isolated fixture selection is bounded and deterministic.
- [x] Internal dispatch returns redacted aggregate publication results.
- [x] The live message matches the strict v1 internal-ID payload.
- [x] Job `queue_message_id` records the published Queue identity.
- [x] Batch/job state becomes `GENERATION_QUEUED` / `QUEUED`.
- [x] Retry, expired lease, archive, and poison-message behavior is verified.
- [x] Queue, Storage, application, and Auth fixture residue returns to zero.
- [x] Security checks, pgTAP, staging E2E, and workspace verification pass.

## Deviations from Design

The original one-job live proof was extended to a stronger 10×100 Worker acceptance. This retains
the same security boundary and 1–100 per-Batch contract while adding interruption/resume,
independent decode, export checksum, retry, archive, poison, and cleanup evidence.

## Evidence

- `e2e/staging/qr-inventory-sample.spec.ts`
- `e2e/staging/qr-generation-worker-acceptance.spec.ts`
- `supabase/tests/database/phase_3_staging_acceptance.sql`
- `docs/04-report/phase-2-4-implementation.report.md`
- `docs/04-report/qr-generation-staging-acceptance.report.md`

## Recommendation

Close the live-proof PDCA. Do not interpret this staging proof as authorization to enable a
Production provider or change the Batch quantity policy.
