# i18n-foundation - Design

> Version: 1.0.0 | Date: 2026-07-18 | Status: Approved
> Plan: `docs/01-plan/features/i18n-foundation.plan.md`

## 1. Architecture

```text
GET /
→ proxy reads taptolk_locale cookie
→ otherwise parses Accept-Language
→ ko only when Korean is preferred
→ every other language falls back to en
→ redirect /ko or /en

GET /{locale}/...
→ locale param validation
→ locale dictionary
→ html lang + localized metadata/content
→ KO/ENG selector replaces only locale segment
→ selection cookie persists explicit preference
```

URL locale is the rendering source of truth. Cookie is only the next-visit preference and
`Accept-Language` is only the first-visit hint.

## 2. Modules

| Module | Responsibility |
|---|---|
| `i18n/config.ts` | supported locales, cookie name, default/fallback |
| `i18n/locale.ts` | normalize, detect, path replacement |
| `content/messages.ts` | typed KO/EN dictionaries |
| `components/locale-switcher.tsx` | accessible explicit selection |
| `proxy.ts` | unlocalized request redirect |
| `app/[locale]/layout.tsx` | html language and metadata |

The selector contains no translated business copy. Its accessible labels come from the active
dictionary.

## 3. Routing and Cache

- Localized pages use `/ko` and `/en`.
- `/api`, `/_next`, static files, and public assets bypass locale redirect.
- Unsupported locale segments return not found.
- Canonical/alternate metadata identifies both language URLs.
- Locale pages are statically generated where possible.

## 4. Cookie

| Property | Value |
|---|---|
| Name | `taptolk_locale` |
| Value | `ko` or `en` |
| SameSite | Lax |
| Path | `/` |
| Max-Age | 1 year |
| Secure | Production only |

The cookie contains no identity or personal data.

## 5. Accessibility and Content

- `<html lang>` matches the route.
- Current locale uses `aria-current`.
- Selector group has a localized accessible label.
- KO and EN dictionaries share the exact same key type.
- Heading lines are translated as semantic phrases, not by copying Korean line positions.
- WCJ rejects Hangul literals outside the content catalog and missing locale contracts.

## 6. Test Plan

- Unit: locale parsing, foreign fallback, path replacement.
- E2E: Korean detection, foreign detection, explicit switching, cookie priority.
- E2E: page language, translated heading, axe, 320px overflow.
- Build: both locale routes generated.
- WCJ: i18n module and selector markers required.

## 7. Rollback

Reverting proxy and `[locale]` routes restores the former single-locale shell. No database
migration or user data rollback is involved.
