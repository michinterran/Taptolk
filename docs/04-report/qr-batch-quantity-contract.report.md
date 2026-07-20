# QR Batch Quantity Contract Reconciliation Report

> Date: 2026-07-20  
> Branch: `codex/phase-1-foundation`  
> Implementation commit: `1314532`  
> Stage: `DEVELOPMENT_TEST`  
> Decision: Task 0 complete / external pilot gates still pending

## 1. Plan

Restore the already-approved `1..100` per-Batch quantity contract in every enforcement layer
without changing the quantity policy, widening a Batch, modifying historical migrations, or
touching unrelated `10000` constants.

The approved scope was limited to:

1. one new forward migration after `20260720135421`;
2. the Drizzle `qr_batches` CHECK declaration;
3. the Application maximum constant;
4. the Application boundary unit tests;
5. three pgTAP boundary assertions.

## 2. Do

### 2.1 Forward-only database repair

Added `20260720210000_qr_batch_quantity_contract.sql`.

- Acquires an `ACCESS EXCLUSIVE` table lock before the preflight and constraint replacement.
- Checks for any existing `requested_quantity > 100` row.
- Raises SQLSTATE `23514` with an explicit contract-violation message if a row exists.
- Does not delete, rewrite, or silently normalize an existing Batch.
- Drops the current named CHECK only after the preflight passes.
- Recreates `chk_qr_batches_requested_quantity` as `between 1 and 100`.
- Leaves every historical migration unchanged.

Local and linked Staging preflight counts were both zero before application. After linked Staging
application, the effective constraint was verified as `requested_quantity >= 1` and
`requested_quantity <= 100`, with zero rows above the limit.

### 2.2 Code contract

- Drizzle CHECK: `between 1 and 100`.
- Application: `QR_BATCH_REQUEST_QUANTITY_MAX = 100`.
- Unit boundary: `101` rejected and `100` accepted.
- pgTAP:
  - RPC `101` returns `INVALID_QUANTITY`;
  - RPC `100` succeeds;
  - direct table insert `101` fails with CHECK violation.

### 2.3 Explicit exclusions

No bulk replacement was used. The six unrelated constants listed in work order section 2.5 were
not changed:

- vehicle import row count;
- generation item ordinal;
- import validation row count;
- queue send timeout in configuration;
- queue publisher timeout;
- public-contact millisecond policy.

The three analysis-only items in section 2.6 were inspected and not changed.

## 3. Check

### 3.1 Task 0 completion criteria

| Criterion | Result |
| --- | --- |
| New migration restores CHECK `1..100` | PASS |
| Historical migrations remain unchanged | PASS |
| Drizzle and Application are aligned | PASS |
| Unit `101` reject and `100` accept | PASS |
| Three required pgTAP assertions | PASS |
| Clean local reset twice | PASS |
| Complete local pgTAP | 23 files / 590 tests PASS |
| `corepack pnpm verify` | PASS |
| Three section 2.6 items analyzed without modification | PASS |
| Existing 10x100 acceptance contract | PASS |

### 3.2 Automated validation

- `corepack pnpm db:reset:local`: two consecutive deterministic PASS runs.
- `corepack pnpm exec supabase test db --local`: 23 files / 590 tests PASS.
- `corepack pnpm db:test:linked`: 23 files / 590 tests PASS after applying the migration to the
  approved linked Staging project.
- `corepack pnpm verify`:
  - lint 324 files PASS;
  - typecheck 19/19 tasks PASS;
  - unit 53 files / 327 tests PASS;
  - DB static 57 migrations / 23 database tests PASS;
  - Secret scan 534 files PASS;
  - immutable logo PASS;
  - deferred Cron verifier PASS;
  - WCJ 100 / C100 / J100 / W100 over 91 files;
  - Production build PASS.
- Authenticated Staging:
  - the later integrated rerun completed all 28 default tests in one run;
  - the separately approved 10x100 acceptance remained the single intentional opt-in skip;
  - owner activation, public contact, QR inventory, Site CRUD/tenant isolation, and Phase 9
    hardening all passed.
- Explicit `corepack pnpm e2e:staging:qr-generation-acceptance`:
  - 10 Batches;
  - 100 items per Batch;
  - 1,000 total;
  - duplicate 0;
  - decode 1,000/1,000;
  - export/checksum 40/40;
  - queue retry 1;
  - poison active 0;
  - residue 0;
  - PASS in 1.1 hours.

The long acceptance emitted local Next.js development-cache persistence/compaction warnings. The
Worker, database evidence, export verification, and deterministic cleanup all completed
successfully.

### 3.3 Analysis-only findings

#### `render_jobs.requested_count`

This value is modeled as a single-Batch render job:

- `qr_batch_id` is non-null;
- the same-scope foreign key points to one `qr_batches` row;
- `uq_render_jobs_revision` includes `qr_batch_id`.

No active insert/creation path for `render_jobs` was found in the current migrations or
application/worker code. It appears to be a retained schema path while the active generation flow
uses `qr_generation_jobs`. Whether its independent upper bound should be 100 requires a separate
decision. It was not changed.

#### `packages/qr-engine/src/issuance.ts`

`issueQrBatch` is a generic in-memory credential-generation helper. The active Worker computes a
single Batch's missing ordinals, slices them into chunks of 50, and calls the helper with the
current chunk length. The helper's 10,000 bound is therefore not currently the database per-Batch
authorization boundary. It was not changed.

#### `packages/qr-engine/src/print-export.ts`

The active `QrPrintExportHandler` loads a context by one `batchId`, converts that context's items,
and calls `buildPrintExportBundle` once for that Batch. The current production call path is
single-Batch, while the QR engine function itself is a reusable item-list boundary. A separate
design decision is required before changing the engine limit. It was not changed.

## 4. Act

Task 0 is complete. Continue with work order Task 1:

1. add a typed server-only stage policy;
2. fail closed for missing or invalid stage configuration;
3. prove browser input cannot alter stage;
4. add an extensible Service test-surface leak guard;
5. include the guard in `pnpm verify`.

Do not start Task 2 or Task 3 before Task 1 passes its own complete gate. Do not select a
Production project, region, Provider, Secret, plan, Cron schedule, or operations owner.

## 5. Manual validation pending

Task 0 changes no page or physical artwork. The existing external pilot gates remain open:

- representative iOS/Android and assistive-technology journeys;
- computed contrast review;
- physical 85mm print/scan inspection;
- Production monitoring, rollback, and incident ownership.

Production Cron remains inactive with zero active definitions.
