import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { inspectBrandAsset } from "@taptolk/qr-engine";
import { assertAdminAuthorized } from "./authorization-error.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type CustomerBrandAssetType = "MANAGEMENT_COMPANY_LOGO" | "SITE_LOGO";

export interface BrandAssetActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface BrandAssetCommandResult {
  resourceId: string;
  storagePath: string;
  version: number;
}

export interface BrandAssetRepository {
  uploadAndRegister(input: {
    assetType: CustomerBrandAssetType;
    auditRequestId: string;
    bytes: Uint8Array;
    checksumSha256: string;
    filename: string;
    heightPx: number;
    managementCompanyId: string;
    mimeType: "image/png" | "image/svg+xml";
    name: string;
    reason: string;
    siteId: string | null;
    storagePath: string;
    tenantId: string;
    widthPx: number;
  }): Promise<BrandAssetCommandResult>;
}

export class BrandAssetError extends Error {
  constructor(
    readonly code:
      | "INVALID_ASSET_TYPE"
      | "INVALID_ID"
      | "INVALID_NAME"
      | "INVALID_REASON"
      | "SITE_REQUIRED",
  ) {
    super(`Brand asset command rejected: ${code}`);
    this.name = "BrandAssetError";
  }
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BrandAssetError("INVALID_ID");
  }
}

function normalizeText(
  value: string,
  minimum: number,
  maximum: number,
  code: BrandAssetError["code"],
) {
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new BrandAssetError(code);
  }
  return normalized;
}

export class BrandAssetService {
  constructor(private readonly repository: BrandAssetRepository) {}

  async upload(input: {
    actor: BrandAssetActor;
    assetType: CustomerBrandAssetType;
    auditRequestId: string;
    bytes: Uint8Array;
    filename: string;
    managementCompanyId: string;
    mimeType: string;
    name: string;
    reason: string;
    siteId?: string;
    tenantId: string;
  }): Promise<BrandAssetCommandResult> {
    assertUuid(input.actor.userId);
    assertUuid(input.auditRequestId);
    assertUuid(input.tenantId);
    assertUuid(input.managementCompanyId);
    if (input.siteId) {
      assertUuid(input.siteId);
    }
    if (input.assetType === "SITE_LOGO" && !input.siteId) {
      throw new BrandAssetError("SITE_REQUIRED");
    }
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "sticker-design:create", {
        managementCompanyId: input.managementCompanyId,
        ...(input.siteId ? { siteId: input.siteId } : {}),
        tenantId: input.tenantId,
      }),
    );
    const name = normalizeText(input.name, 1, 200, "INVALID_NAME");
    const reason = normalizeText(input.reason, 3, 500, "INVALID_REASON");
    const inspected = await inspectBrandAsset({
      bytes: input.bytes,
      filename: input.filename,
      mimeType: input.mimeType,
    });
    const storagePath = `${input.tenantId}/${crypto.randomUUID()}${inspected.extension}`;
    return this.repository.uploadAndRegister({
      assetType: input.assetType,
      auditRequestId: input.auditRequestId,
      bytes: inspected.bytes,
      checksumSha256: inspected.checksumSha256,
      filename: input.filename,
      heightPx: inspected.heightPx,
      managementCompanyId: input.managementCompanyId,
      mimeType: inspected.mimeType,
      name,
      reason,
      siteId: input.siteId ?? null,
      storagePath,
      tenantId: input.tenantId,
      widthPx: inspected.widthPx,
    });
  }
}
