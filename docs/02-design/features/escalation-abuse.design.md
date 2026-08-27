# escalation-abuse - Design Document

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for Implementation
> Plan: `docs/01-plan/features/escalation-abuse.plan.md`

## Data

- `abuse_events`: tenant/site/QR/session, anonymous/network hashes, type, reason, created time
- `contact_reports`: tenant/site/session, reporter type, reason, status/disposition, audit timestamps
- `caller_blocks`: tenant/site, anonymous/network hash, reason, expiry/revoke, Admin actor
- Contact Session additions: 60-second notice and 180-second office-offer timestamps

All browser access is denied; RLS is enabled/forced. Raw token, IP, User-Agent, phone, and message
body are absent.

## Commands

- `record_public_abuse_event`: service-only, independently committed after rate RPC rollback.
- `read_contact_escalation_state`: dual-hash caller read returning `WAITING`, `REMINDER`, or
  `OFFICE_AVAILABLE`.
- `request_contact_office_alert`: dual-hash lock, >=180 seconds, one ADMIN_ALERT intent,
  `ESCALATED`, redacted audit.
- `report_contact_session`: bounded reason and reporter scope.
- `process_contact_report`: scoped Admin disposition; BLOCK creates/extends hash-only block.
- `is_public_contact_blocked`: pre-create server check.

## Application hook

`PublicContactCaptchaVerifier` is injected into the public-contact service. The default staging
verifier returns pass; production can require a configured provider without changing routes or
domain policy. CAPTCHA tokens are never persisted or logged.

## UI

The waiting room shows a neutral delayed-response notice after 60 seconds and a localized
“관리사무소에 알리기 / Notify the site office” action after 180 seconds. It never displays the
internal term `ESCALATED`.

## Verification

pgTAP covers RLS/grants/hash-only columns/timing/one alert/audit. Staging E2E time-travels only
bounded fixture timestamps, proves premature denial and one 180-second action, and cleans all rows.
