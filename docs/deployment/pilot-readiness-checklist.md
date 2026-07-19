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

## Manual and external pilot gates

- [ ] Configure an approved production SMS provider and verify receipt/cost reconciliation.
- [ ] Configure a production CAPTCHA provider; keep public Contact fail closed until then.
- [ ] Configure production Cron scheduling and verify secret rotation/run monitoring.
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
