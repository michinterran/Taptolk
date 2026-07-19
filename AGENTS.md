# Taptolk Engineering Contract

## Authority

`TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` is the highest project specification.
Approved architecture documents under `docs/architecture/` refine it but do not
silently reduce its required scope.

## Modular implementation

- Do not hardcode business rules, user-facing copy, URLs, secrets, retention
  values, rate limits, state transitions, or provider behavior inside React
  components and route handlers.
- UI consumes typed content, DTOs, policies, and tokens through explicit module
  boundaries.
- Follow `UI -> Route Handler -> Application Service -> Domain Policy ->
  Repository/Transaction -> PostgreSQL`.
- Browser code must never import server environment modules, database clients,
  provider secrets, encryption keys, or service-role credentials.
- New packages need a real owner, public API, and tests. Do not create empty
  packages as placeholders.

## WCJ release gate

WCJ means `Web Compliance & Journey`.

- Run `pnpm validate:wcj` after every web page or component change.
- Run `pnpm verify` before reporting a phase complete.
- CI must fail when WCJ fails.
- WCJ automated success does not replace keyboard, screen-reader, computed
  contrast, responsive, real-device, and real-journey manual review.

## Session handoff protocol

- Create `docs/handoff-MMDD-HHmm.md` when a major feature unit is complete or
  when the same error begins repeating and a fresh session would reduce context
  and token waste.
- Every handoff records the current branch and commit, completed scope,
  validation evidence, unresolved risks, exact next step, and any required
  user-owned external setup. Never include credentials or secret values.
- Carry this protocol forward verbatim or by explicit reference in every later
  handoff document.
- After writing the handoff, notify the user that this is a safe checkpoint and
  recommend opening a new Codex session with the handoff path.

## Semantic Korean line breaks

- Headline lines in every supported language are authored as typed semantic line
  groups and rendered through
  the shared `SemanticHeading` component.
- Do not insert `<br>` based only on the current viewport or visual preference.
- Translate the meaning first; do not copy Korean line positions into English.
- Keep Korean words together with `word-break: keep-all`; allow long Korean and
  English content to wrap safely with `overflow-wrap`.
- Body copy uses language-aware natural wrapping.
- Controls and short labels do not wrap.
- Validate headline meaning and rhythm at 320, 768, 1280, and 1920 CSS pixels.

## Internationalization

- Every user-facing route uses the canonical `/ko` or `/en` locale segment.
- The first unlocalized request resolves `taptolk_locale` first and then the
  browser/OS `Accept-Language`; Korean resolves to `ko`, every other language to
  `en`.
- Explicit KO/ENG selection must persist and take priority on the next visit.
- User-facing copy belongs in the typed locale dictionary. Do not hardcode copy
  in page, component, route, application, or domain modules.
- New copy and states ship in Korean and English together. Missing translation
  keys, incorrect `<html lang>`, or a broken locale journey fail WCJ.

## Tenant and administration

- `tenant_id` is the highest customer isolation boundary and must be present in
  tenant-owned repository operations.
- Cross-tenant relationships use database constraints in addition to
  application validation.
- Authorization is enforced by the central RBAC policy before repository
  access, then independently by PostgreSQL RLS.
- Browser-accessible tables require explicit RLS policies and policy tests.
- Security-relevant mutations write a redacted audit row in the same
  transaction.
- Do not claim Phase 1 complete until migration reset, pgTAP, authenticated Site
  CRUD, and tenant-isolation E2E pass.

## Brand assets

- `design_concept/taptolk로고.png` is the immutable logo source.
- Its required SHA-256 is
  `971b7d919208f172a96dbc25c8ec9f641fc01522a1aa7a35fc90feb86f2e546f`.
- Never recolor, crop, redraw, filter, mask, stretch, or extract a replacement
  logo from another image.
- The deployable copy must remain byte-for-byte identical to the source.

## Security

- Do not log phone numbers, message bodies, OTPs, cookies, authorization headers,
  public QR tokens, activation codes, or response tokens.
- Never expose secret-like variables through `NEXT_PUBLIC_`.
- Tenant isolation is enforced in backend authorization and PostgreSQL RLS, not
  with frontend filtering.
- Preserve history for revoked QR assets, ended bindings, and expired sessions.
