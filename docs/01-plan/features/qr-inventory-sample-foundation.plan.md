# qr-inventory-sample-foundation - Plan

> Version: 1.0.0 | Date: 2026-07-19 | Status: Approved for implementation
> Level: Dynamic

## 1. Purpose

`StickerDesignVersion`, `QrBatch`, `QrBatchSample`, `QrAsset`, and
`QrAssetStatusLog`의 Tenant/Site 소유권과 상태 계약을 먼저 고정하고, 실제 대량 QR
생성 전에 검토 가능한 가장 작은 스티커 샘플 승인 수직 슬라이스를 구축한다.

이 슬라이스는 고객 관리자가 Site 범위에서 디자인과 소량 Batch를 요청하고 독립된
검토자가 샘플을 승인하거나 무효화하는 과정까지만 다룬다. Super Admin의 대량 생성
최종 승인과 Queue/Worker/Render/Export는 후속 단계다.

## 2. Glossary

| Term | Exact meaning |
|---|---|
| Sticker Design Version | 한 Site에 귀속된 스티커 레이아웃 설정의 불변 버전. DB 이름은 `sticker_design_versions` |
| QR Batch | 동일 Site와 승인된 디자인 버전으로 발행을 요청하는 QR 묶음 |
| QR Batch Sample | 대량 생성 전에 검토하는 Batch 소속 샘플 아티팩트와 품질검사 결과 |
| QR Asset | Batch에서 발행될 개별 디지털 QR 자산. 이번 슬라이스에서는 스키마와 이력 계약만 생성 |
| Sample approval | 샘플의 배치·인식·체크섬을 검토하는 고객/플랫폼 승인. 대량 생성 최종 승인이 아님 |
| Final generation approval | Super Admin만 수행하는 대량 생성 시작 승인. 이번 슬라이스 밖 |
| Invalidation | 샘플을 삭제하지 않고 terminal `INVALIDATED`로 보존하고 Batch를 재검토 상태로 돌리는 command |

## 3. Scope

### 3.1 In

- Design Version `DRAFT → APPROVED → ARCHIVED`
- 디자인 생성, 독립 승인, 승인된 디자인 보관 처리
- Site별 소량 QR Batch 요청
- 샘플 아티팩트 메타데이터와 품질 결과 연결
- 독립 샘플 승인 또는 승인 전후 샘플 무효화
- `QrAsset`과 append-only status history의 발행·배정·중지·폐기·만료 상태 계약
- 모든 Tenant-owned row의 `tenant_id + management_company_id + site_id` composite scope
- 중앙 RBAC, Application Policy, PostgreSQL RLS/RPC 이중 검증
- optimistic version, terminal history, same-transaction redacted audit
- KO/EN Platform/Company/Site queue와 success/wait/failure UI
- unit, pgTAP contract, authenticated staging E2E와 residue `0`

### 3.2 Out

- Brand Asset 업로드, SVG sanitize, 실제 이미지 렌더링
- 공개 QR token, human code, activation code 생성
- QR Asset row 대량 생성 또는 상태 변경 command
- Super Admin final generation approval
- Queue, Worker, Render Job, Export, PDF, SVG, CSV, ZIP
- 인쇄, 입고, 재고 수령, 차량 배정
- `packages/qr-engine` 또는 Worker placeholder
- Production/Vercel/SMS 연결

## 4. Ownership and authority

### 4.1 Exact ownership

- 모든 Design Version, Batch, Sample, QR Asset은 정확히 한 `Tenant`, 한
  `Management Company`, 한 `Site`에 귀속된다.
- Batch의 Site scope와 Design Version의 Site scope는 composite FK로 동일해야 한다.
- Sample은 Batch와 같은 네 단계 식별자
  `tenant_id + management_company_id + site_id + batch_id`를 공유한다.
- QR Asset은 Batch와 같은 Site scope를 composite FK로 공유한다.
- 플랫폼 역할도 Tenant-owned row를 생성하며 platform-owned Batch/Asset은 만들지 않는다.

### 4.2 Authority matrix

| Command | Super | Platform Op | Mgmt Admin | Site Admin | Site Operator | Read Only |
|---|---:|---:|---:|---:|---:|---:|
| Read scoped design/batch/sample/asset | O | O | O | O | O | Masked read |
| Create Design DRAFT | O | O | O | O | X | X |
| Approve Design DRAFT | O | O | O | O | X | X |
| Archive approved Design | O | O | O | O | X | X |
| Request Batch | O | O | O | O | X | X |
| Attach sample metadata | O | O | O | O | X | X |
| Approve/invalidate sample | O | O | O | O | X | X |
| Final generation approval | O | X | X | X | X | X |

- Design creator cannot approve the same Design Version.
- Batch requester cannot approve the same Batch sample.
- Platform Operator may operate sample failures/invalidation but cannot perform final generation
  approval.
- Final generation maker-checker remains frozen as requester/final approver separation, but its
  command is not implemented in this slice.

## 5. Frozen state machines

### 5.1 Sticker Design Version

```text
DRAFT → APPROVED → ARCHIVED
```

- Only `DRAFT` may change `design_config`.
- Approval freezes `template_code`, `design_config`, and Site ownership.
- `ARCHIVED` is terminal and remains readable.
- An archived design cannot be used for a new Batch.

### 5.2 QR Batch

```text
DRAFT
→ SAMPLE_RENDERING
→ SAMPLE_READY
→ SAMPLE_APPROVED
→ FINAL_APPROVAL_PENDING
→ GENERATION_APPROVED
→ GENERATION_QUEUED
→ GENERATING
→ GENERATED
→ QUALITY_CHECKED
→ PRINT_FILE_READY
→ SENT_TO_PRINTER
→ PRINTED
→ SHIPPED
→ DELIVERED
→ DISTRIBUTING
→ COMPLETED
```

Exception/terminal states:

```text
FAILED | CANCELLED | PARTIALLY_COMPLETED
```

This slice implements:

```text
DRAFT → SAMPLE_READY → SAMPLE_APPROVED
SAMPLE_READY | SAMPLE_APPROVED → DRAFT (through terminal sample invalidation)
DRAFT | SAMPLE_READY → CANCELLED
```

The later final-approval command will move `SAMPLE_APPROVED` to
`FINAL_APPROVAL_PENDING` and only a Super Admin checker may move it to
`GENERATION_APPROVED`.

### 5.3 QR Batch Sample

```text
READY → APPROVED
READY | APPROVED → INVALIDATED
```

- `APPROVED` is not terminal because a discovered defect may invalidate it before final generation.
- `INVALIDATED` is terminal and immutable.
- One Batch may have only one non-invalidated sample.

### 5.4 QR Asset

```text
GENERATED → PRINT_READY → PRINTED → IN_STOCK
→ ASSIGNED → ACTIVATION_PENDING → ACTIVE
```

Exceptional states:

```text
SUSPENDED | LOST | DAMAGED | REPLACED | REVOKED | EXPIRED
```

- `REPLACED`, `REVOKED`, and `EXPIRED` are terminal.
- `SUSPENDED` preserves reactivation eligibility for a later policy.
- Every status transition appends `QrAssetStatusLog`; existing logs are immutable.
- Revoked, replaced, and expired assets are never physically deleted.

## 6. Data and retention contract

- Design, Batch, Sample, Asset, and Asset Status Log rows expose no physical delete command.
- This slice configures no automated deletion job; all rows and invalidated sample metadata are
  retained indefinitely until a separately approved retention policy and purge implementation
  exist.
- Storage objects are referenced by bucket, path, checksum, MIME type, and byte size. Signed URL,
  credentials, public token, and raw file bytes are never stored in the operational row or audit.
- Audit JSON contains identifiers only where required for correlation plus status/version/quantity
  fields. Reason belongs in the dedicated audit reason column.
- `requested_quantity` is limited by a typed application policy and matching DB constraint. The
  first slice uses 1–100, not a React-component constant.

## 7. Success criteria

- Authenticated browser tables grant scoped `SELECT` only; all mutations enter reviewed RPCs.
- Application and PostgreSQL independently enforce role, MFA, scope, state, version, active parent,
  approved Design, and checker separation.
- Design approve/archive, Batch request/cancel, sample attach/approve/invalidate each write the
  resource change and a redacted audit row in one transaction.
- Cross-tenant, sibling-company, and sibling-Site IDs fail closed through composite constraints,
  scope policy, and command checks.
- A Batch cannot reference a Design from another Site or an unapproved/archived Design.
- A sample cannot be approved unless its checksum shape and all three QA flags are valid.
- Invalidation preserves the sample and returns the Batch to `DRAFT` without deleting history.
- No code path creates QR Assets, tokens, Queue jobs, render jobs, or exports.
- KO/EN screens expose empty, requested/waiting, sample-ready, approved, invalidated, cancelled,
  validation, conflict, forbidden, blocked, and unavailable behavior.
- `pnpm validate:wcj`, `pnpm verify`, Desktop/Mobile smoke, and authenticated staging E2E pass.
- Supabase Local reset and runtime pgTAP remain an explicit open gate if Docker is unavailable.

## 8. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Sample approval accidentally starts generation | No Queue/Worker dependency or generation RPC; separate `SAMPLE_APPROVED` and `GENERATION_APPROVED` states |
| Same actor creates and approves | Application actor comparison and DB `auth.uid()` comparison |
| Cross-Site Design/Batch/Asset link | Composite unique keys and composite FKs include Tenant, company, Site, and parent ID |
| Approved design changes | guard trigger rejects identity/config changes outside `DRAFT` |
| Sample replaced without history | invalidation is terminal; partial unique index allows a new sample only after invalidation |
| Storage metadata exposes secrets | path/checksum only; no signed URL, token, headers, or provider credential in logs/audit |
| UI constants drift from policy | quantity and validation limits exported from Application module |
| Premature Phase 3 scope | no qr-engine package, generation command, Worker, token, or file generator |

## 9. Delivery order

1. Plan, glossary, ERD, fields, retention, state machines
2. Design architecture, command contract, error policy, test plan
3. Domain/Application policy and unit tests
4. Migration, RLS/RPC, pgTAP, Drizzle schema
5. Supabase repository, server actions, KO/EN screen
6. WCJ after web changes, then full verification and staging Auth E2E
7. PDCA gap analysis, report, and session handoff

## 10. References

- `TAPTOLK_MASTER_DEVELOPMENT_SPEC.md` sections 1.4, 6.2, 7.1, 7.2, 8.4, 8.5, 9.5.1, 13.6,
  21.6, Phase 2, Phase 3
- `docs/02-design/features/admin-console-architecture.design.md`
- `docs/handoff-0719-1227.md`
