# Gap Analysis: kakao-alimtalk-ephemeral-contact

> Date: 2026-07-21 | Design: `docs/02-design/features/kakao-alimtalk-ephemeral-contact.design.md`

---

## Match Rate: 100%

## Summary

The implemented boundary matches the approved design: new Owner contact intents are stored and
claimed as `KAKAO_ALIMTALK`, provider code receives a typed `OWNER_CONTACT_REQUEST_V1` payload,
Production remains fail-closed, and caller completion or TTL expiry revokes temporary authority and
redacts message content while preserving terminal session and audit history.

The official Kakao dealer, channel profile, template text/ID, and credentials are deliberately not
implemented. They are external launch inputs, not design gaps.

## Implemented Items

- [x] Provider-neutral error and dispatch interfaces replace SMS-specific application names.
- [x] Typed KO/EN-capable template payload contains only reason code and one-time Taptolk URL.
- [x] Caller free text and vehicle plate data no longer cross the provider contract.
- [x] Forward migrations preserve legacy enum history while all new Owner contact intents become
      `KAKAO_ALIMTALK` and workers claim that channel only.
- [x] Service-role-only idempotent resolution validates both caller/session hashes.
- [x] Terminal transition redacts body and content-derived hash, revokes response tokens, cancels
      undelivered notifications, and marks participants left in the same transaction.
- [x] Existing expiry cleanup enters the same terminal cleanup trigger without deleting session,
      QR, Owner, Vehicle, audit, or aggregate history.
- [x] The caller route clears both httpOnly cookies only after successful resolution.
- [x] KO/EN typed complete/working/error states and immediate WCJ validation are present.
- [x] Owner activation no longer depends on SMS configuration; its separate Production verification
      adapter remains unavailable until approved.
- [x] Master specification, environment example, design amendments, staging E2E, and pilot gates
      reflect the approved model.

## Missing Items

- None inside the approved code scope.

## Changed Items (Design-Preserving Implementation Choices)

- The existing historical session-creation function still emits its legacy enum literal internally;
  a database `BEFORE INSERT` guard converts every new `OWNER_CONTACT` intent to
  `KAKAO_ALIMTALK`. This avoids rewriting a large security-definer transaction while enforcing the
  new invariant at the table boundary.
- Terminal cleanup is centralized in one status-transition trigger, so explicit resolution and
  scheduled expiry cannot drift.
- The staging fixture exercises the Korean Owner template variant. The application contract accepts
  both `ko` and `en`; the final approved template-language mapping remains part of the live provider
  contract.

## Validation Evidence

- Immediate web gate: `pnpm validate:wcj` PASS, 100 / C100 / J100 / W100 over 93 files.
- Clean local reset: all 59 migrations applied.
- Local pgTAP: 24 files / 604 tests PASS.
- Linked staging pgTAP: 24 files / 604 tests PASS, including the new 14/14 contract.
- Authenticated staging public-contact E2E: 5/5 PASS.
- `pnpm verify`: lint 331 files; typecheck 19/19; unit 54 files/336 tests; DB 59 migrations/24
  tests; secret scan 557 files; logo, Service-stage, deferred-Cron, WCJ, and Production build PASS.
- Active Production Cron definitions were not changed and remain zero by source contract.

## Recommendation

Proceed to the report/checkpoint. Implement a live Kakao adapter only after the user supplies or
approves the official dealer, business channel, approved informational template ID/text, credential
field contract, receipt/cost mapping, and failure-rehearsal plan. Select Owner phone verification
separately; AlimTalk informational delivery is not identity verification.
