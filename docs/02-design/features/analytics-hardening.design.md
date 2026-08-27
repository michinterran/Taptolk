# Analytics and Hardening - Phase 9 Design

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Implementation

## Data boundaries

- `operations_metric_snapshots`: tenant/site/hour, count/latency/cost measures only.
- `privacy_cleanup_runs`: tenant, caller-supplied retention inputs, affected-row counts, status,
  timestamps, and request identity. No deleted content is copied into the ledger.
- Existing `notification_deliveries.cost_amount` is the cost source; dashboard returns recorded
  cost plus missing-cost count.
- Existing immutable history remains. Cleanup may change only an aged message body to the fixed
  redaction marker and keeps its original hash.

All new tables force RLS. Browser writes are denied. Snapshot reads use Site scope. Cleanup is
service-only and tenant-bounded.

## Commands and reads

- `aggregate_operations_metrics(tenant, site, hour)`: service-only, idempotent hourly upsert.
- `read_operations_dashboard()`: authenticated, central Site-scope predicate, bounded 24-hour KPI
  plus latest aggregate freshness.
- `run_privacy_cleanup(tenant, messageHours, tokenHours, blockHours, requestId)`: service-only,
  validates typed ranges, expires sessions, revokes tokens/blocks, redacts aged bodies, records
  one run and redacted audit in one transaction.
- `read_pilot_readiness_snapshot()`: authenticated scope-safe automated evidence only.

## Application and route boundary

- `OperationsDashboardService` authorizes the actor before repository access.
- Authenticated server components call the browser-role RPC; no service key enters dashboard code.
- `PrivacyCleanupService` validates tenant/request IDs and retention policy before a
  service-role repository command.
- `/api/internal/privacy-cleanup` requires the existing Cron Bearer policy and returns counts only.

## UI

`/{locale}/admin/operations` provides:

- today: contact volume, unresolved, escalated, median Owner response;
- delivery: sent, retrying, final failures, recorded cost, missing cost;
- safety: open reports and active blocks;
- inventory: active QR and completed generation;
- freshness and one direct action to the relevant Site or QR operations page.

All copy ships in KO/EN. Metric cards use numbers and labels, not color alone.

## Automated readiness

The Phase 9 verifier checks:

- bounded concurrent public-read load with latency/error thresholds;
- security headers and sensitive-field response scanning;
- 320/768/1280/1920 overflow plus axe;
- generated PNG decode, PDF page geometry for 85mm, manifest/checksum/storage ledger continuity;
- Queue poison/processing residue and fixture/Auth residue;
- cleanup idempotency and dashboard scope isolation.

Physical print, real-device decode, computed-contrast inspection, and hands-on screen-reader
sessions remain explicit manual gates.
