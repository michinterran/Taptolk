# Public Landing and Onboarding - Plan

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for implementation
> Level: Dynamic

## 1. Overview

### 1.1 Purpose

Replace the internal Phase 0 foundation screen at `/{locale}` with a public product landing page
and add `/{locale}/onboarding` as the safe role-based entry point for callers, vehicle owners,
customer administrators, and Taptolk platform administrators.

### 1.2 Background

The deployed root currently exposes implementation language such as `Phase 0 · Foundation` and
does not explain how a real user enters the QR journey. Customer administrator and platform
administrator access are also not visibly separated before login.

## 2. Goals

- Present the verified Taptolk purpose and privacy boundary without internal development copy.
- Explain the token-led caller and owner journeys without inventing a generic contact flow.
- Separate customer administrator and Taptolk platform administrator login entry points.
- Ship Korean and English copy, semantic headline groups, responsive behavior, and WCJ coverage.

### 2.1 Non-goals

- No SMS, CAPTCHA, Production database, secret, Cron, pricing, or provider configuration.
- No change to authentication, RBAC, RLS, QR lifecycle, or the `1..100` per-Batch policy.
- No generic QR token input or substitute for scanning an issued Taptolk QR.

## 3. Scope

### 3.1 In scope

- Public landing at `/{locale}`.
- Role-aware onboarding at `/{locale}/onboarding`.
- Dedicated platform login entry at `/{locale}/admin/platform/login` using the shared auth
  boundary.
- Typed KO/EN copy, shared visual styles, metadata, and browser tests.
- Pilot checklist, PDCA analysis/report, and handoff updates.

### 3.2 Out of scope

- Production service activation and external/manual pilot gates.
- New onboarding persistence, account types, database tables, or API endpoints.
- Changes to protected administrator authorization after sign-in.

## 4. Success criteria

- No public landing copy exposes Phase numbers, foundation status, or implementation backlog.
- Landing and onboarding make caller, owner, customer admin, and platform admin entry rules clear.
- Customer admin and platform admin have distinct localized URLs and headings before login.
- Token-required actions do not provide a fake generic start link.
- KO/EN, 320/768/1280/1920 heading rhythm, keyboard focus, responsive overflow, and automated
  accessibility checks pass.
- `pnpm validate:wcj` passes after UI changes; the final repository verification is rerun.

## 5. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A generic CTA bypasses token security | Explain that callers and new owners start from the issued QR |
| Separate login screens drift | Reuse one server component and the existing sign-in action |
| Marketing copy overstates provider readiness | Limit claims to implemented privacy and mediated journey contracts |
| New layout regresses narrow screens | Add 320px browser coverage and safe grid min-width rules |

## 6. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` sections 1.1, 1.3, 6.4, 6.6
- `AGENTS.md`
- `docs/architecture/wcj-web-compliance-journey-standard.md`
- `docs/handoff-0720-0717.md`
