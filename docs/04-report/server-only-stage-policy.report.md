# Server-only Stage Policy and Service Leak Guard Report

> Date: 2026-07-20
> Branch: `codex/phase-1-foundation`
> Implementation commit: `9c768b5`
> Stage: `DEVELOPMENT_TEST`
> Decision: Task 1 complete / Task 2 not started

## 1. Plan

Implement the first approved stage-policy slice without adding Test Lab, access grants, personas,
mock providers, Production settings, or authorization shortcuts.

The slice had four security goals:

1. one typed server-only stage source;
2. fail closed to the more restrictive `SERVICE` stage;
3. reject browser control over stage selection;
4. give CI an extensible registry and guard for later test-only surfaces.

## 2. Do

### 2.1 Typed server boundary

Added `@taptolk/config/stage/server`.

- Canonical stages are `DEVELOPMENT_TEST` and `SERVICE`.
- Only the exact server value `TAPTOLK_STAGE=DEVELOPMENT_TEST` enables test capabilities.
- Missing, blank, and invalid values resolve to `SERVICE`.
- The result records whether Service was explicitly configured or selected by fail-closed
  handling.
- `requireDevelopmentTestStage` provides the central denial boundary for later test-only
  surfaces.
- The module starts with `import "server-only"` and is exported only through the explicit
  `stage/server` package path.

### 2.2 Browser isolation

The resolver accepts only the server stage field and reads its default from
`process.env.TAPTOLK_STAGE`. Tests pass stage-like `NEXT_PUBLIC_`, cookie, header, and query values
and prove they do not affect the result.

An uncommitted proof-only Client Component imported the stage module. Next production build
failed with the expected `server-only` Client Component error. The proof file was then removed,
and the normal production build passed.

### 2.3 Service leak guard

Added `config/service-stage-test-surfaces.json` and `scripts/verify-service-stage.mjs`.

- The guard must run with `TAPTOLK_STAGE=SERVICE`.
- It verifies the server-only entry point and rejects browser environment exposure.
- Future production source marked `@taptolk-test-only` must be registered.
- Every registered route, provider, fixture command, or environment capability must declare
  `NOT_FOUND` Service behavior and use `requireDevelopmentTestStage`.
- The current registry is intentionally empty because Task 1 adds no test-only product surface.
- `verify:service-stage` is included in the repository `pnpm verify` chain.

## 3. Check

| Gate | Result |
| --- | --- |
| Config focused typecheck | PASS |
| Stage policy unit tests | 7/7 PASS |
| Browser-controlled input ignored | PASS |
| Missing/invalid fail closed | PASS |
| Actual Client Component import build | Expected failure confirmed |
| Service static guard | PASS; 0 registered surfaces |
| Full `pnpm verify` | PASS |
| Linked pgTAP after change | 23 files / 590 tests PASS |
| Authenticated staging E2E after change | 28 PASS / 1 intentional opt-in skip |

Full repository verification:

- lint 329 files;
- typecheck 19/19;
- unit 54 files / 334 tests;
- DB static 57 migrations / 23 tests;
- secret scan 544 files;
- immutable logo PASS;
- Service stage guard PASS;
- Production Cron deferred PASS;
- WCJ 100 / C100 / J100 / W100 over 92 files;
- build 11/11 PASS.

## 4. Act

Task 1 is complete. Task 2 may now unify the visible administrator login while preserving:

- server-side approved-role routing;
- distinct customer and platform authorization areas;
- MFA, central RBAC, repository, and PostgreSQL RLS;
- KO/EN typed copy and WCJ;
- authenticated staging role-routing evidence.

Task 2 must not add a second authorization system, infer roles from browser metadata, or begin
Task 3 grants/Test Lab work.

## 5. External boundary

No Production project, region, provider, secret, monitoring owner, plan, or Cron setting was
selected or changed. Active Production Cron remains zero. The last deployed public commit remains
`f022ca0`; Task 1 is repository/staging verified and is not separately deployed in this report.
