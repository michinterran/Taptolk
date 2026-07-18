# Taptolk

Taptolk is a QR-initiated, privacy-preserving vehicle communication platform.
The Phase 0 source foundation is complete, Korean/English i18n is active, and
the Phase 1 tenant/admin foundation is under validation against
`TAPTOLK_MASTER_DEVELOPMENT_SPEC.md`.

## Requirements

- Node.js 24.18.0
- Corepack
- pnpm 10.34.5
- Docker Desktop for Supabase Local

## Start

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev:web
```

Open `http://localhost:3000`. The first request uses the saved locale and then
the browser/OS language: Korean enters `/ko`, while every other language enters
`/en`. The header also provides an explicit KO/ENG selector.

## Quality gate

```bash
corepack pnpm validate:wcj
corepack pnpm verify:full
```

`WCJ` is the mandatory Web Compliance & Journey gate. A passing automated report
does not replace the manual checks documented in
`docs/architecture/wcj-web-compliance-journey-standard.md`.

All new user-facing copy must be added to the typed Korean and English
dictionaries together. Headings use semantic phrase groups per language rather
than viewport-specific `<br>` elements.

## External connections

Vercel, Supabase Staging/Production, SMS providers, and Sentry credentials are
not connected during the local Foundation stage. Never commit `.env` files.
