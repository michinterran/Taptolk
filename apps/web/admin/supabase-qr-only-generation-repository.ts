import "server-only";

import type {
  QrBatchStatus,
  QrOnlyGenerationBatchResult,
  QrOnlyGenerationRepository,
  QrOnlyGenerationResult,
} from "@taptolk/application";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export class QrOnlyGenerationRepositoryError extends Error {
  readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE";

  constructor(code: QrOnlyGenerationRepositoryError["code"]) {
    super(`QR-only generation repository failed: ${code}`);
    this.name = "QrOnlyGenerationRepositoryError";
    this.code = code;
  }
}

function isBatchStatus(value: unknown): value is QrBatchStatus {
  return [
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
    "PARTIALLY_COMPLETED",
  ].includes(String(value));
}

function mapErrorCode(code?: string): QrOnlyGenerationRepositoryError["code"] {
  if (code === "40001") return "CONFLICT";
  if (code === "42501") return "FORBIDDEN";
  if (code === "P0001" || code === "23514") return "BLOCKED";
  return "UNAVAILABLE";
}

function mapBatch(value: unknown): QrOnlyGenerationBatchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrOnlyGenerationRepositoryError("UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.batchId !== "string" ||
    typeof row.batchCode !== "string" ||
    !isBatchStatus(row.batchStatus) ||
    typeof row.batchVersion !== "number" ||
    typeof row.generationRevision !== "number" ||
    typeof row.jobId !== "string" ||
    typeof row.jobStatus !== "string" ||
    typeof row.requestedQuantity !== "number"
  ) {
    throw new QrOnlyGenerationRepositoryError("UNAVAILABLE");
  }
  return {
    batchCode: row.batchCode,
    batchId: row.batchId,
    batchStatus: row.batchStatus,
    batchVersion: row.batchVersion,
    generationRevision: row.generationRevision,
    jobId: row.jobId,
    jobStatus: row.jobStatus,
    requestedQuantity: row.requestedQuantity,
  };
}

function mapResult(value: unknown): QrOnlyGenerationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrOnlyGenerationRepositoryError("UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.requestId !== "string" ||
    typeof row.siteId !== "string" ||
    typeof row.totalQuantity !== "number" ||
    !Array.isArray(row.batches)
  ) {
    throw new QrOnlyGenerationRepositoryError("UNAVAILABLE");
  }
  return {
    batches: row.batches.map(mapBatch),
    requestId: row.requestId,
    siteId: row.siteId,
    totalQuantity: row.totalQuantity,
  };
}

export function createSupabaseQrOnlyGenerationRepository(
  client: AdminServerClient,
): QrOnlyGenerationRepository {
  return {
    async request(input) {
      const { data, error } = await client.rpc("request_admin_qr_only_generation", {
        p_expected_site_version: input.expectedSiteVersion,
        p_idempotency_key: input.idempotencyKey,
        p_reason: input.reason,
        p_site_id: input.siteId,
        p_total_quantity: input.quantity,
      });
      if (error) {
        throw new QrOnlyGenerationRepositoryError(mapErrorCode(error.code));
      }
      return mapResult(data);
    },
  };
}
