import "server-only";

import type {
  QrBatchSampleStatus,
  QrBatchStatus,
  QrFinalApprovalBatchItem,
  QrFinalApprovalCommandResult,
  QrFinalGenerationApprovalRepository,
  QrGenerationJobStatus,
  StickerDesignStatus,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export class QrFinalGenerationApprovalRepositoryError extends Error {
  readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE";

  constructor(code: QrFinalGenerationApprovalRepositoryError["code"]) {
    super(`QR final generation approval repository failed: ${code}`);
    this.name = "QrFinalGenerationApprovalRepositoryError";
    this.code = code;
  }
}

const logger = createLogger({ service: "taptolk-web" });

function isOrganizationStatus(value: unknown): value is "ACTIVE" | "CLOSED" | "SUSPENDED" {
  return value === "ACTIVE" || value === "CLOSED" || value === "SUSPENDED";
}

function isBatchStatus(value: unknown): value is QrBatchStatus {
  return [
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
  ].includes(String(value));
}

function isSampleStatus(value: unknown): value is QrBatchSampleStatus {
  return value === "READY" || value === "APPROVED" || value === "INVALIDATED";
}

function isDesignStatus(value: unknown): value is StickerDesignStatus {
  return value === "DRAFT" || value === "APPROVED" || value === "ARCHIVED";
}

function isJobStatus(value: unknown): value is QrGenerationJobStatus {
  return [
    "PENDING_DELIVERY",
    "DELIVERY_LEASED",
    "QUEUED",
    "PROCESSING",
    "RETRY_WAIT",
    "COMPLETED",
    "FAILED",
    "ABORTED",
    "PARTIALLY_COMPLETED",
  ].includes(String(value));
}

function mapBatch(value: unknown): QrFinalApprovalBatchItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrFinalGenerationApprovalRepositoryError("UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.tenant_id !== "string" ||
    !isOrganizationStatus(row.tenant_status) ||
    typeof row.management_company_id !== "string" ||
    !isOrganizationStatus(row.management_company_status) ||
    typeof row.site_id !== "string" ||
    typeof row.site_name !== "string" ||
    !isOrganizationStatus(row.site_status) ||
    typeof row.batch_code !== "string" ||
    typeof row.requested_quantity !== "number" ||
    !isBatchStatus(row.status) ||
    typeof row.requested_by_current_actor !== "boolean" ||
    !isDesignStatus(row.sticker_design_status) ||
    (row.sample_status !== null && !isSampleStatus(row.sample_status)) ||
    typeof row.has_generation_job !== "boolean" ||
    typeof row.version !== "number" ||
    typeof row.created_at !== "string"
  ) {
    throw new QrFinalGenerationApprovalRepositoryError("UNAVAILABLE");
  }
  return {
    batchCode: row.batch_code,
    createdAt: row.created_at,
    hasGenerationJob: row.has_generation_job,
    id: row.id,
    managementCompanyId: row.management_company_id,
    managementCompanyStatus: row.management_company_status,
    requestedByCurrentActor: row.requested_by_current_actor,
    requestedQuantity: row.requested_quantity,
    sampleStatus: row.sample_status,
    siteId: row.site_id,
    siteName: row.site_name,
    siteStatus: row.site_status,
    status: row.status,
    stickerDesignStatus: row.sticker_design_status,
    tenantId: row.tenant_id,
    tenantStatus: row.tenant_status,
    version: row.version,
  };
}

function readList(value: unknown): readonly QrFinalApprovalBatchItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrFinalGenerationApprovalRepositoryError("UNAVAILABLE");
  }
  const batches = (value as Record<string, unknown>).batches;
  if (!Array.isArray(batches)) {
    throw new QrFinalGenerationApprovalRepositoryError("UNAVAILABLE");
  }
  return batches.map(mapBatch);
}

function readCommandResult(value: unknown): QrFinalApprovalCommandResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const result = value as Record<string, unknown>;
  if (
    typeof result.batchId !== "string" ||
    !isBatchStatus(result.batchStatus) ||
    typeof result.batchVersion !== "number" ||
    (result.generationRevision !== null && typeof result.generationRevision !== "number") ||
    (result.jobStatus !== null && !isJobStatus(result.jobStatus))
  ) {
    return null;
  }
  return {
    batchId: result.batchId,
    batchStatus: result.batchStatus,
    batchVersion: result.batchVersion,
    generationRevision: result.generationRevision,
    jobStatus: result.jobStatus,
  };
}

function mapError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (
    message.includes("PARENT_NOT_ACTIVE") ||
    message.includes("DESIGN_NOT_APPROVED") ||
    message.includes("SAMPLE_NOT_APPROVED")
  ) {
    return new QrFinalGenerationApprovalRepositoryError("BLOCKED");
  }
  if (
    error.code === "23505" ||
    error.code === "40001" ||
    message.includes("VERSION_CONFLICT") ||
    message.includes("TRANSITION") ||
    message.includes("GENERATION_JOB_EXISTS") ||
    message.includes("IDEMPOTENCY")
  ) {
    return new QrFinalGenerationApprovalRepositoryError("CONFLICT");
  }
  if (error.code === "42501" || message.includes("NOT_FOUND_OR_FORBIDDEN")) {
    return new QrFinalGenerationApprovalRepositoryError("FORBIDDEN");
  }
  return new QrFinalGenerationApprovalRepositoryError("UNAVAILABLE");
}

function assertCommandResult(
  operation: string,
  result: { data: unknown; error: { code?: string; message?: string } | null },
): QrFinalApprovalCommandResult {
  const value = readCommandResult(result.data);
  if (result.error || !value) {
    logger.error("admin.qr_final_approval.command_failed", {
      errorCode: result.error?.code ?? null,
      operation,
    });
    throw result.error
      ? mapError(result.error)
      : new QrFinalGenerationApprovalRepositoryError("UNAVAILABLE");
  }
  return value;
}

export function createSupabaseQrFinalGenerationApprovalRepository(
  client: AdminServerClient,
): QrFinalGenerationApprovalRepository {
  return {
    async approveFinalGeneration(input) {
      return assertCommandResult(
        "approve_final_generation",
        await client.rpc("approve_qr_batch_final_generation", {
          p_batch_id: input.batchId,
          p_expected_batch_version: input.expectedBatchVersion,
          p_reason: input.reason,
          p_request_id: input.requestId,
        }),
      );
    },
    async cancelBeforeGenerationApproval(input) {
      return assertCommandResult(
        "cancel_before_generation_approval",
        await client.rpc("cancel_qr_batch_before_generation_approval", {
          p_batch_id: input.batchId,
          p_expected_batch_version: input.expectedBatchVersion,
          p_reason: input.reason,
          p_request_id: input.requestId,
        }),
      );
    },
    async getBatchForCommand(batchId) {
      const result = await client.rpc("get_qr_final_generation_approval_batch", {
        p_batch_id: batchId,
      });
      if (result.error) {
        logger.error("admin.qr_final_approval.command_snapshot_failed", {
          errorCode: result.error.code,
        });
        throw mapError(result.error);
      }
      return result.data === null ? null : mapBatch(result.data);
    },
    async list() {
      const result = await client.rpc("list_qr_final_generation_approval_read_model");
      if (result.error) {
        logger.error("admin.qr_final_approval.query_failed", {
          errorCode: result.error.code,
        });
        throw new QrFinalGenerationApprovalRepositoryError("UNAVAILABLE");
      }
      return readList(result.data);
    },
    async requestFinalApproval(input) {
      return assertCommandResult(
        "request_final_approval",
        await client.rpc("request_qr_batch_final_approval", {
          p_batch_id: input.batchId,
          p_expected_batch_version: input.expectedBatchVersion,
          p_reason: input.reason,
          p_request_id: input.requestId,
        }),
      );
    },
  };
}
