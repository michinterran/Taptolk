# Public Landing and Onboarding - Design

> Version: 1.0.0 | Date: 2026-07-20 | Status: Approved for implementation
> Level: Dynamic | Plan: `docs/01-plan/features/public-landing-onboarding.plan.md`

## 1. Experience direction

The public surface uses a calm road-signal editorial style: warm neutral space, deep ink type,
Taptolk violet for protected communication, and the immutable orange logo mark as a directional
accent. The memorable device is a simple `SCAN → SEND → REPLY` route line rather than a generic
dashboard card wall.

The landing answers three questions in order:

1. What does Taptolk protect?
2. How does a QR contact journey work?
3. Which entry point applies to me?

The onboarding page then routes each role without bypassing token or authorization boundaries.

## 2. Route and component architecture

| Route | Purpose | Primary action |
| --- | --- | --- |
| `/{locale}` | Public product landing | Open role-based onboarding |
| `/{locale}/onboarding` | Caller/owner/admin entry guidance | Follow the applicable verified route |
| `/{locale}/admin/login` | Customer operations login | Existing shared admin sign-in |
| `/{locale}/admin/platform/login` | Taptolk platform login | Existing shared admin sign-in |

`AdminLoginScreen` is a server component parameterized by `customer` or `platform`. Both entry
routes retain the same authentication action, session resolution, MFA, RBAC, and PostgreSQL RLS
boundaries. The parameter changes only localized introduction copy and the locale-switch path.

## 3. Content contract

- All new strings are keys in `apps/web/content/messages.ts`.
- Korean and English keys are identical by type.
- Every headline is passed as meaning-based lines to `SemanticHeading`.
- Caller copy says to scan the issued QR; it does not link to a tokenless contact form.
- Owner activation copy says to use the issued QR/activation route; the generic `/owner` action is
  limited to checking an already connected vehicle on the current device.
- Customer administrator and platform administrator labels are explicit before login.
- No Phase number, internal backlog, provider-readiness claim, or secret/configuration value is
  shown on the public landing.

## 4. Data and API

No new data model or API is introduced. Navigation uses localized server-rendered links. Existing
admin authentication, owner session, QR token, locale cookie, and protected route behavior remain
unchanged.

## 5. Planned files

- `apps/web/app/[locale]/page.tsx`
- `apps/web/app/[locale]/onboarding/page.tsx`
- `apps/web/app/[locale]/admin/login/page.tsx`
- `apps/web/app/[locale]/admin/platform/login/page.tsx`
- `apps/web/components/admin-login-screen.tsx`
- `apps/web/content/messages.ts`
- `apps/web/app/globals.css`
- `e2e/phase-0-health.spec.ts`
- `scripts/wcj/config.mjs`

## 6. Accessibility and responsive behavior

- Header navigation remains operable and wraps safely without wrapping short control labels.
- Reading order is logo/nav, hero, journey, audience, privacy footer.
- Cards use headings and links rather than click handlers on non-interactive containers.
- Focus indicators use the shared token; decorative route marks are `aria-hidden`.
- Hero line groups are checked at 320, 768, 1280, and 1920 CSS pixels.
- Automated Axe coverage includes both landing and onboarding; narrow-width horizontal overflow
  checks include both screens.

## 7. Test plan

- KO landing heading, localized routes, no internal development copy, no `<br>`, Axe clean.
- EN locale switch preserves the route and copy contract.
- Onboarding exposes distinct customer and platform login links.
- Token-led caller guidance has no generic caller-start link.
- Customer and platform login headings differ while sharing the same disabled fail-closed auth
  behavior in an unconfigured local environment.
- `pnpm validate:wcj`, focused browser tests, `pnpm verify`, linked pgTAP, and authenticated staging
  E2E are rerun where the available environment permits.

## 8. Security boundary

The public pages render static typed content only. They receive no phone number, message, OTP,
cookie, authorization header, QR/activation/response token, provider token, database credential,
or Cron bearer. Platform login separation is not authorization; central role resolution and RLS
remain authoritative after authentication.
