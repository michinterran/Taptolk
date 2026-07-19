# Taptolk Pilot Readiness Checklist

> Updated: 2026-07-20 | Current decision: Automated ready / Manual gates pending

## Automated staging gates

- [x] Per-Batch quantity remains 1-100; no single 1,000-item Batch contract.
- [x] Ten approved 100-item Batches generated 1,000 assets through Worker and `qr-generation`.
- [x] Intentional chunk stop, lease expiry, and resume completed without ordinal/token/QR
      Asset/activation duplicates.
- [x] Generation 1,000; duplicate 0; QR decode 1,000/1,000.
- [x] PDF/CSV/ZIP/manifest export 40/40 checksum and Storage ledger continuity.
- [x] Queue retry evidence present; poison active 0; Queue/Auth/fixture residue 0.
- [x] Owner activation, public contact, notification/reply, escalation/report/block journeys.
- [x] Privacy cleanup and operations KPI dashboard.
- [x] Linked pgTAP, authenticated staging E2E, WCJ, secret scan, logo integrity, and production
      build.
- [x] Full default staging suite: 28 PASS and one intentional opt-in 1,000-item acceptance skip.
- [x] Final verify: lint 312 files, typecheck 19/19, unit 312/312, DB structure 54 migrations/21
      tests, secret scan 491 files, WCJ 100, production build.
- [x] Bounded health load and security-header regression gate.
- [x] Generated 100-item print source: 85mm geometry, decode 100/100, export checksums 4/4.
- [x] Production privacy-cleanup Cron source contract: bounded due-tenant selection, deterministic
      tenant/hour idempotency, credential-free hourly manifest, and static verifier.
- [x] Production Cron pgTAP: 16/16; complete linked database suite PASS.
- [x] 2026-07-20 pre-deployment revalidation: linked `taptolk-staging` is healthy in Seoul and
      migrations match through `20260719184000`; all 22 linked pgTAP files PASS; authenticated
      staging E2E 28 PASS with one intentional opt-in skip; `pnpm verify` PASS on checkpoint
      `215bb11`.

## Manual and external pilot gates

- [ ] Move the intended Production Vercel project to an approved Pro or Enterprise team. The
      currently accessible team is Hobby, which does not support `0 * * * *`.
- [ ] Grant access to or create/import the actual `taptolk` Production Vercel project and confirm
      its Root Directory is exactly `apps/web`. No accessible `taptolk` project was present during
      the 2026-07-20 audit, so Root Directory remains unverified.
- [ ] Create or grant access to a separate approved Production Supabase project, approve its data
      region, and apply migrations through `20260719184000`. Only `taptolk-staging` was accessible
      for this lane during the audit.
- [ ] Select an approved production SMS provider and authorize provider-adapter implementation,
      sender registration, receipt/cost reconciliation, and failure rehearsal. Do not configure
      secret values until the adapter and Production project are approved.
- [ ] Select a production CAPTCHA provider and authorize provider-adapter implementation and
      failure rehearsal; keep public Contact fail closed until then.
- [ ] After the Vercel and Supabase gates pass, configure Production secrets only in the deployment
      secret manager and follow `docs/deployment/production-privacy-cleanup-cron-runbook.md` for
      one authorized aggregate-only run, same-hour replay, duplicate-zero proof, monitoring,
      rotation, and rollback rehearsal.
- [ ] Verify representative iOS and Android devices across scan, contact, wait, and reply.
- [ ] Run VoiceOver and TalkBack hands-on journeys, including live announcements and focus order.
- [ ] Inspect computed contrast in production browser states.
- [ ] Print representative output on the target 85mm printer and confirm trim, size, adhesive, and
      scan distance.
- [ ] Decide and validate TUS resumable upload for artifacts above the reviewed large-file
      threshold.
- [ ] Complete production domain, environment, alerting, rollback, and incident owner review.

## Approval rule

Do not call the pilot `READY` or expose production traffic until every manual/external item is
checked by its accountable operator. Never put provider credentials or secret values in this
checklist, Git, logs, screenshots, or chat.
