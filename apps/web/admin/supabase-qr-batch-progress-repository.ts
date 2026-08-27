import "server-only";

import type {
  QrBatchProgressItem,
  QrBatchProgressRepository,
  QrBatchStatus,
} from "@taptolk/application";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

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

function isExportType(value: unknown): value is "CSV" | "MANIFEST" | "PDF" | "ZIP" {
  return value === "CSV" || value === "MANIFEST" || value === "PDF" || value === "ZIP";
}

function mapItem(value: unknown): QrBatchProgressItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("QR_BATCH_PROGRESS_UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.batch_code !== "string" ||
    typeof row.site_name !== "string" ||
    typeof row.requested_quantity !== "number" ||
    typeof row.generated_quantity !== "number" ||
    typeof row.rendered_quantity !== "number" ||
    typeof row.passed_quantity !== "number" ||
    typeof row.failed_quantity !== "number" ||
    !isBatchStatus(row.status) ||
    (row.job_status !== null && typeof row.job_status !== "string") ||
    (row.processed_count !== null && typeof row.processed_count !== "number") ||
    (row.execution_attempt_count !== null && typeof row.execution_attempt_count !== "number") ||
    !Array.isArray(row.export_types) ||
    !row.export_types.every(isExportType)
  ) {
    throw new Error("QR_BATCH_PROGRESS_UNAVAILABLE");
  }
  return {
    batchCode: row.batch_code,
    executionAttemptCount: row.execution_attempt_count,
    exportTypes: row.export_types,
    failedQuantity: row.failed_quantity,
    generatedQuantity: row.generated_quantity,
    id: row.id,
    jobStatus: row.job_status,
    passedQuantity: row.passed_quantity,
    processedCount: row.processed_count,
    renderedQuantity: row.rendered_quantity,
    requestedQuantity: row.requested_quantity,
    siteName: row.site_name,
    status: row.status,
  };
}

export function createSupabaseQrBatchProgressRepository(
  client: AdminServerClient,
): QrBatchProgressRepository {
  return {
    async list() {
      const result = await client.rpc("list_qr_batch_progress_read_model");
      if (result.error || !Array.isArray(result.data)) {
        throw new Error("QR_BATCH_PROGRESS_UNAVAILABLE");
      }
      return result.data.map(mapItem);
    },
  };
}
