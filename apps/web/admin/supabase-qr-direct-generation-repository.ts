import "server-only";

import type {
  QrDirectGenerationBatchResult,
  QrDirectGenerationRepository,
  QrDirectGenerationResult,
} from "@taptolk/application";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export class QrDirectGenerationRepositoryError extends Error {
  readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE";

  constructor(code: QrDirectGenerationRepositoryError["code"]) {
    super(`QR direct generation repository failed: ${code}`);
    this.name = "QrDirectGenerationRepositoryError";
    this.code = code;
  }
}

function mapErrorCode(code?: string): QrDirectGenerationRepositoryError["code"] {
  if (code === "40001") return "CONFLICT";
  if (code === "42501") return "FORBIDDEN";
  if (code === "P0001" || code === "23514") return "BLOCKED";
  return "UNAVAILABLE";
}

function mapBatch(value: unknown): QrDirectGenerationBatchResult {
  if (!value || typeof value !== "object") {
    throw new QrDirectGenerationRepositoryError("UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.batchId !== "string" ||
    typeof row.batchCode !== "string" ||
    typeof row.batchStatus !== "string" ||
    typeof row.batchVersion !== "number" ||
    typeof row.generationRevision !== "number" ||
    typeof row.jobId !== "string" ||
    typeof row.jobStatus !== "string" ||
    typeof row.requestedQuantity !== "number"
  ) {
    throw new QrDirectGenerationRepositoryError("UNAVAILABLE");
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

function mapResult(value: unknown): QrDirectGenerationResult {
  if (!value || typeof value !== "object") {
    throw new QrDirectGenerationRepositoryError("UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.requestId !== "string" ||
    typeof row.siteId !== "string" ||
    typeof row.totalQuantity !== "number" ||
    !Array.isArray(row.batches)
  ) {
    throw new QrDirectGenerationRepositoryError("UNAVAILABLE");
  }
  return {
    batches: row.batches.map(mapBatch),
    requestId: row.requestId,
    siteId: row.siteId,
    totalQuantity: row.totalQuantity,
  };
}

export function createSupabaseQrDirectGenerationRepository(
  client: AdminServerClient,
): QrDirectGenerationRepository {
  return {
    async request(input) {
      const { data, error } = await client.rpc("request_admin_direct_qr_generation", {
        p_expected_site_version: input.expectedSiteVersion,
        p_idempotency_key: input.idempotencyKey,
        p_reason: input.reason,
        p_site_id: input.siteId,
        p_total_quantity: input.quantity,
      });
      if (error) {
        throw new QrDirectGenerationRepositoryError(mapErrorCode(error.code));
      }
      return mapResult(data);
    },
  };
}
