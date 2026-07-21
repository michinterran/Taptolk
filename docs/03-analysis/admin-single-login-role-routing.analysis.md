# Gap Analysis: Admin Single Login and Server Role Routing

> Date: 2026-07-21 | Source: workorder Task 2 | Match rate: 100%

## 1. Compared Sources

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`
- `docs/development/codex-workorder-0720-2055.md` Task 2
- `docs/02-design/features/admin-console-architecture.design.md`
- Current authentication, routing, public-entry, locale, and E2E implementation

## 2. Requirement Match

| Requirement | Implementation evidence | Result |
| --- | --- | --- |
| One visible administrator entry | Public header, landing, onboarding, password, and Google flows use `/{locale}/admin/login`; legacy platform login is a server redirect | Match |
| Approved profile | `loadAdminContext` loads the server-visible profile and central access policy requires `ACTIVE` | Match |
| Approved membership | Only active memberships are loaded and selected | Match |
| Valid scope | Central membership selection rejects invalid role/scope pairings | Match |
| MFA state | TOTP factor and AAL drive enrollment, challenge, or ready decisions | Match |
| Separate customer/platform areas | Ready role routes to `/admin/dashboard` or `/admin/platform`; cross-area requests redirect to the authorized area | Match |
| KO/EN and states | Typed copy covers the unified entry, loading, configuration/error, expired session, and access denied | Match |
| Release evidence | WCJ, linked pgTAP, authenticated staging role routing, full staging regression, smoke, and `pnpm verify` pass | Match |

Match rate: **8/8 = 100%**.

## 3. Security Review

- Browser `area` form data and OAuth callback area parameters were removed.
- Role routing uses server-loaded database profile/membership/scope and authenticated AAL only.
- Central RBAC, PostgreSQL RLS, MFA, redacted audit, and separate screen boundaries remain intact.
- No Task 3 grant, Test Lab, persona, provider, Production secret, plan, or Cron change was added.

## 4. Open Manual Boundary

Automated browser coverage confirms Axe, KO/EN, semantic heading structure, and overflow at
320/768/1280/1920 CSS pixels. Hands-on keyboard, screen-reader, computed-contrast, and real-device
review remain manual pilot gates and are not marked complete.
