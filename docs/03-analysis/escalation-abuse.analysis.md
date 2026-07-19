# Gap Analysis: escalation-abuse

> Date: 2026-07-20 | Design: `docs/02-design/features/escalation-abuse.design.md`

## Match Rate: 96%

## Summary

The Phase 8 implementation covers the approved hash-only abuse evidence, caller escalation,
office alert, report disposition, scoped Admin block, CAPTCHA hook, localized waiting-room action,
RLS, audit, and staging acceptance contracts. The only deliberate data-model deviation is deriving
the 60/180-second stages from immutable Contact Session creation time instead of persisting mutable
notice/offer timestamps.

## Implemented Items

- [x] Added hash-only `abuse_events`, `contact_reports`, and `caller_blocks`.
- [x] Enabled and forced RLS; denied browser access to abuse evidence.
- [x] Independently records rate-limit, repeated-block, and CAPTCHA failure evidence.
- [x] Enforces the active caller block before Contact creation on anonymous or network hash.
- [x] Requires caller session and participant hashes for escalation, office alert, and report.
- [x] Enforces the 60-second reminder and 180-second office-alert threshold.
- [x] Creates one idempotent ADMIN_ALERT notification and redacted audit.
- [x] Lets a centrally authorized Admin dispose a report and create a bounded caller block.
- [x] Uses the independently observed attempt network hash when creating a block.
- [x] Injects CAPTCHA verification and fails production closed without a provider.
- [x] Ships the waiting-room reminder and office action in Korean and English.
- [x] Proves premature denial, one alert, report, Admin block, repeated-request denial, audit, and
      zero Phase 8 residue in staging.

## Missing Items

- [ ] A production CAPTCHA provider adapter and its credential remain external pilot setup.

## Changed Items

- [x] Reminder and office-offer state is derived from `contact_sessions.created_at`; no mutable
      timestamp columns were added because the derived state is deterministic and replay-safe.

## Verification

- Linked pgTAP: Phase 8 32/32; complete linked suite passed.
- Phase 8 staging journey: 4/4 Public Contact tests passed.
- WCJ: 100 / C100 / J100 / W100.
- TypeScript: all 19 typecheck tasks passed.
- Abuse/Auth/fixture residue: zero in the bounded staging fixture cleanup.

## Recommendation

Proceed to the Phase 8 completion report and Phase 9 operational-readiness implementation. Keep
production CAPTCHA and real provider/device/print acceptance fail closed until external setup is
available.
