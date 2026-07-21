# Taptolk Pilot Readiness Checklist

> Updated: 2026-07-21 | Current decision: AlimTalk ephemeral contact automated complete / Cron deferred / Manual and external gates pending

## Automated staging gates

- [x] Per-Batch quantity remains 1-100 across RPC, Application, Drizzle, and PostgreSQL CHECK;
      no single 1,000-item Batch contract.
- [x] Ten approved 100-item Batches generated 1,000 assets through Worker and `qr-generation`.
- [x] Intentional chunk stop, lease expiry, and resume completed without ordinal/token/QR
      Asset/activation duplicates.
- [x] Generation 1,000; duplicate 0; QR decode 1,000/1,000.
- [x] PDF/CSV/ZIP/manifest export 40/40 checksum and Storage ledger continuity.
- [x] Queue retry evidence present; poison active 0; Queue/Auth/fixture residue 0.
- [x] Owner activation, public contact, notification/reply, escalation/report/block journeys.
- [x] Privacy cleanup and operations KPI dashboard.
- [x] Kakao AlimTalk-shaped Owner notification contract and ephemeral A–B lifecycle: new
      `KAKAO_ALIMTALK` intent, typed `OWNER_CONTACT_REQUEST_V1`, Owner reply in Taptolk, caller
      completion, cookie removal, message/hash redaction, token revocation, participant close, and
      redacted audit. Clean local and linked pgTAP 24 files/604 tests; authenticated staging 5/5;
      `pnpm verify` PASS with lint 331, unit 54 files/336 tests, DB 59 migrations/24 tests, secret
      scan 557, WCJ 100 over 93 files, and Production build.
- [x] Linked pgTAP, authenticated staging E2E, WCJ, secret scan, logo integrity, and production
      build.
- [x] Full default staging suite: 28 PASS and one intentional opt-in 1,000-item acceptance skip.
- [x] 2026-07-20 closeout `pnpm verify:full`: lint 320 files, typecheck 19/19, unit 53
      files/326 tests, DB structure 55 migrations/22 tests, secret scan 518 text files,
      WCJ 100 over 87 files, production build, and local Chromium/mobile smoke 30/30.
- [x] Bounded health load and security-header regression gate.
- [x] Generated 100-item print source: 85mm geometry, decode 100/100, export checksums 4/4.
- [x] Production privacy-cleanup Cron source contract: bounded due-tenant selection, deterministic
      tenant/hour idempotency, credential-free hourly manifest, and static verifier.
- [x] Production Cron pgTAP: 16/16; complete linked database suite PASS.
- [x] 2026-07-20 pre-deployment revalidation: linked `taptolk-staging` is healthy in Seoul and
      migrations match through `20260719184000`; all 22 linked pgTAP files PASS; authenticated
      staging E2E 28 PASS with one intentional opt-in skip; `pnpm verify` PASS on checkpoint
      `215bb11`.
- [x] Created and linked the Vercel `taptolk` project with Root Directory `apps/web`, Next.js,
      Node 24.x, and zero active Cron definitions.
- [x] Deployed commit `896904e` with the default Cron-deferred manifest. Public KO/EN/health
      routes return 200, the unconfigured internal cleanup route fails closed with 503, and the
      staging-data Preview remains protected by Vercel team SSO.
- [x] Re-deployed verified closeout commit `0e2a15e` to the stable Production web alias.
      Deployment `dpl_GY6MvpfwEgCadGGuexntBdK9VvNP` is READY; public KO/EN/health return 200,
      cleanup remains fail closed with 503, and the live project reports zero active Cron
      definitions.
- [x] Preserved the approved hourly schedule in the inert
      `apps/web/vercel.production-cron.template.json` and added separate deferred/active
      verification gates.
- [x] Closed all 15 tracked PDCA features with analysis/report evidence. Architecture-only
      completion does not claim that every future Admin information-architecture route is
      implemented.
- [x] Repaired the Linux Chromium 320px login/signup overflow regression while preserving
      non-wrapping control labels; targeted 4/4 and complete local smoke 30/30 PASS.
- [x] GitHub Actions run `29705730777` passed source/DB/WCJ/build and Linux Chromium browser
      smoke for closeout commit `0e2a15e`.
- [x] GitHub Actions run `29705909265` passed the same required gates for handoff commit
      `3c420d1`.
- [x] Replaced the internal Phase/Foundation root screen with localized public landing and
      role-based onboarding pages. Caller and owner guidance remains QR/token led. The initial
      separate customer/platform pre-login presentation was superseded by the 2026-07-21 Task 2
      canonical administrator entry; post-login screens and authorization boundaries remain
      separate.
- [x] Public landing/onboarding WCJ and browser coverage: no internal development copy,
      KO/EN parity, semantic headings, Axe clean, and no horizontal overflow at 320 CSS pixels.
- [x] 2026-07-20 public-surface revalidation: linked pgTAP all 22 files PASS; `pnpm verify`
      PASS with lint 324 files, typecheck 19/19, unit 53 files/326 tests, DB structure 55
      migrations/22 tests, secret scan 526 text files, WCJ 100 over 91 files, and Production
      build.
- [x] Authenticated staging full-suite revalidation after the public-surface and TOTP fixture
      changes: 28 PASS and one intentional opt-in 10x100 acceptance skip. Owner activation,
      public contact, QR concurrency/residue cleanup, and Site tenant-isolation journeys all
      passed in one run.
- [x] GitHub Actions run `29716589923` passed source/DB/WCJ/build and Linux Chromium browser
      smoke for public-surface commit `6a78fd9`.
- [x] Production deployment `dpl_BAgu1XGxQeN97nab1op8ZGovyoQ3` is READY and aliased to
      `https://taptolk.vercel.app`. KO/EN landing, onboarding, customer login, platform login,
      and health return 200; unconfigured cleanup remains 503. Production browser verification
      found no console error or horizontal overflow at 1440 and 320 CSS pixels.
- [x] The Production deployment used the default Cron-deferred manifest. The active manifest has
      zero Cron definitions; the inert hourly template remains unchanged and the strict deferred
      verifier passes.
- [x] Installed and started the operator-approved Docker Desktop 4.82.0 runtime, verified its
      Docker-compatible daemon, and completed a clean local Supabase reset twice.
- [x] Clean local pgTAP: all 23 database test files and 587 tests PASS. The repeatable Queue
      baseline creates `qr-generation` with browser-role denial, service-role access, and RLS;
      its focused pgTAP is 12/12 PASS.
- [x] Applied the repeatable Queue baseline to linked staging and revalidated all 23 linked
      pgTAP files PASS through the repository's `pnpm db:test:linked` gate.
- [x] Post-reset authenticated staging revalidation: 28 focused journey tests PASS across Phase
      9 hardening, public contact, QR inventory, Site tenant isolation, and owner activation.
      The separate approved 10x100 acceptance remains an intentional opt-in skip.
- [x] 2026-07-20 Task 0 quantity-contract reconciliation: migration
      `20260720210000_qr_batch_quantity_contract.sql` aborts instead of deleting if any existing
      Batch exceeds 100; local and linked preflight counts were zero. Clean local reset passed
      twice, local and linked pgTAP passed all 23 files/590 tests, and `pnpm verify` passed with
      57 migrations, 23 database tests, and 327 unit tests.
- [x] Re-ran the explicit 10x100 staging acceptance after Task 0: 10 Batches, quantity 100 each,
      total 1,000, duplicate 0, decode 1,000/1,000, export/checksum 40/40, poison active 0, and
      fixture/Queue/Auth/Storage residue 0.
- [x] Revalidated the integrated Task 0 and public-copy tree: clean local reset twice; local and
      linked pgTAP 23 files/590 tests; authenticated staging E2E 28 PASS with only the explicit
      10x100 opt-in skip; local `pnpm verify` PASS.
- [x] GitHub Actions `29748841968` passed the public-copy/design commit and `29749378649` passed
      the bounded Vercel source commit, including source/DB/WCJ/build and Linux Chromium smoke.
      The latest CI gate includes 53 unit files/327 tests, 57 migrations/23 database tests,
      secret scan 539 files, WCJ 100 over 92 files, and build 11/11.
- [x] Production deployment `dpl_DTvj4RjQ68MnVYAXQKR6KexiEEM7` is READY and aliased to
      `https://taptolk.vercel.app`. KO/EN landing, customer login, platform login, and health
      return 200; unauthenticated cleanup returns 503 fail-closed.
- [x] Added an explicit `.vercelignore` deployment boundary after a pre-deployment size check
      detected local build/cache artifacts. No oversized upload or environment file was deployed.
      The completed deployment retained the default Cron-deferred manifest and zero active Cron
      definitions.
- [x] Implemented workorder Task 1 server-only stage policy and Service leak guard. Missing or
      invalid stage configuration fails closed to `SERVICE`; browser-controlled input is ignored;
      an actual Client Component import fails the Next build; the `SERVICE` guard is included in
      `pnpm verify`.
- [x] Task 1 post-change regression: linked pgTAP 23 files/590 tests, authenticated staging E2E
      28 PASS with one intentional 10x100 opt-in skip, and `pnpm verify` PASS with lint 329,
      typecheck 19/19, unit 54 files/334 tests, DB 57/23, secret scan 544, WCJ 100/92, and
      build 11/11.
- [x] 2026-07-21 workorder Task 2: public landing, onboarding, password sign-in, and Google callback
      now expose one canonical `/{locale}/admin/login` entry. The legacy platform-login URL is a
      server redirect only. Post-login routing still loads the approved profile, active
      membership, valid role/scope pairing, and MFA state on the server before opening the
      customer dashboard or the separate platform dashboard.
- [x] Task 2 validation: WCJ 100/100; linked pgTAP 23 files/590 tests; authenticated staging E2E
      30 PASS with one intentional 10x100 opt-in skip, including new Site Admin and Super Admin
      route/boundary proof; `pnpm verify` PASS with lint 330 files, unit 54 files/335 tests,
      DB 57 migrations/23 tests, secret scan 551 files, and Production build; local Chromium and
      Mobile Chrome smoke 36/36 PASS with 320/768/1280/1920 admin-login overflow and semantic
      heading coverage.

- [x] Separated the public landing from the administrator portal at the route group,
      layout, header/footer, metadata, and authentication-call boundary on commit
      `06e873f`. Existing URLs are unchanged, including the printed
      `/{locale}/q/{token}` form. The public surface carries zero administrator links,
      `proxy.ts` refreshes the administrator session only on administrator paths,
      `/{locale}/admin` introduces the workspace to management companies while keeping
      the canonical single sign-in and server-side role routing, and the whole
      administrator area is `noindex` and excluded from `sitemap.xml`.
      WCJ rule `J005` was rewritten to enforce zero administrator links on the public
      surface; it previously required an administrator sign-in link on onboarding.
      Evidence: lint 339 files, typecheck 19/19, unit 56 files/379 tests, DB structure
      59 migrations/24 tests, final secret scan 575 files, WCJ 100 over 99 files, production
      build, and local browser smoke 42/42. GitHub Actions `29802031226` passed on
      `6fe2efe`. The J005 review confirmed that zero public administrator links is the
      intended stricter product contract, not a gate relaxation.
- [x] 2026-07-21 surface-separation staging closure on `013a54b`: the linked target was
      confirmed as the approved healthy `taptolk-staging`; all 24 linked pgTAP files and
      604 assertions passed; authenticated staging E2E passed 31 tests with one intentional
      opt-in 1,000-item Worker acceptance skip. Evidence includes Site Admin plus MFA to
      customer dashboard, Super Admin plus MFA to platform dashboard, Site Admin platform
      denial, approval-pending account denial from five administrator workspaces and zero
      rows across five RLS-protected operational tables, plus existing QR/caller/Owner/admin
      and tenant-isolation regressions. `pnpm verify` and the Production Cron deferred gate
      passed with zero active Production Cron definitions.

## Manual and external pilot gates

- [ ] At actual service launch, move the Vercel project to Pro or Enterprise before activating
      `0 * * * *`; keep Cron deferred on Hobby.
- [x] Create/link the `taptolk` Vercel project and confirm Root Directory exactly `apps/web`.
- [ ] Create or grant access to a separate approved Production Supabase project and apply
      migrations through `20260721041000` (59 migrations). Only `taptolk-staging` was accessible
      for this lane during the audit.
      - **Data region approved 2026-07-21: Seoul (`ap-northeast-2`).** Chosen so that personal
        data stays in-country, which removes the cross-border transfer notice/consent section
        from the privacy policy and keeps parity with `taptolk-staging`. The region cannot be
        changed after project creation.
      - Organization `Taptolk` exists on the Free plan. Keep the organization-level Supabase
        Assistant opt-in at `Disabled` for the Production project as well.
      - Plan upgrade is deliberately NOT requested yet; decide it at actual service launch.
- [ ] Contract with an approved Kakao AlimTalk dealer, approve the business channel and
      `OWNER_CONTACT_REQUEST_V1` informational template, then authorize the live adapter,
      receipt/cost reconciliation, and failure rehearsal. Do not choose a dealer or configure
      template IDs or secret values until separately approved.
      - **Status 2026-07-21: blocked on business registration.** The operator is obtaining a
        Korean business registration certificate, which is a hard prerequisite for Kakao business
        channel verification (step 3 of the onboarding flow). Work resumes once it is issued.
      - Operator preparation steps, dealer selection criteria, the three product decisions
        (SMS fallback / non-KakaoTalk recipients / English template), and draft KO+EN
        informational templates are in `docs/deployment/kakao-alimtalk-onboarding-guide.md`.
      - Recommendation carried forward: contract with **SMS fallback disabled** so the owner's
        phone number is not additionally disclosed to an SMS carrier.
- [ ] Select and approve a Production phone-ownership verification provider. The AlimTalk
      informational template is not verification, and the current Production adapter remains
      fail-closed.
- [ ] Select a production CAPTCHA provider and authorize provider-adapter implementation and
      failure rehearsal; keep public Contact fail closed until then.
- [ ] At actual service launch, configure Production secrets only in the deployment secret
      manager, activate the reviewed Cron template, and follow
      `docs/deployment/production-privacy-cleanup-cron-runbook.md` for one authorized
      aggregate-only run, same-hour replay, duplicate-zero proof, monitoring, rotation, and
      rollback rehearsal.
- [ ] Verify representative iOS and Android devices across scan, contact, wait, and reply.
- [ ] Run VoiceOver and TalkBack hands-on journeys, including live announcements and focus order.
- [ ] Inspect computed contrast in production browser states.
- [ ] Print representative output on the target 85mm printer and confirm trim, size, adhesive, and
      scan distance.
- [ ] Decide and validate TUS resumable upload for artifacts above the reviewed large-file
      threshold.
- [ ] Complete production domain, environment, alerting, rollback, and incident owner review.
      - **Domain acquired 2026-07-21: `taptolk.com`.** DNS connection is deliberately deferred to
        just before service launch; the operator will consolidate DNS, admin subdomain, and
        environment wiring in one pass at that time.
      - ⚠️ **Before any physical sticker printing, the canonical QR host must be final.**
        `PUBLIC_QR_BASE_URL` is baked into each generated QR image, so printed stickers can never
        be repointed. Decide apex vs `www` at that point: `https://taptolk.com/q/{token}` is 65
        characters versus 69 for the `www` form, and both sit well under the 88-character URL that
        already passed 85mm print decode 100/100. Apex is recommended with `www` redirecting.
      - Admin host name (e.g. `admin.taptolk.com`) remains undecided and is settled during the
        same DNS pass. PRD Part A keeps a single-host default so development is not blocked.
- [x] Install and start an approved Docker-compatible local runtime, then complete a clean
      local Supabase reset. The operator approved Docker Desktop; version 4.82.0 is installed,
      its daemon responds, and the clean reset plus complete local pgTAP suite pass.

## Approval rule

Do not call the pilot `READY` or expose production traffic until every manual/external item is
checked by its accountable operator. Never put provider credentials or secret values in this
checklist, Git, logs, screenshots, or chat.
