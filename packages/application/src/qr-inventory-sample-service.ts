import {
  type AdminAuthorizationContext,
  type AdminPermission,
  authorizeAdminAction,
  roleHasPermission,
} from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";

export const STICKER_DESIGN_STATUSES = ["DRAFT", "APPROVED", "ARCHIVED"] as const;
export type StickerDesignStatus = (typeof STICKER_DESIGN_STATUSES)[number];

export const QR_BATCH_STATUSES = [
  "DRAFT",
  "SAMPLE_RENDERING",
  "SAMPLE_READY",
  "SAMPLE_APPROVED",
  "FINAL_APPROVAL_PENDING",
  "GENERATION_APPROVED",
  "GENERATION_QUEUED",
  "GENERATING",
  "GENERATED",
  "QUALITY_CHECKED",
  "PRINT_FILE_READY",
  "SENT_TO_PRINTER",
  "PRINTED",
  "SHIPPED",
  "DELIVERED",
  "DISTRIBUTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "PARTIALLY_COMPLETED",
] as const;
export type QrBatchStatus = (typeof QR_BATCH_STATUSES)[number];

export const QR_BATCH_SAMPLE_STATUSES = ["READY", "APPROVED", "INVALIDATED"] as const;
export type QrBatchSampleStatus = (typeof QR_BATCH_SAMPLE_STATUSES)[number];

export const QR_ASSET_STATUSES = [
  "GENERATED",
  "PRINT_READY",
  "PRINTED",
  "IN_STOCK",
  "ASSIGNED",
  "ACTIVATION_PENDING",
  "ACTIVE",
  "SUSPENDED",
  "LOST",
  "DAMAGED",
  "REPLACED",
  "REVOKED",
  "EXPIRED",
] as const;
export type QrAssetStatus = (typeof QR_ASSET_STATUSES)[number];

export const QR_BATCH_REQUEST_QUANTITY_MIN = 1;
export const QR_BATCH_REQUEST_QUANTITY_MAX = 100;
export const QR_SAMPLE_BYTE_SIZE_MAX = 20_000_000;
export const QR_SAMPLE_MIME_TYPES = ["image/png", "image/svg+xml", "application/pdf"] as const;
export type QrSampleMimeType = (typeof QR_SAMPLE_MIME_TYPES)[number];

export interface QrInventoryActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface QrInventorySiteOption {
  id: string;
  managementCompanyId: string;
  managementCompanyName: string;
  name: string;
  status: OrganizationStatus;
  tenantId: string;
  tenantName: string;
  version: number;
}

export interface StickerDesignVersionItem {
  approvedAt: string | null;
  createdAt: string;
  createdByCurrentActor: boolean;
  designConfig: Readonly<Record<string, unknown>>;
  id: string;
  managementCompanyId: string;
  siteId: string;
  siteName: string;
  status: StickerDesignStatus;
  templateCode: string;
  tenantId: string;
  version: number;
}

export interface QrBatchSampleItem {
  byteSize: number;
  contrastPassed: boolean;
  createdAt: string;
  decodePassed: boolean;
  id: string;
  mimeType: QrSampleMimeType;
  quietZonePassed: boolean;
  status: QrBatchSampleStatus;
  version: number;
}

export interface QrBatchItem {
  batchCode: string;
  createdAt: string;
  id: string;
  managementCompanyId: string;
  purpose: string;
  requestedByCurrentActor: boolean;
  requestedQuantity: number;
  sample: QrBatchSampleItem | null;
  siteId: string;
  siteName: string;
  status: QrBatchStatus;
  stickerDesignVersionId: string;
  templateCode: string;
  tenantId: string;
  version: number;
}

export interface QrInventorySampleReadModel {
  approvedDesignOptions: readonly StickerDesignVersionItem[];
  batches: readonly QrBatchItem[];
  cancellableBatchIds: ReadonlySet<string>;
  designApprovalQueue: readonly StickerDesignVersionItem[];
  designs: readonly StickerDesignVersionItem[];
  sampleApprovalQueue: readonly QrBatchItem[];
  siteOptions: readonly QrInventorySiteOption[];
}

export interface QrInventoryCommandResult {
  relatedResourceId: string | null;
  relatedVersion: number | null;
  resourceId: string;
  version: number;
}

export interface QrInventorySampleRepository {
  approveDesign(input: {
    auditRequestId: string;
    designId: string;
    expectedVersion: number;
    reason: string;
  }): Promise<QrInventoryCommandResult>;
  approveSample(input: {
    auditRequestId: string;
    batchId: string;
    expectedBatchVersion: number;
    expectedSampleVersion: number;
    reason: string;
    sampleId: string;
  }): Promise<QrInventoryCommandResult>;
  archiveDesign(input: {
    auditRequestId: string;
    designId: string;
    expectedVersion: number;
    reason: string;
  }): Promise<QrInventoryCommandResult>;
  attachSample(input: {
    auditRequestId: string;
    batchId: string;
    byteSize: number;
    checksumSha256: string;
    contrastPassed: boolean;
    decodePassed: boolean;
    expectedBatchVersion: number;
    mimeType: QrSampleMimeType;
    quietZonePassed: boolean;
    reason: string;
    storageBucket: string;
    storagePath: string;
  }): Promise<QrInventoryCommandResult>;
  cancelBatch(input: {
    auditRequestId: string;
    batchId: string;
    expectedBatchVersion: number;
    reason: string;
  }): Promise<QrInventoryCommandResult>;
  createDesign(input: {
    auditRequestId: string;
    designConfig: Readonly<Record<string, unknown>>;
    expectedSiteVersion: number;
    reason: string;
    siteId: string;
    templateCode: string;
  }): Promise<QrInventoryCommandResult>;
  invalidateSample(input: {
    auditRequestId: string;
    batchId: string;
    expectedBatchVersion: number;
    expectedSampleVersion: number;
    reason: string;
    sampleId: string;
  }): Promise<QrInventoryCommandResult>;
  list(): Promise<{
    batches: readonly QrBatchItem[];
    designs: readonly StickerDesignVersionItem[];
    sites: readonly QrInventorySiteOption[];
  }>;
  requestBatch(input: {
    auditRequestId: string;
    expectedDesignVersion: number;
    expectedSiteVersion: number;
    idempotencyKey: string;
    purpose: string;
    quantity: number;
    reason: string;
    siteId: string;
    stickerDesignVersionId: string;
  }): Promise<QrInventoryCommandResult>;
}

export class QrInventorySampleError extends Error {
  readonly code:
    | "INVALID_BATCH_STATUS"
    | "INVALID_BYTE_SIZE"
    | "INVALID_CHECKSUM"
    | "INVALID_DESIGN_CONFIG"
    | "INVALID_DESIGN_STATUS"
    | "INVALID_ID"
    | "INVALID_MIME_TYPE"
    | "INVALID_PATH"
    | "INVALID_PURPOSE"
    | "INVALID_QUANTITY"
    | "INVALID_REASON"
    | "INVALID_SITE_STATUS"
    | "INVALID_TEMPLATE_CODE"
    | "INVALID_VERSION"
    | "QA_REQUIRED"
    | "REQUESTER_REQUIRED"
    | "SELF_REVIEW_FORBIDDEN";

  constructor(code: QrInventorySampleError["code"]) {
    super(`QR inventory sample command rejected: ${code}`);
    this.name = "QrInventorySampleError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TEMPLATE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,63}$/u;
const STORAGE_BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/u;

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new QrInventorySampleError("INVALID_ID");
  }
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new QrInventorySampleError("INVALID_VERSION");
  }
}

function normalizeText(
  value: string,
  limits: { max: number; min: number },
  code: "INVALID_PURPOSE" | "INVALID_REASON",
): string {
  const normalized = value.trim();
  if (normalized.length < limits.min || normalized.length > limits.max) {
    throw new QrInventorySampleError(code);
  }
  return normalized;
}

function normalizeReason(value: string): string {
  return normalizeText(value, { max: 500, min: 3 }, "INVALID_REASON");
}

function normalizePurpose(value: string): string {
  return normalizeText(value, { max: 200, min: 3 }, "INVALID_PURPOSE");
}

function normalizeTemplateCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!TEMPLATE_CODE_PATTERN.test(normalized)) {
    throw new QrInventorySampleError("INVALID_TEMPLATE_CODE");
  }
  return normalized;
}

function normalizeDesignConfig(value: string): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new QrInventorySampleError("INVALID_DESIGN_CONFIG");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    JSON.stringify(parsed).length > 20_000
  ) {
    throw new QrInventorySampleError("INVALID_DESIGN_CONFIG");
  }
  return parsed as Readonly<Record<string, unknown>>;
}

function assertQuantity(value: number): void {
  if (
    !Number.isInteger(value) ||
    value < QR_BATCH_REQUEST_QUANTITY_MIN ||
    value > QR_BATCH_REQUEST_QUANTITY_MAX
  ) {
    throw new QrInventorySampleError("INVALID_QUANTITY");
  }
}

function normalizeStoragePath(value: string): string {
  const normalized = value.trim();
  if (
    normalized.length < 3 ||
    normalized.length > 500 ||
    normalized.startsWith("/") ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    throw new QrInventorySampleError("INVALID_PATH");
  }
  return normalized;
}

function normalizeStorageBucket(value: string): string {
  const normalized = value.trim();
  if (!STORAGE_BUCKET_PATTERN.test(normalized)) {
    throw new QrInventorySampleError("INVALID_PATH");
  }
  return normalized;
}

function normalizeChecksum(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!CHECKSUM_PATTERN.test(normalized)) {
    throw new QrInventorySampleError("INVALID_CHECKSUM");
  }
  return normalized;
}

function assertMimeType(value: string): asserts value is QrSampleMimeType {
  if (!QR_SAMPLE_MIME_TYPES.some((mimeType) => mimeType === value)) {
    throw new QrInventorySampleError("INVALID_MIME_TYPE");
  }
}

function assertByteSize(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > QR_SAMPLE_BYTE_SIZE_MAX) {
    throw new QrInventorySampleError("INVALID_BYTE_SIZE");
  }
}

function resource(input: { managementCompanyId: string; siteId: string; tenantId: string }) {
  return {
    managementCompanyId: input.managementCompanyId,
    siteId: input.siteId,
    tenantId: input.tenantId,
  };
}

function authorize(
  actor: QrInventoryActor,
  permission: AdminPermission,
  target: { managementCompanyId: string; siteId: string; tenantId: string },
): void {
  assertUuid(actor.userId);
  assertAdminAuthorized(authorizeAdminAction(actor.authorization, permission, resource(target)));
}

function assertCommandIdentity(input: {
  auditRequestId: string;
  expectedVersion: number;
  resourceId: string;
}): void {
  assertUuid(input.auditRequestId);
  assertUuid(input.resourceId);
  assertVersion(input.expectedVersion);
}

export class QrInventorySampleService {
  constructor(private readonly repository: QrInventorySampleRepository) {}

  async list(input: { actor: QrInventoryActor }): Promise<QrInventorySampleReadModel> {
    assertUuid(input.actor.userId);
    const scope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "qr-batch:read", {
        ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
        ...(scope.siteId ? { siteId: scope.siteId } : {}),
        tenantId: scope.tenantId ?? "platform-qr-inventory",
      }),
    );
    const result = await this.repository.list();
    const canApproveDesign = roleHasPermission(
      input.actor.authorization.role,
      "sticker-design:approve",
    );
    const canApproveSample = roleHasPermission(
      input.actor.authorization.role,
      "qr-batch:sample-approve",
    );
    return {
      approvedDesignOptions: result.designs.filter((design) => design.status === "APPROVED"),
      batches: result.batches,
      cancellableBatchIds: new Set(
        result.batches
          .filter(
            (batch) =>
              batch.requestedByCurrentActor &&
              (batch.status === "DRAFT" || batch.status === "SAMPLE_READY"),
          )
          .map((batch) => batch.id),
      ),
      designApprovalQueue: canApproveDesign
        ? result.designs.filter(
            (design) => design.status === "DRAFT" && !design.createdByCurrentActor,
          )
        : [],
      designs: result.designs,
      sampleApprovalQueue: canApproveSample
        ? result.batches.filter(
            (batch) => batch.status === "SAMPLE_READY" && !batch.requestedByCurrentActor,
          )
        : [],
      siteOptions: result.sites.filter((site) => site.status === "ACTIVE"),
    };
  }

  async createDesign(input: {
    actor: QrInventoryActor;
    auditRequestId: string;
    designConfig: string;
    expectedSiteVersion: number;
    managementCompanyId: string;
    reason: string;
    siteId: string;
    siteStatus: OrganizationStatus;
    templateCode: string;
    tenantId: string;
  }): Promise<QrInventoryCommandResult> {
    authorize(input.actor, "sticker-design:create", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.siteId);
    assertVersion(input.expectedSiteVersion);
    if (input.siteStatus !== "ACTIVE") {
      throw new QrInventorySampleError("INVALID_SITE_STATUS");
    }
    return this.repository.createDesign({
      auditRequestId: input.auditRequestId,
      designConfig: normalizeDesignConfig(input.designConfig),
      expectedSiteVersion: input.expectedSiteVersion,
      reason: normalizeReason(input.reason),
      siteId: input.siteId,
      templateCode: normalizeTemplateCode(input.templateCode),
    });
  }

  async approveDesign(input: {
    actor: QrInventoryActor;
    auditRequestId: string;
    createdByCurrentActor: boolean;
    designId: string;
    expectedVersion: number;
    managementCompanyId: string;
    reason: string;
    siteId: string;
    status: StickerDesignStatus;
    tenantId: string;
  }): Promise<QrInventoryCommandResult> {
    authorize(input.actor, "sticker-design:approve", input);
    assertCommandIdentity({
      auditRequestId: input.auditRequestId,
      expectedVersion: input.expectedVersion,
      resourceId: input.designId,
    });
    if (input.status !== "DRAFT") {
      throw new QrInventorySampleError("INVALID_DESIGN_STATUS");
    }
    if (input.createdByCurrentActor) {
      throw new QrInventorySampleError("SELF_REVIEW_FORBIDDEN");
    }
    return this.repository.approveDesign({
      auditRequestId: input.auditRequestId,
      designId: input.designId,
      expectedVersion: input.expectedVersion,
      reason: normalizeReason(input.reason),
    });
  }

  async archiveDesign(input: {
    actor: QrInventoryActor;
    auditRequestId: string;
    designId: string;
    expectedVersion: number;
    managementCompanyId: string;
    reason: string;
    siteId: string;
    status: StickerDesignStatus;
    tenantId: string;
  }): Promise<QrInventoryCommandResult> {
    authorize(input.actor, "sticker-design:archive", input);
    assertCommandIdentity({
      auditRequestId: input.auditRequestId,
      expectedVersion: input.expectedVersion,
      resourceId: input.designId,
    });
    if (input.status !== "APPROVED") {
      throw new QrInventorySampleError("INVALID_DESIGN_STATUS");
    }
    return this.repository.archiveDesign({
      auditRequestId: input.auditRequestId,
      designId: input.designId,
      expectedVersion: input.expectedVersion,
      reason: normalizeReason(input.reason),
    });
  }

  async requestBatch(input: {
    actor: QrInventoryActor;
    auditRequestId: string;
    designStatus: StickerDesignStatus;
    expectedDesignVersion: number;
    expectedSiteVersion: number;
    idempotencyKey: string;
    managementCompanyId: string;
    purpose: string;
    quantity: number;
    reason: string;
    siteId: string;
    siteStatus: OrganizationStatus;
    stickerDesignVersionId: string;
    tenantId: string;
  }): Promise<QrInventoryCommandResult> {
    authorize(input.actor, "qr-batch:request", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.idempotencyKey);
    assertUuid(input.siteId);
    assertUuid(input.stickerDesignVersionId);
    assertVersion(input.expectedDesignVersion);
    assertVersion(input.expectedSiteVersion);
    assertQuantity(input.quantity);
    if (input.siteStatus !== "ACTIVE") {
      throw new QrInventorySampleError("INVALID_SITE_STATUS");
    }
    if (input.designStatus !== "APPROVED") {
      throw new QrInventorySampleError("INVALID_DESIGN_STATUS");
    }
    return this.repository.requestBatch({
      auditRequestId: input.auditRequestId,
      expectedDesignVersion: input.expectedDesignVersion,
      expectedSiteVersion: input.expectedSiteVersion,
      idempotencyKey: input.idempotencyKey,
      purpose: normalizePurpose(input.purpose),
      quantity: input.quantity,
      reason: normalizeReason(input.reason),
      siteId: input.siteId,
      stickerDesignVersionId: input.stickerDesignVersionId,
    });
  }

  async attachSample(input: {
    actor: QrInventoryActor;
    auditRequestId: string;
    batchId: string;
    batchStatus: QrBatchStatus;
    byteSize: number;
    checksumSha256: string;
    contrastPassed: boolean;
    decodePassed: boolean;
    expectedBatchVersion: number;
    managementCompanyId: string;
    mimeType: string;
    quietZonePassed: boolean;
    reason: string;
    siteId: string;
    storageBucket: string;
    storagePath: string;
    tenantId: string;
  }): Promise<QrInventoryCommandResult> {
    authorize(input.actor, "qr-batch:sample-approve", input);
    assertCommandIdentity({
      auditRequestId: input.auditRequestId,
      expectedVersion: input.expectedBatchVersion,
      resourceId: input.batchId,
    });
    if (input.batchStatus !== "DRAFT") {
      throw new QrInventorySampleError("INVALID_BATCH_STATUS");
    }
    assertMimeType(input.mimeType);
    assertByteSize(input.byteSize);
    return this.repository.attachSample({
      auditRequestId: input.auditRequestId,
      batchId: input.batchId,
      byteSize: input.byteSize,
      checksumSha256: normalizeChecksum(input.checksumSha256),
      contrastPassed: input.contrastPassed,
      decodePassed: input.decodePassed,
      expectedBatchVersion: input.expectedBatchVersion,
      mimeType: input.mimeType,
      quietZonePassed: input.quietZonePassed,
      reason: normalizeReason(input.reason),
      storageBucket: normalizeStorageBucket(input.storageBucket),
      storagePath: normalizeStoragePath(input.storagePath),
    });
  }

  async approveSample(input: {
    actor: QrInventoryActor;
    auditRequestId: string;
    batchId: string;
    batchStatus: QrBatchStatus;
    contrastPassed: boolean;
    decodePassed: boolean;
    expectedBatchVersion: number;
    expectedSampleVersion: number;
    managementCompanyId: string;
    quietZonePassed: boolean;
    reason: string;
    requestedByCurrentActor: boolean;
    sampleId: string;
    sampleStatus: QrBatchSampleStatus;
    siteId: string;
    tenantId: string;
  }): Promise<QrInventoryCommandResult> {
    authorize(input.actor, "qr-batch:sample-approve", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.batchId);
    assertUuid(input.sampleId);
    assertVersion(input.expectedBatchVersion);
    assertVersion(input.expectedSampleVersion);
    if (input.batchStatus !== "SAMPLE_READY" || input.sampleStatus !== "READY") {
      throw new QrInventorySampleError("INVALID_BATCH_STATUS");
    }
    if (!input.decodePassed || !input.quietZonePassed || !input.contrastPassed) {
      throw new QrInventorySampleError("QA_REQUIRED");
    }
    if (input.requestedByCurrentActor) {
      throw new QrInventorySampleError("SELF_REVIEW_FORBIDDEN");
    }
    return this.repository.approveSample({
      auditRequestId: input.auditRequestId,
      batchId: input.batchId,
      expectedBatchVersion: input.expectedBatchVersion,
      expectedSampleVersion: input.expectedSampleVersion,
      reason: normalizeReason(input.reason),
      sampleId: input.sampleId,
    });
  }

  async invalidateSample(input: {
    actor: QrInventoryActor;
    auditRequestId: string;
    batchId: string;
    batchStatus: QrBatchStatus;
    expectedBatchVersion: number;
    expectedSampleVersion: number;
    managementCompanyId: string;
    reason: string;
    sampleId: string;
    sampleStatus: QrBatchSampleStatus;
    siteId: string;
    tenantId: string;
  }): Promise<QrInventoryCommandResult> {
    authorize(input.actor, "qr-batch:sample-approve", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.batchId);
    assertUuid(input.sampleId);
    assertVersion(input.expectedBatchVersion);
    assertVersion(input.expectedSampleVersion);
    if (
      !["SAMPLE_READY", "SAMPLE_APPROVED"].includes(input.batchStatus) ||
      !["READY", "APPROVED"].includes(input.sampleStatus)
    ) {
      throw new QrInventorySampleError("INVALID_BATCH_STATUS");
    }
    return this.repository.invalidateSample({
      auditRequestId: input.auditRequestId,
      batchId: input.batchId,
      expectedBatchVersion: input.expectedBatchVersion,
      expectedSampleVersion: input.expectedSampleVersion,
      reason: normalizeReason(input.reason),
      sampleId: input.sampleId,
    });
  }

  async cancelBatch(input: {
    actor: QrInventoryActor;
    auditRequestId: string;
    batchId: string;
    batchStatus: QrBatchStatus;
    expectedBatchVersion: number;
    managementCompanyId: string;
    reason: string;
    requestedByCurrentActor: boolean;
    siteId: string;
    tenantId: string;
  }): Promise<QrInventoryCommandResult> {
    authorize(input.actor, "qr-batch:request", input);
    assertCommandIdentity({
      auditRequestId: input.auditRequestId,
      expectedVersion: input.expectedBatchVersion,
      resourceId: input.batchId,
    });
    if (!["DRAFT", "SAMPLE_READY"].includes(input.batchStatus)) {
      throw new QrInventorySampleError("INVALID_BATCH_STATUS");
    }
    if (!input.requestedByCurrentActor) {
      throw new QrInventorySampleError("REQUESTER_REQUIRED");
    }
    return this.repository.cancelBatch({
      auditRequestId: input.auditRequestId,
      batchId: input.batchId,
      expectedBatchVersion: input.expectedBatchVersion,
      reason: normalizeReason(input.reason),
    });
  }
}
