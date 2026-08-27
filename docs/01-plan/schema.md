# Taptolk Phase 1 Schema

The execution details are defined in
`docs/02-design/features/tenant-admin-foundation.design.md` and the Phase 1 Supabase migration.

## Entities and Key Fields

### tenants

`id`, `name`, `slug`, `status`, `settings`, `created_at`, `updated_at`, `version`, `deleted_at`.

### management_companies

`id`, `tenant_id`, `name`, `business_number`, `status`, encrypted contact phone,
`billing_email`, common timestamps/version/deletion.

### sites

`id`, `tenant_id`, `management_company_id`, `name`, `site_type`, `address`, `timezone`,
`contract_vehicle_limit`, `status`, encrypted escalation phone, `settings`, common fields.

### contracts

`id`, `tenant_id`, `management_company_id`, nullable `site_id`, `plan_code`, start/end date,
minimum vehicle count, billing basis, status, metadata, common fields.

### admin_profiles

`user_id` primary/foreign key to `auth.users`, `display_name`, `status`, `last_login_at`,
timestamps and version.

### admin_memberships

`id`, `user_id`, nullable hierarchy IDs, `role`, `scope_type`, `status`, inviter, acceptance,
timestamps and version. Role and scope combinations are enforced by a check constraint.

### audit_logs

`id`, nullable tenant/site scope, actor, action, resource identity, redacted before/after data,
reason, request ID, and immutable creation time.

### site_lifecycle_requests

| Field | Type | Required | Rule |
|---|---|---:|---|
| id | uuid | Yes | Primary key, random default |
| tenant_id | uuid | Yes | Highest customer isolation boundary |
| management_company_id | uuid | Yes | Part of composite Site scope |
| site_id | uuid | Yes | Composite FK with tenant and company |
| action | enum | Yes | `SUSPEND`, `REACTIVATE`, `CLOSE` |
| status | enum | Yes | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| requested_site_version | integer | Yes | Site version captured when requested, at least 1 |
| requested_by | uuid | Yes | Auth user and maker identity |
| request_reason | text | Yes | Trimmed 3–500 characters |
| reviewed_by | uuid | No | Checker identity; required for approved/rejected |
| review_reason | text | No | Trimmed 3–500 for approved/rejected |
| reviewed_at | timestamptz | No | Required for approved/rejected |
| cancelled_at | timestamptz | No | Required only for cancelled |
| created_at | timestamptz | Yes | UTC database time |
| updated_at | timestamptz | Yes | UTC database time |
| version | integer | Yes | Request optimistic version, starts at 1 |

Only one `PENDING` request may exist for a Site. Terminal requests remain immutable history.
Approval also requires the current Site version to equal `requested_site_version`.

### Sticker Design and QR inventory sample foundation

The full field and transition contract is defined in
`docs/02-design/features/qr-inventory-sample-foundation.design.md`.

- `sticker_design_versions`: Tenant/company/Site scope, template code, JSON design config,
  `DRAFT/APPROVED/ARCHIVED`, maker/checker identities, optimistic version.
- `qr_batches`: same-Site approved Design reference, opaque Batch code, 1–100 requested quantity,
  frozen full lifecycle status, requester/sample/final approvers, idempotency key, counters and
  optimistic version.
- `qr_batch_samples`: same-Batch scope, provider-neutral storage metadata, SHA-256 checksum,
  MIME/size, decode/quiet-zone/contrast evidence, `READY/APPROVED/INVALIDATED`, retained actor and
  timestamp history.
- `qr_assets`: same-Batch scope, internal identity, encrypted/hashed token fields, human code,
  lifecycle state and timestamps. No issuance command exists in this slice.
- `qr_asset_status_logs`: append-only same-Asset transition history.

Authenticated sessions receive scoped RLS reads only. QR Asset token hash, ciphertext, and key
version do not have browser column privileges. No physical delete or automated retention job is
exposed; terminal rows are retained until a separately approved retention policy exists.

## Validation Rules

- Name: trimmed, 1–200 characters.
- Slug: lowercase ASCII letters, digits, and hyphens; 2–63 characters.
- Vehicle limit/minimum count: non-negative.
- Contract end date cannot precede start date.
- Settings/metadata must be JSON objects.
- All operational times are `timestamptz`.
- Phone values are encrypted server-side; plaintext and direct hash values are not stored here.
- Audit JSON rejects sensitive top-level keys.
- Lifecycle request action must match the current Site state at request and approval time.
- Requester cannot approve or reject their own lifecycle request.
- Review metadata is present only on approved/rejected rows; cancellation metadata is present
  only on cancelled rows.

## Query Indexes

- active tenant slug
- tenant + status for companies/Sites/contracts
- company + Site status
- user + membership status
- tenant/company/site membership scopes
- tenant + audit creation time descending
- request ID and resource identity for audit investigation
- Site lifecycle request tenant/status/created time
- Site lifecycle request site/status
- one pending Site lifecycle request per Site
