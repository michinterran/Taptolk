# Kakao AlimTalk Ephemeral Contact - Plan Document

> Version: 1.0.0 | Date: 2026-07-21 | Status: Approved for Design
> Level: Dynamic

---

## 1. Overview

### 1.1 Purpose

Replace the SMS-shaped owner contact notification boundary with a Kakao AlimTalk-shaped,
provider-neutral contract while keeping all A–B communication inside a short-lived Taptolk Contact
Session. When the caller resolves the request or the session expires, access and message content
must be revoked or redacted immediately while the minimum redacted operational and audit history is
preserved.

### 1.2 Background

The implemented public-contact flow already creates a hash-scoped caller session, queues an owner
notification, issues a one-time Owner response token, and polls for a reply. Its provider types,
database channel, configuration, and master specification still describe SMS. The approved product
direction uses Kakao AlimTalk only to notify the Owner and carry a Taptolk response link; it does not
use Kakao Open Chat as the conversation surface.

## 2. Goals

### 2.1 Primary Goals

- [ ] Queue every new Owner contact notification as `KAKAO_ALIMTALK`; retain legacy `SMS` values
      only for historical compatibility.
- [ ] Expose a provider-neutral application interface with a typed
      `OWNER_CONTACT_REQUEST_V1` template payload and bounded KO/EN variables.
- [ ] Keep the response URL and destination ciphertext inside the server/provider boundary and keep
      production delivery fail-closed until an approved Kakao partner, channel, template ID, and
      credentials are configured.
- [ ] Add an explicit caller “complete request” action that atomically changes the session to
      `RESOLVED`, redacts message bodies, revokes response tokens, cancels queued deliveries, marks
      participants left, and writes a redacted audit event.
- [ ] Apply the same content redaction and access revocation to sessions that expire during privacy
      cleanup while retaining redacted session status, timestamps, audit, and aggregate records.
- [ ] Clear the caller browser session cookies after successful resolution.
- [ ] Ship KO/EN typed copy for the completion, working, forbidden/expired, and failure states.
- [ ] Preserve Owner, Vehicle, QR binding, central RBAC, PostgreSQL RLS, audit, and tenant boundaries.

### 2.2 Non-Goals

- Selecting a Kakao AlimTalk intermediary, channel, Production region, credential model, or secret.
- Registering or approving the final Kakao informational template in this session.
- Using Kakao Open Chat, Kakao Talk message APIs, SMS, or browser metadata for authorization.
- Selecting a Production Owner verification/OTP provider; non-Production verification remains a
  fail-closed staging adapter until separately approved.
- Enabling Production Cron, changing Vercel plans, assigning operations owners, or deploying to
  Production.
- Starting access-grant, Test Lab, or persona work.
- Changing QR quantity, QR enum/action labels, or the English term `caller`.

## 3. Scope

### 3.1 In Scope

- Domain and application provider naming, error policy, and typed notification template payload.
- Server runtime configuration and a staging-only AlimTalk simulator with no message or phone logs.
- Forward-only PostgreSQL migrations for the notification channel and terminal-session transaction.
- Caller resolution service, repository, route, cookie lifecycle, and waiting-room UI.
- Expiry cleanup semantics, pgTAP, unit tests, WCJ, staging E2E support, and documentation.
- Master specification, pilot readiness, PDCA analysis/report, and handoff updates.

### 3.2 Out of Scope

- Provider HTTP requests, live channel authentication, final template content/ID, Production secrets,
  or real Kakao delivery.
- Physical sticker operations and all QR inventory/state policy changes.
- Any retention or analytics expansion beyond redacted minimum history.

## 4. Success Criteria

- [ ] A new public Contact Session creates one `KAKAO_ALIMTALK` delivery intent and no new `SMS`
      intent.
- [ ] The dispatch service sends only the typed template key, locale, response URL, and bounded
      informational variables through a provider-neutral interface.
- [ ] Production cannot send through the staging simulator and missing provider configuration
      performs no external delivery.
- [ ] Caller resolution is idempotent, requires both server-hashed caller/session tokens, and makes
      subsequent read/reply attempts unavailable.
- [ ] Resolved and newly expired sessions contain only `[REDACTED]` message bodies; active Owner,
      Vehicle, and QR binding data is unchanged.
- [ ] Resolution/expiry writes no phone, message, OTP, QR, activation, or response token into logs,
      audits, docs, screenshots, or test output.
- [ ] `pnpm validate:wcj` runs immediately after the web component change; linked pgTAP, authenticated
      staging E2E, relevant unit tests, and `pnpm verify` pass.
- [ ] Production Cron remains at zero active definitions.

## 5. Schedule

| Phase | Target Date | Status |
|---|---|---|
| Plan | 2026-07-21 | Complete |
| Design | 2026-07-21 | In progress |
| Implementation | 2026-07-21 | Pending |
| Review | 2026-07-21 | Pending |

## 6. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| AlimTalk contract is mistaken for a configured provider | False service-readiness claim | Medium | Typed boundary and staging simulator only; Production remains fail-closed |
| Resolution deletes operational history | Audit/analytics loss | Medium | Redact bodies and revoke access while preserving terminal rows and redacted audits |
| Terminal cleanup races with Owner reply | Inconsistent response | Medium | One PostgreSQL transaction with row locks and terminal-state checks |
| New enum value breaks migration ordering | Deployment failure | Low | Add enum value in a dedicated forward migration before functions use it |
| UI completes without clearing browser authority | Post-resolution data access | Medium | Server route clears both opaque cookies after the DB transaction succeeds |
| Kakao template variables carry sensitive content | Privacy exposure | Medium | Informational reason code and one-time Taptolk URL only; no free-text body or plate number |

## 7. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`
- `docs/02-design/features/public-contact.design.md`
- `docs/02-design/features/notification-reply.design.md`
- `docs/deployment/pilot-readiness-checklist.md`
- `docs/handoff-0721-1034.md`
