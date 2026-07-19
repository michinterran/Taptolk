import "server-only";

import type {
  QrBatchItem,
  QrBatchSampleItem,
  QrBatchSampleStatus,
  QrBatchStatus,
  QrInventoryBrandAssetOption,
  QrInventoryCommandResult,
  QrInventorySampleRepository,
  QrInventorySiteOption,
  QrSampleMimeType,
  StickerDesignStatus,
  StickerDesignVersionItem,
} from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export class QrInventorySampleRepositoryError extends Error {
  readonly code: "BLOCKED" | "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE";

  constructor(code: QrInventorySampleRepositoryError["code"]) {
    super(`QR inventory sample repository failed: ${code}`);
    this.name = "QrInventorySampleRepositoryError";
    this.code = code;
  }
}

const logger = createLogger({ service: "taptolk-web" });

function relation(value: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : null;
}

function isDesignStatus(value: unknown): value is StickerDesignStatus {
  return value === "DRAFT" || value === "APPROVED" || value === "ARCHIVED";
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

function isMimeType(value: unknown): value is QrSampleMimeType {
  return value === "image/png" || value === "image/svg+xml" || value === "application/pdf";
}

function isOrganizationStatus(value: unknown): value is "ACTIVE" | "CLOSED" | "SUSPENDED" {
  return value === "ACTIVE" || value === "CLOSED" || value === "SUSPENDED";
}

function mapDesign(row: unknown): StickerDesignVersionItem {
  if (!row || typeof row !== "object") {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  const candidate = row as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    typeof candidate.management_company_id !== "string" ||
    typeof candidate.site_id !== "string" ||
    typeof candidate.template_code !== "string" ||
    !candidate.design_config ||
    typeof candidate.design_config !== "object" ||
    Array.isArray(candidate.design_config) ||
    typeof candidate.created_by_current_actor !== "boolean" ||
    (candidate.approved_at !== null && typeof candidate.approved_at !== "string") ||
    typeof candidate.created_at !== "string" ||
    typeof candidate.version !== "number" ||
    typeof candidate.site_name !== "string" ||
    !isDesignStatus(candidate.status)
  ) {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  return {
    approvedAt: candidate.approved_at,
    createdAt: candidate.created_at,
    createdByCurrentActor: candidate.created_by_current_actor,
    designConfig: candidate.design_config as Readonly<Record<string, unknown>>,
    id: candidate.id,
    managementCompanyId: candidate.management_company_id,
    siteId: candidate.site_id,
    siteName: candidate.site_name,
    status: candidate.status,
    templateCode: candidate.template_code,
    tenantId: candidate.tenant_id,
    version: candidate.version,
  };
}

function mapSample(row: unknown): QrBatchSampleItem {
  if (!row || typeof row !== "object") {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  const candidate = row as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.byte_size !== "number" ||
    typeof candidate.decode_passed !== "boolean" ||
    typeof candidate.quiet_zone_passed !== "boolean" ||
    typeof candidate.contrast_passed !== "boolean" ||
    typeof candidate.created_at !== "string" ||
    typeof candidate.version !== "number" ||
    !isMimeType(candidate.mime_type) ||
    !isSampleStatus(candidate.status)
  ) {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  return {
    byteSize: candidate.byte_size,
    contrastPassed: candidate.contrast_passed,
    createdAt: candidate.created_at,
    decodePassed: candidate.decode_passed,
    id: candidate.id,
    mimeType: candidate.mime_type,
    quietZonePassed: candidate.quiet_zone_passed,
    status: candidate.status,
    version: candidate.version,
  };
}

function mapBatch(row: unknown): QrBatchItem {
  if (!row || typeof row !== "object") {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  const candidate = row as Record<string, unknown>;
  const sample = candidate.sample;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    typeof candidate.management_company_id !== "string" ||
    typeof candidate.site_id !== "string" ||
    typeof candidate.batch_code !== "string" ||
    typeof candidate.sticker_design_version_id !== "string" ||
    typeof candidate.requested_quantity !== "number" ||
    typeof candidate.purpose !== "string" ||
    typeof candidate.requested_by_current_actor !== "boolean" ||
    typeof candidate.created_at !== "string" ||
    typeof candidate.version !== "number" ||
    typeof candidate.site_name !== "string" ||
    typeof candidate.template_code !== "string" ||
    !isBatchStatus(candidate.status) ||
    (sample !== null && (typeof sample !== "object" || Array.isArray(sample)))
  ) {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  return {
    batchCode: candidate.batch_code,
    createdAt: candidate.created_at,
    id: candidate.id,
    managementCompanyId: candidate.management_company_id,
    purpose: candidate.purpose,
    requestedByCurrentActor: candidate.requested_by_current_actor,
    requestedQuantity: candidate.requested_quantity,
    sample: sample ? mapSample(sample) : null,
    siteId: candidate.site_id,
    siteName: candidate.site_name,
    status: candidate.status,
    stickerDesignVersionId: candidate.sticker_design_version_id,
    templateCode: candidate.template_code,
    tenantId: candidate.tenant_id,
    version: candidate.version,
  };
}

function mapSite(row: unknown): QrInventorySiteOption {
  if (!row || typeof row !== "object") {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  const candidate = row as Record<string, unknown>;
  const company = relation(candidate.management_companies);
  const tenant = relation(company?.tenants);
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    typeof candidate.management_company_id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.version !== "number" ||
    typeof company?.name !== "string" ||
    typeof tenant?.name !== "string" ||
    !isOrganizationStatus(candidate.status)
  ) {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  return {
    id: candidate.id,
    managementCompanyId: candidate.management_company_id,
    managementCompanyName: company.name,
    name: candidate.name,
    status: candidate.status,
    tenantId: candidate.tenant_id,
    tenantName: tenant.name,
    version: candidate.version,
  };
}

function mapBrandAsset(row: unknown): QrInventoryBrandAssetOption {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  const candidate = row as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.tenant_id !== "string" ||
    typeof candidate.management_company_id !== "string" ||
    typeof candidate.site_id !== "string" ||
    typeof candidate.name !== "string" ||
    (candidate.mime_type !== "image/png" && candidate.mime_type !== "image/svg+xml")
  ) {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  return {
    id: candidate.id,
    managementCompanyId: candidate.management_company_id,
    mimeType: candidate.mime_type,
    name: candidate.name,
    siteId: candidate.site_id,
    tenantId: candidate.tenant_id,
  };
}

function readCommandResult(value: unknown): QrInventoryCommandResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.resourceId !== "string" ||
    typeof candidate.version !== "number" ||
    (candidate.relatedResourceId !== null && typeof candidate.relatedResourceId !== "string") ||
    (candidate.relatedVersion !== null && typeof candidate.relatedVersion !== "number")
  ) {
    return null;
  }
  return {
    relatedResourceId: candidate.relatedResourceId,
    relatedVersion: candidate.relatedVersion,
    resourceId: candidate.resourceId,
    version: candidate.version,
  };
}

function readInventoryResult(value: unknown): {
  batches: readonly QrBatchItem[];
  designs: readonly StickerDesignVersionItem[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.designs) || !Array.isArray(candidate.batches)) {
    throw new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  return {
    batches: candidate.batches.map(mapBatch),
    designs: candidate.designs.map(mapDesign),
  };
}

function mapError(error: { code?: string; message?: string }): QrInventorySampleRepositoryError {
  const message = error.message ?? "";
  if (
    message.includes("PARENT_NOT_ACTIVE") ||
    message.includes("DESIGN_NOT_APPROVED") ||
    message.includes("DESIGN_IN_USE") ||
    message.includes("SAMPLE_QA_REQUIRED")
  ) {
    return new QrInventorySampleRepositoryError("BLOCKED");
  }
  if (
    error.code === "23505" ||
    error.code === "40001" ||
    message.includes("VERSION_CONFLICT") ||
    message.includes("TERMINAL") ||
    message.includes("TRANSITION") ||
    message.includes("EXISTS") ||
    message.includes("IDEMPOTENCY")
  ) {
    return new QrInventorySampleRepositoryError("CONFLICT");
  }
  if (error.code === "42501") {
    return new QrInventorySampleRepositoryError("FORBIDDEN");
  }
  return new QrInventorySampleRepositoryError("UNAVAILABLE");
}

function assertCommandResult(
  operation: string,
  result: { data: unknown; error: { code?: string; message?: string } | null },
): QrInventoryCommandResult {
  const value = readCommandResult(result.data);
  if (result.error || !value) {
    logger.error("admin.qr_inventory.command_failed", {
      errorCode: result.error?.code ?? null,
      operation,
    });
    throw result.error
      ? mapError(result.error)
      : new QrInventorySampleRepositoryError("UNAVAILABLE");
  }
  return value;
}

export function createSupabaseQrInventorySampleRepository(
  client: AdminServerClient,
): QrInventorySampleRepository {
  return {
    async approveDesign(input) {
      return assertCommandResult(
        "approve_design",
        await client.rpc("approve_sticker_design_version", {
          p_design_id: input.designId,
          p_expected_version: input.expectedVersion,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async approveSample(input) {
      return assertCommandResult(
        "approve_sample",
        await client.rpc("approve_qr_batch_sample", {
          p_batch_id: input.batchId,
          p_expected_batch_version: input.expectedBatchVersion,
          p_expected_sample_version: input.expectedSampleVersion,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
          p_sample_id: input.sampleId,
        }),
      );
    },
    async archiveDesign(input) {
      return assertCommandResult(
        "archive_design",
        await client.rpc("archive_sticker_design_version", {
          p_design_id: input.designId,
          p_expected_version: input.expectedVersion,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async attachSample(input) {
      return assertCommandResult(
        "attach_sample",
        await client.rpc("attach_qr_batch_sample", {
          p_batch_id: input.batchId,
          p_byte_size: input.byteSize,
          p_checksum_sha256: input.checksumSha256,
          p_contrast_passed: input.contrastPassed,
          p_decode_passed: input.decodePassed,
          p_expected_batch_version: input.expectedBatchVersion,
          p_mime_type: input.mimeType,
          p_quiet_zone_passed: input.quietZonePassed,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
          p_storage_bucket: input.storageBucket,
          p_storage_path: input.storagePath,
        }),
      );
    },
    async cancelBatch(input) {
      return assertCommandResult(
        "cancel_batch",
        await client.rpc("cancel_qr_batch", {
          p_batch_id: input.batchId,
          p_expected_batch_version: input.expectedBatchVersion,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
        }),
      );
    },
    async createDesign(input) {
      return assertCommandResult(
        "create_design",
        await client.rpc("create_sticker_design_version", {
          p_design_config: input.designConfig,
          p_expected_site_version: input.expectedSiteVersion,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
          p_site_id: input.siteId,
          p_template_code: input.templateCode,
        }),
      );
    },
    async invalidateSample(input) {
      return assertCommandResult(
        "invalidate_sample",
        await client.rpc("invalidate_qr_batch_sample", {
          p_batch_id: input.batchId,
          p_expected_batch_version: input.expectedBatchVersion,
          p_expected_sample_version: input.expectedSampleVersion,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
          p_sample_id: input.sampleId,
        }),
      );
    },
    async list() {
      const [inventoryResult, siteResult, brandAssetResult] = await Promise.all([
        client.rpc("list_qr_inventory_sample_read_model"),
        client
          .from("sites")
          .select(
            "id, tenant_id, management_company_id, name, status, version, management_companies!inner(name, tenants!inner(name))",
          )
          .is("deleted_at", null)
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .limit(100),
        client
          .from("brand_assets")
          .select("id, tenant_id, management_company_id, site_id, name, mime_type")
          .eq("asset_type", "SITE_LOGO")
          .eq("status", "ACTIVE")
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .limit(100),
      ]);
      const failed = [inventoryResult.error, siteResult.error, brandAssetResult.error].find(
        Boolean,
      );
      if (failed) {
        logger.error("admin.qr_inventory.query_failed", { errorCode: failed.code });
        throw new QrInventorySampleRepositoryError("UNAVAILABLE");
      }
      const inventory = readInventoryResult(inventoryResult.data);
      return {
        batches: inventory.batches,
        brandAssets: (brandAssetResult.data ?? []).map(mapBrandAsset),
        designs: inventory.designs,
        sites: (siteResult.data ?? []).map(mapSite),
      };
    },
    async requestBatch(input) {
      return assertCommandResult(
        "request_batch",
        await client.rpc("request_qr_batch", {
          p_expected_design_version: input.expectedDesignVersion,
          p_expected_site_version: input.expectedSiteVersion,
          p_idempotency_key: input.idempotencyKey,
          p_purpose: input.purpose,
          p_quantity: input.quantity,
          p_reason: input.reason,
          p_request_id: input.auditRequestId,
          p_site_id: input.siteId,
          p_sticker_design_version_id: input.stickerDesignVersionId,
        }),
      );
    },
  };
}
