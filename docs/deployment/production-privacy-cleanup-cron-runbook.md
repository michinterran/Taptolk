# Production Privacy Cleanup Cron Runbook

> Updated: 2026-07-20 | Status: Code ready; Production setup and operator acceptance pending

## Purpose

Operate the hourly, tenant-bounded privacy cleanup scheduler without placing credentials or
tenant identifiers in source, commands, screenshots, logs, or documentation.

The deployed Cron target is:

```text
GET /api/internal/privacy-cleanup
schedule: 0 * * * * (UTC, hourly)
```

The route processes only an oldest-due bounded tenant set. Duplicate delivery in the same
tenant/hour is absorbed by a deterministic request UUID and the unique cleanup ledger.

## Preconditions

- The Vercel project Root Directory is `apps/web`.
- A separate approved Production Supabase project exists and its migrations were applied through
  `20260719184000`.
- The selected Vercel plan supports an hourly schedule. Do not deploy the hourly manifest on a
  plan restricted to daily Cron execution.
- Production provider, data-processing-region, monitoring, rollback, and incident owners are
  approved.
- `pnpm verify`, linked pgTAP, and the Production Cron source verifier pass on the release commit.

## Required secret-managed environment names

Configure values only through the deployment secret manager:

- `APP_ENV=production`
- `CRON_SECRET`
- `SUPABASE_SECRET_KEY`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- the remaining Production variables enforced by `packages/config/src/env.server.ts`

`CRON_SECRET` must be independently generated for Production. Do not copy a Local or Staging
value. Never prefix it with `NEXT_PUBLIC_`.

## Deployment sequence

1. Confirm Production Supabase migration history and linked release evidence.
2. Configure the required Production environment variables without displaying their values in
   review artifacts.
3. Run `pnpm verify:production-cron` and `pnpm verify` on the exact release commit.
4. Deploy the web project from `apps/web`.
5. Confirm the Vercel Cron Jobs screen lists exactly one hourly
   `/api/internal/privacy-cleanup` schedule.
6. Confirm an unauthenticated request returns `401` and performs no cleanup work.
7. Trigger one authorized operator verification through the platform's protected Cron mechanism.
8. Confirm a bounded aggregate response and a successful cleanup ledger/audit row.
9. Repeat within the same UTC hour and confirm no duplicate tenant/hour cleanup or audit result.
10. Confirm logs contain request ID, status, and counts only.

Do not put the authorization header or its value in shell history, tickets, chat, screenshots, or
saved test output.

## Expected responses

| Status | Meaning | Operator action |
|---|---|---|
| `200` | Bounded run completed or duplicate was safely absorbed | Confirm aggregate counts and next schedule |
| `401` | Missing or invalid Cron authorization | Check secret binding without exposing its value |
| `503` | Required server configuration unavailable | Keep Cron disabled and repair environment binding |
| `500` with `PARTIAL_FAILURE` | At least one selected tenant failed | Inspect redacted logs and ledger; retry only after cause review |
| `500` with `CLEANUP_FAILED` | Selection/runtime contract failed | Keep traffic unchanged and investigate dependency health |

Vercel does not automatically retry a failed Cron invocation. The next hourly invocation selects
still-due tenants. A manual retry is allowed only after checking the cleanup ledger and must use
the platform-protected invocation path.

## Secret rotation

1. Generate a new independent value in the secret manager.
2. Update `CRON_SECRET` for Production and create a new deployment.
3. Confirm the active Cron uses the new deployment and returns `200`.
4. Confirm the former value returns `401` without recording or displaying either value.
5. Record only rotation time, operator, deployment identifier, and outcome.

## Monitoring

Alert on:

- no successful invocation across two expected hourly windows;
- any `401`, `503`, or `500`;
- non-zero failed or deferred tenant count across two consecutive runs;
- cleanup duration approaching the configured budget;
- a tenant with no successful cleanup beyond the approved retention operating window.

Never attach response bodies containing identifiers or copy raw platform environment output into
an incident.

## Rollback

1. Disable the Cron schedule before a rollback when cleanup compatibility is uncertain.
2. Roll back the web deployment and verify the active Cron configuration separately. A Vercel
   deployment rollback does not itself guarantee that the Cron schedule is reverted.
3. Keep the forward-applied database migration; do not edit Production schema in the dashboard.
4. Re-enable the schedule only after the rolled-back route, environment binding, and ledger
   compatibility are verified.

## Acceptance boundary

This runbook and manifest complete the code-owned scheduling contract. They do not establish that
Production credentials, Cron execution, alerts, rollback, or incident ownership have been
accepted. Keep the pilot status `AUTOMATED_READY / MANUAL_GATES_PENDING` until the accountable
operators complete the Production checklist.
