# Development/Test and Service Stage Policy

> Status: Approved direction / implementation pending  
> Current official stage: `DEVELOPMENT_TEST`  
> Date: 2026-07-20

## 1. Purpose

Taptolk separates the current development and shared-testing stage from the later live-service
stage. The current stage must make product and journey testing easy for the operator and approved
external testers without turning a shared URL into an authorization credential or weakening the
Production RBAC/RLS boundary.

This policy defines the product behavior and security boundary. It does not by itself enable a
new account, provider, Production project, secret, Cron, or paid plan.

## 2. Stage definitions

| Boundary | Development and test | Service |
| --- | --- | --- |
| Canonical stage | `DEVELOPMENT_TEST` | `SERVICE` |
| Runtime | Local and shared staging | Separate Production |
| Data | Synthetic test data only | Approved live data |
| Link sharing | Allowed | Public product URL |
| Registration | Shared-link signup enters approval pending | Invitation or approved customer onboarding only |
| Admin access | Approved test Super Admins may use Test Lab | Least-privilege assigned role only |
| Role testing | Super Admin, customer admin, and user personas | Disabled |
| Caller journey | Synthetic QR, no login | Issued QR, no login |
| Owner journey | Synthetic activation and mock provider behavior | Issued activation and approved provider |
| SMS/CAPTCHA | Mock, sandbox, or fail closed | Approved Production provider |
| Privacy cleanup | Manual authenticated test; active Cron `0` | Approved scheduled run and operations ownership |
| Billing decision | Keep Free/Hobby where limits permit | Decide from real traffic, reliability, and commercial requirements |

The server determines the stage from a server-only configuration boundary. Browser input, query
parameters, cookies, headers, and `NEXT_PUBLIC_` variables must not be able to change the stage.

## 3. Shared tester registration

The shared test URL may be sent to invited testers. Possession of the URL never grants an Admin or
Super Admin role.

1. A tester opens the shared test URL and signs up with the supported email or Google flow.
2. The account remains `approval pending` with no Tenant, Admin, QR, or user data access.
3. An existing active Super Admin at AAL2 reviews the account.
4. The Super Admin may grant a time-bounded **staging test access grant**.
5. Only a tester with both an active Super Admin membership and an active staging test access
   grant may open Test Lab.
6. The grant records the approver, reason, creation time, expiry, revocation, and redacted audit
   event.
7. Expired or revoked grants immediately remove Test Lab access without changing Production
   authorization.

The test access grant is an environment capability, not a new business role and not a JWT
`user_metadata` flag. The existing RBAC roles remain the only business authorization roles.

## 4. Test Lab capabilities

An approved staging test Super Admin signs in once and completes MFA once for the current session.
Test Lab then exposes clearly labeled, reversible test journeys.

### 4.1 Super Admin test

- Uses the tester's real staging Super Admin membership and existing AAL2/RBAC/RLS checks.
- May create, approve, suspend, reset, and inspect only synthetic staging fixtures.
- Every mutation is tagged as test activity in the redacted audit boundary.

### 4.2 Customer administrator test

- Supports Management Admin, Site Admin, Site Operator, and Read Only personas.
- A visual **preview** may render role-specific navigation but remains read-only and is labeled
  `UI preview`; it is not accepted as authorization or RLS evidence.
- A full behavior test uses a dedicated synthetic persona identity and actual scoped membership
  inside an isolated test Tenant/Management Company/Site.
- Mutating tests must pass the same Route Handler, Application Service, RBAC, repository, and RLS
  checks as a normal administrator.
- The Super Admin's unrestricted membership must never be reused to claim that a lower-role RLS
  test passed.

### 4.3 User test

- Caller: launches a synthetic QR journey without signup or login.
- Vehicle owner: launches a synthetic activation/owner journey with a staging-only mock OTP
  provider; no real phone number or message is used.
- Public-contact, wait, reply, report, and expiry paths operate only on isolated synthetic
  fixtures.
- Test QR, activation, response, and session material is never printed in UI diagnostics, logs,
  reports, screenshots, or chat.

### 4.4 Scenario lifecycle

- Test Lab provides `Create scenario`, `Reset scenario`, and `End scenario`.
- Each scenario has an owner, isolated fixture boundary, explicit expiry, and deterministic
  cleanup.
- A failed cleanup is visible to the test operator and blocks reuse of that scenario.
- Test actions never send a Production SMS, invoke an active Production Cron, or write live data.

## 5. Simplified shared-test login journey

The shared testing surface has one visible `관리자 로그인` entry.

1. The tester signs in once with Google or email.
2. The server loads the approved profile, membership, test access grant, and MFA state.
3. The server routes a normal administrator to the customer dashboard.
4. The server routes an approved staging test Super Admin to the platform dashboard with a
   separate `Test Lab` action.
5. Test Lab launches lower-role and user journeys without asking the tester to locate a different
   login URL.

The customer and platform areas remain distinct after login, but they do not require separate
authentication systems or separate account credentials. The shared test URL should rely on
Taptolk application authentication rather than adding a second Vercel Preview login for invited
testers.

## 6. Service-stage boundary

When `SERVICE` is activated:

- staging test access grants, Test Lab routes, persona launchers, mock OTP, scenario reset, and UI
  preview switching are unavailable and return not found;
- self-registration does not create any role or membership;
- every administrator receives only an approved business role and scope;
- no account may switch roles or impersonate another user;
- high-privilege roles retain the approved MFA policy;
- real user journeys use only issued QR/activation context and approved providers;
- Production data, credentials, provider tokens, and audit evidence never flow into staging.

Production builds and CI must fail if a test-only route, provider, fixture command, or environment
capability becomes reachable under the Service configuration.

## 7. Non-negotiable security rules

- Link possession is not authorization.
- No automatic Super Admin assignment after signup.
- No role or scope authorization from user-editable metadata.
- No service-role credential, provider secret, or test-session signing material in browser code.
- No frontend-only role filtering as a substitute for RBAC or RLS.
- Full lower-role acceptance uses a distinct test identity and scoped membership.
- Test-only capabilities are server-enforced and staging-bound.
- Security-relevant grants, persona launches, resets, and revocations write redacted audit rows.
- Only synthetic names and non-contact placeholder data are used.
- The QR Batch quantity remains `1..100`.
- Active Production Cron remains `0` until the separately approved service-launch gate.

## 8. Implementation order

1. Add a typed server-only stage policy and CI production-leak guard.
2. Unify the visible Admin login entry while preserving post-login role routing.
3. Add the time-bounded staging test access grant and Super Admin approval UI.
4. Add isolated synthetic scenario fixtures and Test Lab.
5. Add actual lower-role persona sessions and public/owner test launchers.
6. Add deterministic cleanup, redacted audit coverage, pgTAP, and authenticated staging E2E.
7. Re-run clean local reset, complete pgTAP, authenticated staging E2E, WCJ, and `pnpm verify`
   before calling the shared-test stage complete.

## 9. Acceptance criteria

- A user who only has the shared URL has no privileged access.
- An unapproved signup sees approval pending and cannot read Tenant/Admin data.
- An approved staging test Super Admin can test Super Admin, customer administrator, caller, and
  owner journeys from one Test Lab.
- UI preview is visibly distinguished from full authorization testing.
- Lower-role mutation tests use actual scoped RLS, not the Super Admin session.
- A Service-configured build exposes no Test Lab or mock-provider capability.
- No real phone number, message, OTP, QR/activation/response token, cookie, authorization header,
  credential, or secret appears in Git, documentation, logs, screenshots, or chat.
