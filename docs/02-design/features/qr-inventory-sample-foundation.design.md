# qr-inventory-sample-foundation - Design

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for implementation
> Level: Dynamic
> Plan: `docs/01-plan/features/qr-inventory-sample-foundation.plan.md`

## 1. Architecture

```text
Localized QR inventory page
→ QR inventory server actions
→ QrInventorySampleService
→ central RBAC + state + scope + maker-checker policy
→ authenticated Supabase repository
→ scoped SELECT or reviewed PostgreSQL RPC
→ design/batch/sample/asset history + redacted audit
```

- UI consumes typed copy, DTOs, limits, and states from modules.
- Route/page code coordinates data only and does not contain business transitions.
- Browser code never imports server environment, storage credentials, database clients, token
  ciphertext, or service-role clients.
- Mutations use authenticated `SECURITY DEFINER` RPCs. Browser roles receive scoped read grants,
  not table mutation privileges.
- No QR engine, token generator, Queue, Worker, renderer, exporter, or provider behavior is added.

## 2. Domain and application policy

### 2.1 Permissions

New central permissions:

- `sticker-design:read`
- `sticker-design:create`
- `sticker-design:approve`
- `sticker-design:archive`

Existing permissions:

- `qr-batch:read`
- `qr-batch:request`
- `qr-batch:sample-approve`
- `qr-batch:generation-approve`
- `qr-asset:read`

`SUPER_ADMIN`, `PLATFORM_OPERATOR`, `MANAGEMENT_ADMIN`, and `SITE_ADMIN` may create/review
Design Versions and operate the sample slice in scope. `SITE_OPERATOR` and `READ_ONLY` keep read
access only. `qr-batch:generation-approve` remains Super Admin only and has no command in this
slice.

Central MFA policy remains unchanged: Super, Management Admin, and Site Admin require AAL2.

### 2.2 Validation policies

| Value | Contract |
|---|---|
| Batch quantity | integer 1–100 |
| Template code | uppercase letters, digits, `_` and `-`, 2–64 chars |
| Design config | JSON object, maximum serialized length 20,000 |
| Purpose | trimmed 3–200 chars |
| Reason | trimmed 3–500 chars |
| Storage bucket | lowercase storage identifier, 3–63 chars |
| Storage path | non-leading-slash relative path, 3–500 chars, no `..` segment |
| Checksum | lowercase SHA-256 hex, exactly 64 chars |
| MIME | `image/png`, `image/svg+xml`, or `application/pdf` |
| Byte size | integer 1–20,000,000 |
| QA | decode, quiet-zone, and contrast flags must all be true before sample approval |

The values live in `@taptolk/application` and matching database constraints. React components and
route handlers do not define them.

### 2.3 Maker-checker

- Design `created_by <> approved_by`.
- Batch `requested_by <> sample_approved_by`.
- Sample invalidation may be performed by an authorized operator including the previous approver;
  the audit actor makes that intervention explicit.
- The later final generation approval must also enforce
  `batch.requested_by <> generation_approved_by`; the column and state are reserved now, but the
  command is absent.

## 3. Data model

### 3.1 ERD

```text
Tenant 1 ── * ManagementCompany 1 ── * Site
Site 1 ── * StickerDesignVersion
StickerDesignVersion 1 ── * QrBatch
Site 1 ── * QrBatch
QrBatch 1 ── * QrBatchSample
QrBatch 1 ── * QrAsset
QrAsset 1 ── * QrAssetStatusLog
AuthUser 1 ── * creator/requester/approver/invalidation actor references
```

Every child link includes Tenant, Management Company, and Site IDs. Parent tables expose composite
unique keys so PostgreSQL can reject cross-tenant and sibling-Site relationships independently of
Application checks.

### 3.2 `sticker_design_versions`

| Field | Type | Rule |
|---|---|---|
| id | uuid | primary key |
| tenant_id | uuid | highest isolation boundary |
| management_company_id | uuid | Site scope |
| site_id | uuid | composite Site FK |
| template_code | text | validated policy value |
| design_config | jsonb | object, immutable after DRAFT |
| status | enum | `DRAFT`, `APPROVED`, `ARCHIVED` |
| created_by | uuid | Auth maker |
| approved_by / approved_at | nullable | required only in APPROVED/ARCHIVED |
| archived_by / archived_at | nullable | required only in ARCHIVED |
| created_at / updated_at | timestamptz | database time |
| version | integer | optimistic row version |

One Site may have multiple versions. A partial unique index permits only one `DRAFT` per Site and
one non-archived approved design per Site.

### 3.3 `qr_batches`

| Field | Type | Rule |
|---|---|---|
| id | uuid | primary key |
| tenant_id / management_company_id / site_id | uuid | composite Site scope |
| batch_code | text | opaque globally unique display code |
| sticker_design_version_id | uuid | same-Site composite FK |
| requested_quantity | integer | 1–100 in this slice |
| generated/rendered/passed/failed_quantity | integer | zero; future generation counters |
| purpose | text | 3–200 |
| status | enum | full frozen Batch machine |
| requested_by | uuid | maker |
| sample_approved_by / sample_approved_at | nullable | set by sample approval |
| generation_approved_by / generation_approved_at | nullable | reserved, remains null |
| cancelled_by / cancelled_at | nullable | only `CANCELLED` |
| idempotency_key | uuid | unique command retry identity |
| created_at / updated_at | timestamptz | database time |
| version | integer | optimistic row version |

No `sample_qr_asset_id` is set in this slice because a sample artifact is not an issued QR Asset.
The master field remains a later issuance migration concern.

### 3.4 `qr_batch_samples`

| Field | Type | Rule |
|---|---|---|
| id | uuid | primary key |
| tenant_id / management_company_id / site_id / batch_id | uuid | composite Batch FK |
| status | enum | `READY`, `APPROVED`, `INVALIDATED` |
| storage_bucket / storage_path | text | provider-neutral location metadata |
| checksum_sha256 | text | lowercase hex |
| mime_type | text | allowlisted |
| byte_size | integer | 1–20MB |
| decode_passed / quiet_zone_passed / contrast_passed | boolean | quality evidence |
| attached_by | uuid | Auth actor |
| approved_by / approved_at | nullable | only APPROVED or later invalidated approved sample |
| invalidated_by / invalidated_at / invalidation_reason | nullable | only INVALIDATED |
| created_at / updated_at | timestamptz | database time |
| version | integer | optimistic row version |

A partial unique index allows one non-invalidated sample per Batch. Invalidated rows are never
reused or updated.

### 3.5 `qr_assets`

The table reserves the master fields but exposes no creation or mutation command in this slice:

`id`, full Site scope, `batch_id`, `internal_uuid`, `public_token_hash`,
`public_token_ciphertext`, `token_key_version`, `human_code`, `status`, nullable
`current_vehicle_id`, nullable `current_binding_id`, lifecycle timestamps, revoke reason, and
common timestamps/version.

Authenticated read grants exclude `public_token_hash`, `public_token_ciphertext`, and key version.
Future issuance must insert Asset and initial Status Log in one transaction.

### 3.6 `qr_asset_status_logs`

`id`, full Site scope, `qr_asset_id`, `from_status`, `to_status`, reason code/text, actor
type/ID, and `created_at`. No update or delete privilege/command exists. A trigger rejects update
or delete even for accidental direct service-role mutations.

## 4. PostgreSQL command contracts

| Function | Input | Atomic output |
|---|---|---|
| `create_sticker_design_version` | Site/version, template, config, reason, request UUID | DRAFT + audit |
| `approve_sticker_design_version` | Design/version, reason, request UUID | APPROVED + audit |
| `archive_sticker_design_version` | Design/version, reason, request UUID | ARCHIVED + audit |
| `request_qr_batch` | Site/version, Design/version, quantity, purpose, reason, idempotency UUID, request UUID | DRAFT Batch + audit |
| `attach_qr_batch_sample` | Batch/version, artifact metadata, QA flags, reason, request UUID | READY Sample + Batch `SAMPLE_READY` + audit |
| `approve_qr_batch_sample` | Sample/version, Batch/version, reason, request UUID | APPROVED Sample + Batch `SAMPLE_APPROVED` + audit |
| `invalidate_qr_batch_sample` | Sample/version, Batch/version, reason, request UUID | INVALIDATED Sample + Batch `DRAFT` + audit |
| `cancel_qr_batch` | Batch/version, reason, request UUID | CANCELLED Batch + audit |

All functions:

- are `SECURITY DEFINER SET search_path = ''`;
- require `auth.uid()`, an active membership, matching role/scope, and central MFA rules;
- lock parent/target rows and verify optimistic versions;
- verify active Tenant, Management Company, and Site;
- use fully qualified names;
- revoke execute from `PUBLIC` and `anon`;
- return camel-case JSON DTOs without storage path, checksum, reason, identity claims, or token data.

Audit allowlist examples:

```json
{
  "batchStatus": "SAMPLE_APPROVED",
  "batchVersion": 3,
  "quantity": 20,
  "sampleStatus": "APPROVED",
  "sampleVersion": 2
}
```

## 5. Read model and repository

```ts
interface QrInventorySampleReadModel {
  approvedDesignOptions: readonly StickerDesignVersionItem[];
  batches: readonly QrBatchItem[];
  designApprovalQueue: readonly StickerDesignVersionItem[];
  designs: readonly StickerDesignVersionItem[];
  sampleApprovalQueue: readonly QrBatchItem[];
  siteOptions: readonly QrInventorySiteOption[];
}
```

- RLS returns only membership-scoped rows.
- Application policy removes self-created Designs from `designApprovalQueue`.
- Application policy removes self-requested Batches from `sampleApprovalQueue`.
- Site Operator and Read Only receive read-only inventory with no reason, storage path, checksum,
  or actor identity.
- The page queries at most 100 rows per collection in stable creation/ID order.
- No service-role client participates in the browser request.

## 6. UI and i18n

Canonical route: `/{locale}/admin/qr-inventory`.

Sections:

1. Page purpose and explicit “sample approval does not start bulk generation” notice.
2. Design creation form for authorized roles.
3. Independent Design approval queue.
4. Approved Design and Site scoped Batch request form.
5. Batch list with state, quantity, Site, Design, and timestamps.
6. Sample attach form when Batch is `DRAFT`.
7. Independent sample approval queue when Batch is `SAMPLE_READY`.
8. Sample invalidation/cancel controls where eligible.

PRG status/error query keys map to typed KO/EN copy. Reasons, storage paths, resource IDs, and
checksums never appear in redirect URLs. Forms expose native required/min/max constraints while
Application and DB remain authoritative.

Explicit states:

- success: design created/approved/archived, Batch requested/cancelled, sample attached/approved/
  invalidated;
- waiting: design review, sample attachment, sample review, final generation approval;
- failure: validation, conflict, forbidden, blocked, unavailable;
- empty: no Site, no approved Design, no Batch, no review queue.

The shared `SemanticHeading` authors independent KO/EN meaning groups. Controls do not wrap and
WCJ runs after every page/component change.

## 7. Error policy

- `VALIDATION`: malformed IDs, JSON, limits, metadata, QA, or invalid transition
- `FORBIDDEN`: role, MFA, scope, creator self-approval, requester sample self-approval
- `CONFLICT`: stale version, duplicate DRAFT/active sample, idempotency collision, terminal row
- `BLOCKED`: inactive parent, unapproved/archived Design, failed QA
- `UNAVAILABLE`: provider/query failure or unexpected row shape

Logs contain operation and provider error code only. They exclude path, checksum, purpose, reason,
tokens, identities, cookies, headers, and form payloads.

## 8. Test plan

### 8.1 Unit

- central permission matrix and scope
- all frozen state transitions
- quantity, config, artifact metadata, checksum, path, MIME, byte-size, and QA validation
- Design creator self-approval rejection
- Batch requester sample self-approval rejection
- cross-Site resource authorization rejection
- read-model queue derivation and read-only behavior
- repository receives normalized DTO only

### 8.2 pgTAP/static contract

- enums, tables, composite FKs, partial unique indexes, checks, RLS
- authenticated privileges are safe `SELECT` columns only
- all eight command functions exist, are definer functions, and deny anon
- QR Asset secrets have no authenticated column privilege
- status logs reject update/delete
- migration/test discovery count advances

### 8.3 Authenticated staging E2E

1. Management Admin creates a Design DRAFT in its company Site.
2. A different in-scope actor approves the Design; maker self-approval is denied.
3. Site Admin requests a small Batch for its exact Site.
4. Platform/Super actor attaches a passing sample artifact.
5. A checker different from the Batch requester approves the sample.
6. Cross-tenant and sibling-Site Design/Batch/sample tampering is denied.
7. Sample invalidation preserves terminal history and returns Batch to DRAFT.
8. Test-created audit, sample, Batch, Design, membership/profile/Site/company/Tenant/Auth rows clean
   to `0`.

### 8.4 Release gates

- `pnpm validate:wcj` after web changes
- `pnpm verify`
- `pnpm e2e:smoke`
- authenticated staging QR inventory E2E
- Supabase Local reset/runtime pgTAP when Docker is available

## 9. Implementation files

- `packages/domain/src/admin-permission-catalog.ts`
- `packages/application/src/qr-inventory-sample-service.ts`
- `packages/application/src/qr-inventory-sample-service.test.ts`
- `packages/db/src/schema/tenant-admin.ts`
- `supabase/migrations/*_qr_inventory_sample_foundation.sql`
- `supabase/tests/database/qr_inventory_sample_foundation.sql`
- `apps/web/admin/supabase-qr-inventory-sample-repository.ts`
- `apps/web/admin/qr-inventory-sample-actions.ts`
- `apps/web/app/[locale]/admin/qr-inventory/page.tsx`
- `apps/web/components/qr-inventory-sample-view.tsx`
- `apps/web/content/messages.ts`
- `apps/web/app/globals.css`
- `e2e/staging/qr-inventory-sample.spec.ts`
- `docs/01-plan/schema.md`
