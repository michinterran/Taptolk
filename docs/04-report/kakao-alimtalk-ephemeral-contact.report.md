# Kakao AlimTalk Ephemeral Contact - Completion Report

> Date: 2026-07-21 | Decision: AUTOMATED IMPLEMENTATION COMPLETE / LIVE PROVIDER AND MANUAL GATES PENDING

## Outcome

Taptolk now treats Kakao AlimTalk as the one-way notification that wakes Owner A and carries a
one-time Taptolk response link. Caller B and Owner A communicate only inside the temporary Taptolk
Contact Session. Kakao Open Chat and SMS are not part of the active service flow.

When B completes a replied request, PostgreSQL atomically marks the session `RESOLVED`, redacts
both message bodies and their content-derived hashes, revokes response tokens, cancels undelivered
notification work, closes participant access, and writes a redacted audit. The same cleanup runs
when a session expires. Owner, Vehicle, QR binding, terminal status, audit, and aggregate history
remain available for future scans and operations analysis.

## Provider and Template Boundary

- Application template key: `OWNER_CONTACT_REQUEST_V1`.
- Bounded variables: `reasonCode` and the one-time Taptolk HTTPS response URL.
- Caller free text, phone numbers, plate data, QR token, activation code, OTP, and raw audit data are
  excluded from the provider payload.
- The staging simulator proves the full journey without an external send.
- Production remains fail-closed. No Kakao dealer, channel, template ID, credential, or secret was
  selected or configured.

The final informational message template should be supplied and registered when the Kakao AlimTalk
dealer contract and business-channel connection are available. At that point the approved Kakao
template ID is mapped to the existing typed key; the application flow does not need to be redesigned.

## Verification

- Clean local migration reset PASS.
- Local and linked pgTAP: 24 files / 604 tests PASS.
- Authenticated staging A–B lifecycle: 5/5 PASS.
- WCJ: 100 / C100 / J100 / W100 over 93 files.
- Full `pnpm verify` PASS: lint 331; typecheck 19/19; unit 54 files/336 tests; DB 59/24; secret
  scan 557; logo, Service-stage, Production Cron deferred, and Production build PASS.
- QR 1–100 per-Batch, English `caller`, QR enums/action labels, central RBAC, RLS, MFA, and audit
  boundaries were not weakened or changed.

## Remaining Gates

- Official Kakao AlimTalk dealer and channel contract.
- Approved KO/EN informational template text and template ID.
- Live adapter credentials, receipt/cost reconciliation, throttling, and failure rehearsal.
- Separate approved Owner phone-ownership verification provider.
- Manual keyboard, screen-reader, computed-contrast, and representative real-device review.
- User-owned Production project/region, secrets, Vercel plan, Cron activation, and operations owners.

No Production deployment or Cron activation was performed.
