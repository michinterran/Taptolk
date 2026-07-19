import "server-only";

import type { BrandAssetCommandResult, BrandAssetRepository } from "@taptolk/application";
import { createLogger } from "@taptolk/observability";
import type { createAdminServerClient } from "../auth/server-client";
import type { createAdminServiceClient } from "../auth/service-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;
type AdminServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;

const logger = createLogger({ service: "taptolk-web" });
const BRAND_ASSET_BUCKET = "brand-assets";

export class BrandAssetRepositoryError extends Error {
  constructor(readonly code: "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE") {
    super(`Brand asset repository failed: ${code}`);
    this.name = "BrandAssetRepositoryError";
  }
}

function mapError(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return new BrandAssetRepositoryError("CONFLICT");
  }
  if (error.code === "42501" || error.code === "P0002") {
    return new BrandAssetRepositoryError("FORBIDDEN");
  }
  return new BrandAssetRepositoryError("UNAVAILABLE");
}

function readResult(value: unknown): BrandAssetCommandResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.resource_id !== "string" ||
    typeof row.storage_path !== "string" ||
    typeof row.version !== "number"
  ) {
    return null;
  }
  return {
    resourceId: row.resource_id,
    storagePath: row.storage_path,
    version: row.version,
  };
}

export function createSupabaseBrandAssetRepository(
  userClient: AdminServerClient,
  serviceClient: AdminServiceClient,
): BrandAssetRepository {
  return {
    async uploadAndRegister(input) {
      const upload = await serviceClient.storage
        .from(BRAND_ASSET_BUCKET)
        .upload(input.storagePath, input.bytes, {
          cacheControl: "31536000",
          contentType: input.mimeType,
          upsert: false,
        });
      if (upload.error && !upload.error.message.toLowerCase().includes("already exists")) {
        logger.error("admin.brand_asset.storage_upload_failed", {
          errorCode: "STORAGE_UPLOAD_FAILED",
        });
        throw new BrandAssetRepositoryError("UNAVAILABLE");
      }

      const result = await userClient.rpc("register_brand_asset", {
        p_asset_type: input.assetType,
        p_byte_size: input.bytes.byteLength,
        p_checksum_sha256: input.checksumSha256,
        p_height_px: input.heightPx,
        p_management_company_id: input.managementCompanyId,
        p_mime_type: input.mimeType,
        p_name: input.name,
        p_reason: input.reason,
        p_request_id: input.auditRequestId,
        p_site_id: input.siteId,
        p_storage_bucket: BRAND_ASSET_BUCKET,
        p_storage_path: input.storagePath,
        p_tenant_id: input.tenantId,
        p_width_px: input.widthPx,
      });
      const value = readResult(result.data);
      if (result.error || !value) {
        if (!upload.error) {
          await serviceClient.storage.from(BRAND_ASSET_BUCKET).remove([input.storagePath]);
        }
        logger.error("admin.brand_asset.registration_failed", {
          errorCode: result.error?.code ?? null,
        });
        throw result.error ? mapError(result.error) : new BrandAssetRepositoryError("UNAVAILABLE");
      }
      return value;
    },
  };
}
