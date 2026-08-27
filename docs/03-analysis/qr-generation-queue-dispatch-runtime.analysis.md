# Gap Analysis: QR Generation Queue Dispatch Runtime

> Date: 2026-07-19
> Design: `docs/02-design/features/qr-generation-queue-dispatch-runtime.design.md`

## Match Rate: 100%

The implementation satisfies all 36 code-level Design obligations. External Queue provisioning,
authenticated live staging publication, Docker reset/runtime pgTAP, and Production enablement are
acceptance gates explicitly excluded from this implementation match rate.

## Implemented items

### Configuration — 8/8

- Validated Queue name, claim limit, lease, duration, send timeout, retry base/max, and jitter.
- Enforced cross-field send-timeout and retry-delay relations.
- Added `.env.example` and Turbo pass-through ownership.
- Preserved the browser environment allowlist.
- Added staging-only projection and local/Production rejection tests.

### Supabase Queue publisher — 7/7

- Added the injected `pgmq_public.send` adapter.
- Sends only the strict v1 DTO with zero Queue delay.
- Uses a bounded abort signal.
- Accepts exactly one positive provider identifier.
- Reduces explicit throttling to `QUEUE_RATE_LIMITED`.
- Reduces malformed, permission, network, abort, and unknown failures to `QUEUE_UNAVAILABLE`.
- Does not propagate provider detail.

### Bounded Application runtime — 7/7

- Claims one job per coordinator call.
- Stops on an empty claim.
- Enforces the total claim cap.
- Checks the monotonic duration budget before each new claim.
- Aggregates all safe coordinator outcomes.
- Returns no job/Tenant/Site/Batch identity.
- Fails closed on invalid policy, clock, or coordinator result.

### Internal HTTP boundary — 8/8

- Added exact bearer parsing and timing-safe digest comparison.
- Rejects missing, malformed, repeated, and mismatched credentials.
- Rejects unavailable staging configuration before dispatch.
- Maps success, unauthorized, unavailable, and reduced runtime failure responses.
- Returns aggregate data and request ID only.
- Sets Node/dynamic/no-store Route behavior.
- Logs only safe event codes and aggregate outcomes.
- Next production build includes `/api/internal/qr-generation-dispatch`.

### Repository and security gates — 6/6

- The server-only runtime composes the existing dispatcher RPC repository, Application service,
  retry policy, coordinator, and Queue publisher.
- The existing admin Supabase client remains the credential owner.
- Request inputs cannot select Queue, policy, job, Tenant, or provider.
- `pnpm db:check` reports the canonical 22 migrations and 12 database tests.
- Secret scan and immutable logo verification pass.
- WCJ remains 100/100/100 and the full repository build passes.

## Missing items

None inside the approved implementation scope.

## Approved deviations

- Added `qr-generation-dispatch-configuration` and `qr-generation-dispatch-handler` pure modules
  plus tests. These make environment and HTTP policy independently testable while keeping the
  Route Handler thin.
- `@taptolk/db` uses a structural injected Supabase client boundary instead of taking a direct SDK
  dependency. The Web runtime already owns the approved SDK client, so this avoids duplicate
  dependency ownership without changing behavior.

## Validation evidence

- Focused runtime/provider/config/internal-boundary tests: 69 passed.
- Repository test run before the final handler addition: 29 files / 230 tests passed.
- Typecheck: 10 packages / 17 tasks passed.
- `pnpm db:check`: 22 migrations / 12 database tests.
- WCJ: total 100, C 100, J 100, W 100, 50 files.
- Node production start smoke:
  - local/missing configuration returns `503 UNAVAILABLE`;
  - staging-shaped configuration with no bearer returns `401 UNAUTHORIZED`;
  - both responses are `no-store` and contain a request ID.

## External gates

- Docker is not installed, so local reset and runtime pgTAP remain open.
- The staging Queue must be enabled/created and its server permissions verified externally.
- No authenticated live publish was executed; no delivery job was mutated by this analysis.
- Production remains disabled.

## Recommendation

Proceed to the PDCA completion report after the final full `pnpm verify` run.
