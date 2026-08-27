# Gap Analysis: Public Contact

> Date: 2026-07-20
> Design: `docs/02-design/features/public-contact.design.md`

## Match Rate: 97%

Phase 6 acceptance is complete. The implementation satisfies the ACTIVE public QR inspection,
vehicle confirmation, reason/message policy, atomic Contact Session creation, hash-only caller
recovery, owner-data non-disclosure, reconnect recovery, and adaptive polling contracts.

## Implemented items

### Domain and application policy

- Typed reason allowlist, 200-character limit, URL/email/phone/threat filtering, repeat detection,
  fixed rate boundaries, and adaptive 3/5/10/15-second polling policy.
- Purpose-separated HMAC for public QR, anonymous identity, session recovery, network, user agent,
  message, and notification idempotency values.
- Typed inspect/create/read application services. Raw public, anonymous, and session tokens remain
  outside database lookup columns, audit payloads, and logs.

### Database transaction and isolation

- Added Contact Session, participant, message, notification intent, and public attempt ledgers.
- Added tenant/site/QR composite constraints, RLS enable/force, service-only privileges, immutable
  history triggers, and browser-role denial.
- One service-only transaction validates ACTIVE QR and active contract scope, applies rate and
  duplicate-session policy, creates or merges the session, stores one initial caller message,
  enqueues exactly one notification intent, and writes redacted audit.
- Same anonymous caller, QR, and reason within three minutes merges without duplicate session,
  message, delivery, or creation audit.

### KO/EN public journey

- Added canonical `/ko|en/q/{publicToken}` inspection, confirmation, reason, message, review, send,
  and waiting-room flow.
- Added cookie-only `/ko|en/c/current` recovery. The raw Contact Session token is never rendered
  into HTML, JSON, or a client-visible route parameter.
- Added HttpOnly, SameSite=Lax anonymous and session cookies plus same-origin/no-store APIs.
- Added adaptive polling, visibility-aware retry, stable waiting state, and truthful Phase 6 copy
  that says notification preparation rather than claiming an SMS was sent.
- Preserved typed KO/EN semantic headings and the immutable logo.

### Verification

- Phase 6 linked pgTAP passed 50/50; the full linked database suite passed.
- Public Contact staging E2E passed 2/2.
- Full authenticated staging E2E passed 23 tests with one explicit long-running 1,000-item
  acceptance skip.
- Caller send completed under 20 seconds and reconnect restored the exact session.
- Owner identity, phone, destination hash, and raw session token were absent from caller DTOs.
- URL, phone, email, and over-limit content were rejected before persistence.
- Axe violations were zero and 320/768/1280/1920 overflow checks passed.
- Contact, Owner, Auth, and bounded fixture cleanup assertions reported residue zero.
- WCJ remained 100/C100/J100/W100; `pnpm verify` passed.

## Approved deviations

- The waiting route uses `/c/current` rather than placing the raw session token in the URL. The
  HttpOnly cookie remains the sole browser recovery credential, reducing referrer, history, and
  screenshot exposure without reducing the Phase 6 journey.
- Phase 6 creates a durable `QUEUED` notification intent but does not call an SMS provider or claim
  delivery. Queue leasing, provider adapter, retry, delivery state, and Response Token belong to
  Phase 7.
- Rate-limited attempts raise inside the creation transaction, so blocked rows are not retained in
  the Phase 6 append-only attempt ledger. Phase 8 will add a separately committed abuse-event
  boundary for durable blocked-attempt evidence.

## Evidence boundary

Automated browser checks cover keyboard navigation, axe, computed layout, cookie attributes,
responsive widths, and the real staging database. They do not constitute physical screen-reader
sessions or representative iOS/Android real-device checks. Those remain Phase 9 pilot gates.

## Recommendation

Close Phase 6 and begin Phase 7 Notification and Reply. Consume the existing notification intent
through a leased Queue, issue a 256-bit hash-only Response Token with a 60-minute TTL, enforce
idempotent provider sends and bounded retries, add Owner quick reply and caller polling, and prove
duplicate SMS zero, retry recovery, reply visibility, expiry, and residue zero.
