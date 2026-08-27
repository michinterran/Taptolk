# PDCA Report — Public Landing and Administrator Portal Separation

> Branch: `codex/phase-1-foundation`
> Baseline commit: `6c8413f`
> Implementation commit: `06e873f`
> Staging gate commit: `013a54b`
> Date: 2026-07-21
> Scope source: `docs/development/prd-public-user-admin-portals-0721.md`

---

## Plan

Two audiences shared one entry screen. Someone scanning a vehicle QR in a parking lot
and a management company administrator both landed on the same page, which advertised
administrator sign-in to every visitor and coupled the anonymous public journey to the
administrator authentication provider.

The plan was to separate the two surfaces at four levels — route group, layout, header
and footer, and authentication call boundary — without changing a single existing URL,
because QR addresses are printed on physical stickers and cannot be repointed.

## Do

### Route groups

`[locale]/(public)` now holds the landing, onboarding, QR, caller waiting room,
activation, response, and owner routes. `[locale]/(admin)` holds the administrator
area. Route groups do not appear in URLs, so all addresses are byte-identical to the
baseline.

Each group owns its layout. The administrator group keeps `force-dynamic` and adds
`noindex, nofollow, nocache`.

### Authentication boundary

`apps/web/routing/app-routes.ts` is the single classifier and locale-aware route
builder. `proxy.ts` continues to resolve locale on every route but calls
`client.auth.getClaims()` only on administrator paths.

Before this change the middleware refreshed the administrator Supabase session on
`/ko`, `/ko/q/{token}`, `/ko/c/{token}`, `/ko/activate/...`, `/ko/respond/...`, and
`/ko/owner`. An anonymous QR scan now has no dependency on the administrator
authentication provider.

### Public landing

Rewritten around service introduction, three caller steps, four vehicle owner steps,
four privacy statements, and six FAQ entries. Every sign-in, sign-up, and administrator
link was removed, along with any control implying a request could begin without an
issued QR. The onboarding page lost its administrator card for the same reason.

### Administrator portal

`/{locale}/admin` renders a management-company introduction — the seven-step
post-contract workflow, eight operational features, and five approval and security
statements — and routes to the existing canonical sign-in and sign-up.

An authenticated administrator is still routed by the server from the approved profile,
active membership, role/scope, and MFA state. The browser never selects between the
customer and platform workspaces. Enterprise SSO is not claimed because it is not
implemented.

### SEO

`sitemap.xml` lists only the four public introduction pages. `robots.txt` disallows the
administrator surface, every token-bearing route, and `/api/`.

## Check

### Contract change recorded

WCJ rule `J005` previously required the public onboarding page to contain an
`/admin/login` link. That directly contradicted the new requirement of zero
administrator links on the public surface. The rule was rewritten to enforce the
stricter reading: no administrator link anywhere on the public surface, semantic
headings on landing, onboarding, and the portal, and a single canonical sign-in.

This is a deliberate gate change and is called out here and in the handoff so it is not
mistaken for a silent weakening.

The staging-gate review confirmed that this change matches the product contract. The
previous rule forced an administrator entry onto a public surface; the revised rule
keeps administrator discovery out of the public journey while preserving the single
canonical sign-in and server-only post-login role routing. No relaxation was found.

### Automated evidence

| Gate | Result |
|---|---|
| lint | 339 files PASS |
| typecheck | 19/19 tasks PASS |
| unit | 56 files / 379 tests PASS |
| DB static contract | 59 migrations / 24 database tests |
| GitHub Actions | `29802031226` PASS on `6fe2efe` |
| linked pgTAP | approved `taptolk-staging`, 24 files / 604 assertions PASS |
| authenticated staging E2E | 31 PASS / 1 intentional opt-in skip |
| secret scan | 575 text files PASS after documentation update |
| immutable logo | required SHA-256 PASS |
| Production Cron deferred | active definitions 0 PASS |
| WCJ | 100 · C100 · J100 · W100 over 99 files |
| production build | PASS |
| local browser smoke | 42/42 PASS (Chromium + mobile Chromium) |

### Boundary checks performed

- Public landing: 0 `/admin` links, 0 forms, 0 sign-in/sign-up controls, all three
  required sections present, no horizontal overflow.
- Administrator portal: HTTP 200, semantic `h1`, workflow/features/approval sections,
  canonical `login` and `signup` links, `noindex, nofollow, nocache` meta, no
  platform-specific login link, no browser-side role selector.
- `/admin` without a locale segment redirects to `/ko/admin` under a Korean browser
  preference.
- `sitemap.xml` contains no administrator path and no token-bearing path.
- New unit coverage: 34 route classifier assertions and dictionary parity, public-copy,
  and portal-copy guards.
- Site Admin plus MFA reaches the customer dashboard and is redirected away from the
  platform workspace.
- Super Admin plus MFA reaches the separate platform dashboard.
- An approval-pending account is redirected to the access state from all five
  administrator workspaces and reads zero rows from five representative RLS-protected
  operational tables.
- Existing Owner activation, caller/contact, QR inventory, Site CRUD, maker-checker,
  tenant-isolation, cleanup, and administrator authentication journeys passed in the
  same full staging run.

## Act

Kept as-is: existing URLs, canonical single administrator sign-in, customer and
platform separation, central RBAC, PostgreSQL RLS, MFA, redacted audit, KO/EN
dictionary parity, SemanticHeading, immutable logo, QR `1..100` per-batch contract, EN
`caller`, QR enums and action labels, and zero active Production Cron definitions.

Not started, by instruction: Task 3 access grant, Test Lab, persona features, the live
Kakao AlimTalk provider, Production deployment, domain connection, Production Supabase
project and region, Production secrets, CAPTCHA or any new authentication provider,
enterprise SSO, Vercel plan changes, Cron activation, and monitoring or incident owner
assignment.

The previously deferred linked pgTAP and authenticated staging E2E gates are complete.
The first new approval-pending probe exposed an incorrect test table name, not an access
leak; it was corrected to real RLS-protected operational tables. A later run exposed an
existing TOTP-window timing flake during cold Server Action compilation, so the staging
fixture now requires 18 seconds of code validity. The final full suite passed in one
run. No Production deployment or domain change was performed.
