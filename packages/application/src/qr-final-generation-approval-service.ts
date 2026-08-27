import {
  type AdminAuthorizationContext,
  type AdminPermission,
  authorizeAdminAction,
  roleHasPermission,
} from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";
import type { OrganizationStatus } from "./management-company-catalog-service.js";
import type {
  QrBatchSampleStatus,
  QrBatchStatus,
  StickerDesignStatus,
} from "./qr-inventory-sample-service.js";

export const QR_GENERATION_JOB_STATUSES = [
  "PENDING_DELIVERY",
  "DELIVERY_LEASED",
  "QUEUED",
  "PROCESSING",
  "RETRY_WAIT",
  "COMPLETED",
  "FAILED",
  "ABORTED",
  "PARTIALLY_COMPLETED",
] as const;
export type QrGenerationJobStatus = (typeof QR_GENERATION_JOB_STATUSES)[number];

export const QR_GENERATION_MAX_EXECUTION_ATTEMPTS = 5;

export interface QrFinalGenerationApprovalActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface QrFinalApprovalBatchItem {
  batchCode: string;
  createdAt: string;
  hasGenerationJob: boolean;
  id: string;
  managementCompanyId: string;
  managementCompanyStatus: OrganizationStatus;
  requestedByCurrentActor: boolean;
  requestedQuantity: number;
  sampleStatus: QrBatchSampleStatus | null;
  siteId: string;
  siteName: string;
  siteStatus: OrganizationStatus;
  status: QrBatchStatus;
  stickerDesignStatus: StickerDesignStatus;
  tenantId: string;
  tenantStatus: OrganizationStatus;
  version: number;
}

export interface QrFinalGenerationApprovalReadModel {
  batches: readonly QrFinalApprovalBatchItem[];
  cancellableBatchIds: ReadonlySet<string>;
  finalApprovalQueue: readonly QrFinalApprovalBatchItem[];
  requestableBatchIds: ReadonlySet<string>;
}

export interface QrFinalApprovalCommandResult {
  batchId: string;
  batchStatus: QrBatchStatus;
  batchVersion: number;
  generationRevision: number | null;
  jobStatus: QrGenerationJobStatus | null;
}

export interface QrFinalGenerationApprovalRepository {
  approveFinalGeneration(input: {
    batchId: string;
    expectedBatchVersion: number;
    reason: string;
    requestId: string;
  }): Promise<QrFinalApprovalCommandResult>;
  cancelBeforeGenerationApproval(input: {
    batchId: string;
    expectedBatchVersion: number;
    reason: string;
    requestId: string;
  }): Promise<QrFinalApprovalCommandResult>;
  getBatchForCommand(batchId: string): Promise<QrFinalApprovalBatchItem | null>;
  list(): Promise<readonly QrFinalApprovalBatchItem[]>;
  requestFinalApproval(input: {
    batchId: string;
    expectedBatchVersion: number;
    reason: string;
    requestId: string;
  }): Promise<QrFinalApprovalCommandResult>;
}

export class QrFinalGenerationApprovalError extends Error {
  readonly code:
    | "BATCH_NOT_FOUND"
    | "GENERATION_JOB_EXISTS"
    | "INACTIVE_PARENT"
    | "INVALID_BATCH_STATUS"
    | "INVALID_DESIGN_STATUS"
    | "INVALID_ID"
    | "INVALID_REASON"
    | "INVALID_SAMPLE_STATUS"
    | "INVALID_VERSION"
    | "REQUESTER_REQUIRED"
    | "SELF_APPROVAL_FORBIDDEN"
    | "VERSION_CONFLICT";

  constructor(code: QrFinalGenerationApprovalError["code"]) {
    super(`QR final generation approval rejected: ${code}`);
    this.name = "QrFinalGenerationApprovalError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new QrFinalGenerationApprovalError("INVALID_ID");
  }
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new QrFinalGenerationApprovalError("INVALID_VERSION");
  }
}

function normalizeReason(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 500) {
    throw new QrFinalGenerationApprovalError("INVALID_REASON");
  }
  return normalized;
}

function resource(input: { managementCompanyId: string; siteId: string; tenantId: string }) {
  return {
    managementCompanyId: input.managementCompanyId,
    siteId: input.siteId,
    tenantId: input.tenantId,
  };
}

function authorize(
  actor: QrFinalGenerationApprovalActor,
  permission: AdminPermission,
  target: { managementCompanyId: string; siteId: string; tenantId: string },
): void {
  assertUuid(actor.userId);
  assertAdminAuthorized(authorizeAdminAction(actor.authorization, permission, resource(target)));
}

function membershipResource(actor: QrFinalGenerationApprovalActor) {
  const scope = actor.authorization.scope;
  return {
    ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
    ...(scope.siteId ? { siteId: scope.siteId } : {}),
    tenantId: scope.tenantId ?? "platform-qr-final-approval",
  };
}

function authorizeMembership(
  actor: QrFinalGenerationApprovalActor,
  permission: AdminPermission,
): void {
  assertUuid(actor.userId);
  assertAdminAuthorized(
    authorizeAdminAction(actor.authorization, permission, membershipResource(actor)),
  );
}

function assertCommandIdentity(input: {
  batchId: string;
  expectedBatchVersion: number;
  requestId: string;
}): void {
  assertUuid(input.requestId);
  assertUuid(input.batchId);
  assertVersion(input.expectedBatchVersion);
}

function hasActiveParents(input: {
  managementCompanyStatus: OrganizationStatus;
  siteStatus: OrganizationStatus;
  tenantStatus: OrganizationStatus;
}): boolean {
  return (
    input.tenantStatus === "ACTIVE" &&
    input.managementCompanyStatus === "ACTIVE" &&
    input.siteStatus === "ACTIVE"
  );
}

function assertApprovalPrerequisites(input: QrFinalApprovalBatchItem): void {
  if (!hasActiveParents(input)) {
    throw new QrFinalGenerationApprovalError("INACTIVE_PARENT");
  }
  if (input.stickerDesignStatus !== "APPROVED") {
    throw new QrFinalGenerationApprovalError("INVALID_DESIGN_STATUS");
  }
  if (input.sampleStatus !== "APPROVED") {
    throw new QrFinalGenerationApprovalError("INVALID_SAMPLE_STATUS");
  }
  if (input.hasGenerationJob) {
    throw new QrFinalGenerationApprovalError("GENERATION_JOB_EXISTS");
  }
}

function isApprovalEligible(batch: QrFinalApprovalBatchItem): boolean {
  return (
    hasActiveParents(batch) &&
    batch.sampleStatus === "APPROVED" &&
    batch.stickerDesignStatus === "APPROVED" &&
    !batch.hasGenerationJob
  );
}

export class QrFinalGenerationApprovalService {
  constructor(private readonly repository: QrFinalGenerationApprovalRepository) {}

  private async getCommandBatch(input: {
    actor: QrFinalGenerationApprovalActor;
    batchId: string;
    expectedBatchVersion: number;
    permission: AdminPermission;
    requestId: string;
  }): Promise<QrFinalApprovalBatchItem> {
    assertCommandIdentity(input);
    authorizeMembership(input.actor, input.permission);
    const batch = await this.repository.getBatchForCommand(input.batchId);
    if (!batch) {
      throw new QrFinalGenerationApprovalError("BATCH_NOT_FOUND");
    }
    assertUuid(batch.id);
    assertUuid(batch.tenantId);
    assertUuid(batch.managementCompanyId);
    assertUuid(batch.siteId);
    authorize(input.actor, input.permission, batch);
    if (batch.version !== input.expectedBatchVersion) {
      throw new QrFinalGenerationApprovalError("VERSION_CONFLICT");
    }
    return batch;
  }

  async list(input: {
    actor: QrFinalGenerationApprovalActor;
  }): Promise<QrFinalGenerationApprovalReadModel> {
    assertUuid(input.actor.userId);
    assertAdminAuthorized(
      authorizeAdminAction(
        input.actor.authorization,
        "qr-batch:read",
        membershipResource(input.actor),
      ),
    );

    const batches = await this.repository.list();
    const canRequest = roleHasPermission(input.actor.authorization.role, "qr-batch:request");
    const canApprove = roleHasPermission(
      input.actor.authorization.role,
      "qr-batch:generation-approve",
    );

    return {
      batches,
      cancellableBatchIds: new Set(
        canRequest
          ? batches
              .filter(
                (batch) =>
                  batch.requestedByCurrentActor &&
                  !batch.hasGenerationJob &&
                  (batch.status === "SAMPLE_APPROVED" || batch.status === "FINAL_APPROVAL_PENDING"),
              )
              .map((batch) => batch.id)
          : [],
      ),
      finalApprovalQueue: canApprove
        ? batches.filter(
            (batch) =>
              batch.status === "FINAL_APPROVAL_PENDING" &&
              !batch.requestedByCurrentActor &&
              isApprovalEligible(batch),
          )
        : [],
      requestableBatchIds: new Set(
        canRequest
          ? batches
              .filter(
                (batch) =>
                  batch.status === "SAMPLE_APPROVED" &&
                  batch.requestedByCurrentActor &&
                  isApprovalEligible(batch),
              )
              .map((batch) => batch.id)
          : [],
      ),
    };
  }

  async requestFinalApproval(input: {
    actor: QrFinalGenerationApprovalActor;
    batchId: string;
    expectedBatchVersion: number;
    reason: string;
    requestId: string;
  }): Promise<QrFinalApprovalCommandResult> {
    const reason = normalizeReason(input.reason);
    const batch = await this.getCommandBatch({
      ...input,
      permission: "qr-batch:request",
    });
    if (batch.status !== "SAMPLE_APPROVED") {
      throw new QrFinalGenerationApprovalError("INVALID_BATCH_STATUS");
    }
    if (!batch.requestedByCurrentActor) {
      throw new QrFinalGenerationApprovalError("REQUESTER_REQUIRED");
    }
    assertApprovalPrerequisites(batch);

    return this.repository.requestFinalApproval({
      batchId: input.batchId,
      expectedBatchVersion: input.expectedBatchVersion,
      reason,
      requestId: input.requestId,
    });
  }

  async approveFinalGeneration(input: {
    actor: QrFinalGenerationApprovalActor;
    batchId: string;
    expectedBatchVersion: number;
    reason: string;
    requestId: string;
  }): Promise<QrFinalApprovalCommandResult> {
    const reason = normalizeReason(input.reason);
    const batch = await this.getCommandBatch({
      ...input,
      permission: "qr-batch:generation-approve",
    });
    if (batch.status !== "FINAL_APPROVAL_PENDING") {
      throw new QrFinalGenerationApprovalError("INVALID_BATCH_STATUS");
    }
    if (batch.requestedByCurrentActor) {
      throw new QrFinalGenerationApprovalError("SELF_APPROVAL_FORBIDDEN");
    }
    assertApprovalPrerequisites(batch);

    return this.repository.approveFinalGeneration({
      batchId: input.batchId,
      expectedBatchVersion: input.expectedBatchVersion,
      reason,
      requestId: input.requestId,
    });
  }

  async cancelBeforeGenerationApproval(input: {
    actor: QrFinalGenerationApprovalActor;
    batchId: string;
    expectedBatchVersion: number;
    reason: string;
    requestId: string;
  }): Promise<QrFinalApprovalCommandResult> {
    const reason = normalizeReason(input.reason);
    const batch = await this.getCommandBatch({
      ...input,
      permission: "qr-batch:request",
    });
    if (batch.status !== "SAMPLE_APPROVED" && batch.status !== "FINAL_APPROVAL_PENDING") {
      throw new QrFinalGenerationApprovalError("INVALID_BATCH_STATUS");
    }
    if (!batch.requestedByCurrentActor) {
      throw new QrFinalGenerationApprovalError("REQUESTER_REQUIRED");
    }
    if (batch.hasGenerationJob) {
      throw new QrFinalGenerationApprovalError("GENERATION_JOB_EXISTS");
    }

    return this.repository.cancelBeforeGenerationApproval({
      batchId: input.batchId,
      expectedBatchVersion: input.expectedBatchVersion,
      reason,
      requestId: input.requestId,
    });
  }
}
