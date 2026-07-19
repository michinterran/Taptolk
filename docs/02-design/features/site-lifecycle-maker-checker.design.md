# site-lifecycle-maker-checker - Design

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for implementation
> Level: Dynamic
> Plan: `docs/01-plan/features/site-lifecycle-maker-checker.plan.md`

## 1. Architecture

```text
Localized Site catalog / approval queue
→ Site lifecycle server actions
→ SiteLifecycleRequestService
→ central RBAC + scope + maker-checker policy
→ authenticated Supabase repository
→ scoped SELECT or reviewed PostgreSQL RPC
→ site_lifecycle_requests + Site status + redacted audit
```

The existing direct Site lifecycle command remains unchanged. Request controls and approval queue
use a separate Application Service and repository so request permission can never be interpreted as
direct mutation permission.

## 2. Domain and application policy

### 2.1 Actions and transitions

| Request action | Required current status | Result after approval |
|---|---|---|
| `SUSPEND` | `ACTIVE` | `SUSPENDED` |
| `REACTIVATE` | `SUSPENDED` | `ACTIVE` |
| `CLOSE` | `ACTIVE` or `SUSPENDED` | `CLOSED` |

`CLOSED` is terminal. Reactivation also requires ACTIVE Tenant and Management Company. Close
retains the existing active-contract guard.

### 2.2 Permissions

- Request `SUSPEND`/`REACTIVATE`: `site:suspend-request`
- Approve/reject `SUSPEND`/`REACTIVATE`: `site:suspend-approve`
- Request `CLOSE`: `site:archive-request`
- Approve/reject `CLOSE`: `site:archive-approve`
- Cancel: original requester plus the original request permission and current scope

The service calls `authorizeAdminAction` with immutable scope loaded in the Site catalog/read
model. PostgreSQL independently reloads Site and membership scope. MFA follows the central role
policy: Super, Management Admin, and Site Admin require AAL2; Platform Operator follows its
currently approved AAL policy.

### 2.3 Maker-checker invariants

- `requested_by <> reviewed_by`
- Only `PENDING` may transition to a terminal request status.
- `APPROVED`, `REJECTED`, and `CANCELLED` are immutable.
- Only the requester may cancel.
- A stale request version rejects review/cancel.
- A stale Site version rejects approval without terminalizing the request.

## 3. Data model

The canonical field specification is in `docs/01-plan/schema.md`.

```text
Tenant 1 ── * SiteLifecycleRequest
ManagementCompany 1 ── * SiteLifecycleRequest
Site 1 ── * SiteLifecycleRequest
AuthUser 1 ── * SiteLifecycleRequest (requested_by)
AuthUser 1 ── * SiteLifecycleRequest (reviewed_by)
```

Database types:

- `site_lifecycle_action`: `SUSPEND`, `REACTIVATE`, `CLOSE`
- `site_lifecycle_request_status`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`

Indexes:

- `(tenant_id, status, created_at desc)`
- `(site_id, status, created_at desc)`
- unique `(site_id)` where `status = 'PENDING'`

The request row uses a composite Site FK over
`tenant_id + management_company_id + site_id`. Physical deletion is not exposed.

## 4. PostgreSQL command contracts

| Function | Input | Atomic output |
|---|---|---|
| `request_site_lifecycle` | Site ID, expected Site version, action, reason, audit request UUID | pending request + `SITE_LIFECYCLE_REQUESTED` audit |
| `approve_site_lifecycle_request` | lifecycle request ID, expected request version, review reason, audit request UUID | Site status + approved request + `SITE_LIFECYCLE_REQUEST_APPROVED` audit |
| `reject_site_lifecycle_request` | lifecycle request ID, expected request version, review reason, audit request UUID | rejected request + `SITE_LIFECYCLE_REQUEST_REJECTED` audit |
| `cancel_site_lifecycle_request` | lifecycle request ID, expected request version, reason, audit request UUID | cancelled request + `SITE_LIFECYCLE_REQUEST_CANCELLED` audit |

Every function is `SECURITY DEFINER SET search_path = ''`, fully qualifies objects, checks
`auth.uid()`, active membership, role/scope/AAL, request state and versions, and revokes execute
from `PUBLIC` and `anon`.

Approval audit allowlist:

```json
{
  "action": "SUSPEND",
  "requestStatus": "APPROVED",
  "requestVersion": 2,
  "siteStatus": "SUSPENDED",
  "siteVersion": 4
}
```

The reason belongs in the dedicated audit `reason` column, not JSON. Email, address, phone,
message, claims, tokens, cookies, and authorization headers are excluded.

## 5. Read model and repository

```ts
interface SiteLifecycleRequestItem {
  action: "SUSPEND" | "REACTIVATE" | "CLOSE";
  createdAt: string;
  id: string;
  managementCompanyId: string;
  managementCompanyName: string;
  reason: string;
  requestedBy: string;
  requestedSiteVersion: number;
  siteId: string;
  siteName: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  tenantId: string;
  tenantName: string;
  version: number;
}
```

The authenticated session reads the table directly through RLS. Only `SUPER_ADMIN`,
`PLATFORM_OPERATOR`, `MANAGEMENT_ADMIN`, and `SITE_ADMIN` may read request rows; Site Operator and
Read Only sessions receive no request reasons. Platform scope can review all visible pending rows;
customer request roles see only their exact hierarchy. The Application Service derives:

- `pendingBySiteId` for duplicate-control and current request status
- `approvalQueue` containing only actions the current role may approve
- `cancellableRequestIds` only for rows created by the actor

No service-role client participates in the browser read path.

## 6. UI and i18n

Canonical route remains `/{locale}/admin/sites`.

- Request-only roles see an action form on eligible Site rows, replacing the notice-only state.
- Existing direct controls remain visible only to current direct permissions.
- One pending request displays action/status/requested time and cancel control for its maker.
- Super Admin sees an approval queue for all pending actions.
- Platform Operator sees only suspend/reactivate approvals and may request close.
- Approve and reject are visually and semantically separate; each requires a 3–500 character
  localized reason.
- All new copy ships in the typed KO/EN dictionary.
- Table/action layouts remain keyboard reachable and responsive; WCJ runs after the component
  change.

## 7. Error policy

- `VALIDATION`: malformed UUID/action/version/reason or invalid state
- `FORBIDDEN`: role, AAL, scope, self-review, or non-requester cancel
- `CONFLICT`: duplicate pending, stale Site/request version, already terminal
- `BLOCKED`: inactive parent or active contract prevents approval
- `UNAVAILABLE`: infrastructure or unexpected row shape

PRG redirects use localized status/error keys and never include request reasons or identifiers in
the URL.

## 8. Test plan

### Unit

- Action-to-permission and state transition matrix
- Management/Site request scope checks
- approval permission and self-review rejection
- cancel requester rule
- invalid UUID/version/reason normalization
- read-model approval queue and cancellation derivation

### pgTAP and static DB contract

- table, enums, composite FK, RLS policy, partial unique index
- authenticated table privilege is `SELECT` only
- four command functions exist, are definer functions, and deny anon
- RLS policy set is exact
- database contract script recognizes the new migration/test

### Authenticated staging E2E

1. Management Admin requests suspend for own-company Site; direct status mutation remains absent.
2. Site Admin sees only own Site and can request a valid lifecycle action.
3. Super Admin sees the request, cannot review a self-authored request, and approves the customer
   request.
4. Approved request changes the Site exactly once and writes redacted audit.
5. Cross-tenant and sibling-Site request form tampering is rejected.
6. Request rows and audit evidence are cleaned with final fixture residue `0`.

### Release gates

- `pnpm validate:wcj`
- `pnpm verify`
- `pnpm e2e:smoke`
- `pnpm e2e:staging:sites`
- Supabase Local reset/pgTAP when Docker is available

## 9. Implementation files

- `packages/application/src/site-lifecycle-request-service.ts`
- `packages/db/src/schema/tenant-admin.ts`
- `supabase/migrations/*_phase_1_site_lifecycle_requests.sql`
- `supabase/tests/database/phase_1_site_lifecycle_requests.sql`
- `apps/web/admin/supabase-site-lifecycle-request-repository.ts`
- `apps/web/admin/site-lifecycle-request-actions.ts`
- `apps/web/app/[locale]/admin/sites/page.tsx`
- `apps/web/components/site-catalog-view.tsx`
- `apps/web/content/messages.ts`
- `e2e/staging/staging-fixture.ts`
- `e2e/staging/site-crud-tenant-isolation.spec.ts`
