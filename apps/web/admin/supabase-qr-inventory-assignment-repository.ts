import "server-only";

import type {
  QrInventoryAssignmentAssetItem,
  QrInventoryAssignmentBatchItem,
  QrInventoryAssignmentCommandResult,
  QrInventoryAssignmentReadModel,
  QrInventoryAssignmentRepository,
  VehicleImportItem,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

const logger = createLogger({ service: "taptolk-web" });

export class QrInventoryAssignmentRepositoryError extends Error {
  constructor(readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE") {
    super(`QR inventory assignment repository failed: ${code}`);
    this.name = "QrInventoryAssignmentRepositoryError";
  }
}

function mapError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (
    message.includes("NOT_ASSIGNABLE") ||
    message.includes("NOT_COMMITTABLE") ||
    message.includes("NOT_REPLACEABLE") ||
    message.includes("COUNT_MISMATCH") ||
    message.includes("NOT_DELIVERED") ||
    message.includes("NOT_RECEIVABLE") ||
    message.includes("EXCEEDS_PENDING") ||
    message.includes("DELIVERY_TRANSITION") ||
    message.includes("ASSET_COUNT_MISMATCH")
  ) {
    return new QrInventoryAssignmentRepositoryError("BLOCKED");
  }
  if (
    error.code === "23505" ||
    error.code === "40001" ||
    error.code === "55P03" ||
    message.includes("VERSION_CONFLICT") ||
    message.includes("DUPLICATE")
  ) {
    return new QrInventoryAssignmentRepositoryError("CONFLICT");
  }
  if (error.code === "42501" || error.code === "P0002" || message.includes("FORBIDDEN")) {
    return new QrInventoryAssignmentRepositoryError("FORBIDDEN");
  }
  return new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
}

function readCommandResult(value: unknown): QrInventoryAssignmentCommandResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.resource_id !== "string" ||
    typeof row.version !== "number" ||
    typeof row.affected_count !== "number"
  ) {
    return null;
  }
  return {
    affectedCount: row.affected_count,
    resourceId: row.resource_id,
    version: row.version,
  };
}

function assertCommandResult(
  operation: string,
  result: { data: unknown; error: { code?: string; message?: string } | null },
): QrInventoryAssignmentCommandResult {
  const value = readCommandResult(result.data);
  if (result.error || !value) {
    logger.error("admin.qr_inventory_assignment.command_failed", {
      errorCode: result.error?.code ?? null,
      operation,
    });
    throw result.error
      ? mapError(result.error)
      : new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
  }
  return value;
}

function isBatchStatus(value: unknown): value is QrInventoryAssignmentBatchItem["status"] {
  return (
    value === "DELIVERED" ||
    value === "PARTIALLY_RECEIVED" ||
    value === "DISTRIBUTING" ||
    value === "COMPLETED"
  );
}

function isAssetStatus(value: unknown): value is QrInventoryAssignmentAssetItem["status"] {
  return [
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
  ].includes(String(value));
}

function isImportStatus(value: unknown): value is VehicleImportItem["status"] {
  return ["VALIDATED", "COMMITTED", "REJECTED", "EXPIRED"].includes(String(value));
}

function mapBatch(value: unknown): QrInventoryAssignmentBatchItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.tenant_id !== "string" ||
    typeof row.management_company_id !== "string" ||
    typeof row.site_id !== "string" ||
    typeof row.site_name !== "string" ||
    typeof row.batch_code !== "string" ||
    typeof row.requested_quantity !== "number" ||
    !isBatchStatus(row.status) ||
    typeof row.version !== "number"
  ) {
    throw new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
  }
  return {
    batchCode: row.batch_code,
    id: row.id,
    managementCompanyId: row.management_company_id,
    requestedQuantity: row.requested_quantity,
    siteId: row.site_id,
    siteName: row.site_name,
    status: row.status,
    tenantId: row.tenant_id,
    version: row.version,
  };
}

function mapAsset(value: unknown): QrInventoryAssignmentAssetItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.tenant_id !== "string" ||
    typeof row.management_company_id !== "string" ||
    typeof row.site_id !== "string" ||
    typeof row.batch_id !== "string" ||
    typeof row.human_code !== "string" ||
    !isAssetStatus(row.status) ||
    (row.current_binding_id !== null && typeof row.current_binding_id !== "string") ||
    (row.current_vehicle_last4 !== null && typeof row.current_vehicle_last4 !== "string") ||
    typeof row.version !== "number"
  ) {
    throw new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
  }
  return {
    batchId: row.batch_id,
    currentBindingId: row.current_binding_id,
    currentVehicleLast4: row.current_vehicle_last4,
    humanCode: row.human_code,
    id: row.id,
    managementCompanyId: row.management_company_id,
    siteId: row.site_id,
    status: row.status,
    tenantId: row.tenant_id,
    version: row.version,
  };
}

function mapImport(value: unknown): VehicleImportItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.tenant_id !== "string" ||
    typeof row.management_company_id !== "string" ||
    typeof row.site_id !== "string" ||
    typeof row.row_count !== "number" ||
    !isImportStatus(row.status) ||
    typeof row.original_deleted_at !== "string" ||
    (row.committed_at !== null && typeof row.committed_at !== "string") ||
    typeof row.version !== "number" ||
    typeof row.created_at !== "string"
  ) {
    throw new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
  }
  return {
    committedAt: row.committed_at,
    createdAt: row.created_at,
    id: row.id,
    managementCompanyId: row.management_company_id,
    originalDeletedAt: row.original_deleted_at,
    rowCount: row.row_count,
    siteId: row.site_id,
    status: row.status,
    tenantId: row.tenant_id,
    version: row.version,
  };
}

function mapReadModel(value: unknown): QrInventoryAssignmentReadModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
  }
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.assets) || !Array.isArray(row.batches) || !Array.isArray(row.imports)) {
    throw new QrInventoryAssignmentRepositoryError("UNAVAILABLE");
  }
  return {
    assets: row.assets.map(mapAsset),
    batches: row.batches.map(mapBatch),
    imports: row.imports.map(mapImport),
  };
}

export function createSupabaseQrInventoryAssignmentRepository(
  client: AdminServerClient,
): QrInventoryAssignmentRepository {
  return {
    async advanceBatchDelivery(input) {
      return assertCommandResult(
        "advance_batch_delivery",
        await client.rpc("advance_qr_batch_delivery_as_admin", {
          p_batch_id: input.batchId,
          p_expected_version: input.expectedBatchVersion,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
          p_target_status: input.targetStatus,
        }),
      );
    },
    async assign(input) {
      return assertCommandResult(
        "assign",
        await client.rpc("assign_qr_asset", {
          p_expected_version: input.expectedAssetVersion,
          p_plate_ciphertext: input.plate.ciphertext,
          p_plate_key_version: input.plate.keyVersion,
          p_plate_last4: input.plate.last4,
          p_plate_lookup_hash: input.plate.lookupHash,
          p_qr_asset_id: input.qrAssetId,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async commitImport(input) {
      return assertCommandResult(
        "commit_import",
        await client.rpc("commit_vehicle_import", {
          p_expected_version: input.expectedImportVersion,
          p_import_id: input.importId,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async list() {
      const result = await client.rpc("list_phase_4_inventory_read_model");
      if (result.error) {
        logger.error("admin.qr_inventory_assignment.query_failed", {
          errorCode: result.error.code,
        });
        throw mapError(result.error);
      }
      return mapReadModel(result.data);
    },
    async receiveBatch(input) {
      return assertCommandResult(
        "receive_batch",
        await client.rpc("receive_qr_batch", {
          p_batch_id: input.batchId,
          p_expected_version: input.expectedBatchVersion,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async receiveBatchQuantity(input) {
      return assertCommandResult(
        "receive_batch_quantity",
        await client.rpc("receive_qr_batch_quantity", {
          p_batch_id: input.batchId,
          p_expected_version: input.expectedBatchVersion,
          p_received_quantity: input.receivedQuantity,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async replace(input) {
      return assertCommandResult(
        "replace",
        await client.rpc("replace_qr_asset", {
          p_expected_replacement_version: input.expectedReplacementVersion,
          p_expected_source_version: input.expectedSourceVersion,
          p_reason: input.reason,
          p_replacement_qr_asset_id: input.replacementQrAssetId,
          p_request_id: input.auditRequestId,
          p_source_qr_asset_id: input.sourceQrAssetId,
        }),
      );
    },
    async revoke(input) {
      return assertCommandResult(
        "revoke",
        await client.rpc("revoke_qr_asset", {
          p_expected_version: input.expectedAssetVersion,
          p_qr_asset_id: input.qrAssetId,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async saveValidatedImport(input) {
      return assertCommandResult(
        "save_validated_import",
        await client.rpc("save_validated_vehicle_import", {
          p_idempotency_key: input.idempotencyKey,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
          p_rows: input.validRows.map((row) => ({
            plate_ciphertext: row.plate.ciphertext,
            plate_key_version: row.plate.keyVersion,
            plate_last4: row.plate.last4,
            plate_lookup_hash: row.plate.lookupHash,
            qr_human_code: row.qrHumanCode,
            row_number: row.rowNumber,
          })),
          p_site_id: input.siteId,
          p_source_checksum_sha256: input.sourceChecksumSha256,
        }),
      );
    },
  };
}
