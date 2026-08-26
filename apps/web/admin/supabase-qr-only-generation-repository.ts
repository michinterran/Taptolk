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
  return ["FINAL_APPROVAL_PENDING", "SAMPLE_APPROVED"].includes(String(value));
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
    row.generationRevision !== null ||
    row.jobId !== null ||
    row.jobStatus !== null ||
    typeof row.requestedQuantity !== "number"
  ) {
    throw new QrOnlyGenerationRepositoryError("UNAVAILABLE");
  }
  return {
    batchCode: row.batchCode,
    batchId: row.batchId,
    batchStatus: row.batchStatus,
    batchVersion: row.batchVersion,
    generationRevision: null,
    jobId: null,
    jobStatus: null,
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
