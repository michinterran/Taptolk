"use server";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AdminAuthorizationError,
  QrInventorySampleError,
  QrInventorySampleService,
  STICKER_TEMPLATE_CODES,
  type StickerTemplateCode,
} from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { renderSticker } from "@taptolk/qr-engine";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { getLocalizedAdminPath } from "../auth/admin-routing";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import { createAdminServiceClient } from "../auth/service-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  createSupabaseQrInventorySampleRepository,
  QrInventorySampleRepositoryError,
} from "./supabase-qr-inventory-sample-repository";

type ActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";
type ActionStatus =
  | "batchCancelled"
  | "batchRequested"
  | "designApproved"
  | "designArchived"
  | "designCreated"
  | "sampleGenerated"
  | "sampleApproved"
  | "sampleAttached"
  | "sampleInvalidated";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function readLocale(formData: FormData): AppLocale {
  const value = readString(formData, "locale");
  return isAppLocale(value) ? value : "en";
}

function path(
  locale: AppLocale,
  kind: "error" | "status",
  value: ActionError | ActionStatus,
): Route {
  return getLocalizedAdminPath(locale, `/qr-inventory?${kind}=${value}`) as Route;
}

function mapError(error: unknown): ActionError {
  if (error instanceof AdminAuthorizationError) {
    return "forbidden";
  }
  if (error instanceof QrInventorySampleError) {
    return error.code === "SELF_REVIEW_FORBIDDEN" || error.code === "REQUESTER_REQUIRED"
      ? "forbidden"
      : error.code === "QA_REQUIRED"
        ? "blocked"
        : "validation";
  }
  if (error instanceof QrInventorySampleRepositoryError) {
    return error.code === "BLOCKED"
      ? "blocked"
      : error.code === "CONFLICT"
        ? "conflict"
        : error.code === "FORBIDDEN"
          ? "forbidden"
          : "unavailable";
  }
  return "unavailable";
}

async function commandContext(locale: AppLocale) {
  const admin = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    redirect(path(locale, "error", "unavailable"));
  }
  return {
    actor: {
      authorization: toAdminAuthorizationContext(
        admin.decision.membership,
        admin.mfaLevel === "aal2",
      ),
      userId: admin.userId,
    },
    client,
    service: new QrInventorySampleService(createSupabaseQrInventorySampleRepository(client)),
  };
}

function resourceScope(formData: FormData) {
  return {
    managementCompanyId: readString(formData, "managementCompanyId"),
    siteId: readString(formData, "siteId"),
    tenantId: readString(formData, "tenantId"),
  };
}

function siteScope(formData: FormData) {
  const [tenantId = "", managementCompanyId = "", siteId = "", version = "", status = ""] =
    readString(formData, "siteScope").split("|");
  return {
    expectedSiteVersion: Number(version),
    managementCompanyId,
    siteId,
    siteStatus: status as "ACTIVE" | "CLOSED" | "SUSPENDED",
    tenantId,
  };
}

function buildDesignConfig(formData: FormData, siteId: string): string {
  const selected = readString(formData, "brandAssetId");
  let brandAssetId: string | null = null;
  if (selected) {
    const [, , assetSiteId = "", assetId = ""] = selected.split("|");
    if (assetSiteId !== siteId) {
      throw new QrInventorySampleError("INVALID_DESIGN_CONFIG");
    }
    brandAssetId = assetId;
  }
  return JSON.stringify({
    brandAssetId,
    qrOptions: { errorCorrectionLevel: "H", marginModules: 4 },
    schemaVersion: 1,
    zones: {
      customerLogo: "OPTIONAL_TOP",
      qr: "CENTER_WHITE_PLATE",
      taptolkLogo: "IMMUTABLE_BOTTOM",
    },
  });
}

function designReviewInput(formData: FormData) {
  return {
    auditRequestId: crypto.randomUUID(),
    createdByCurrentActor: readBoolean(formData, "createdByCurrentActor"),
    designId: readString(formData, "designId"),
    expectedVersion: Number(readString(formData, "expectedVersion")),
    reason: readString(formData, "reason"),
    status: readString(formData, "designStatus") as "APPROVED" | "ARCHIVED" | "DRAFT",
    ...resourceScope(formData),
  };
}

function batchInput(formData: FormData) {
  return {
    batchId: readString(formData, "batchId"),
    batchStatus: readString(formData, "batchStatus") as
      | "CANCELLED"
      | "DRAFT"
      | "SAMPLE_APPROVED"
      | "SAMPLE_READY",
    expectedBatchVersion: Number(readString(formData, "expectedBatchVersion")),
    ...resourceScope(formData),
  };
}

function sampleInput(formData: FormData) {
  return {
    ...batchInput(formData),
    expectedSampleVersion: Number(readString(formData, "expectedSampleVersion")),
    sampleId: readString(formData, "sampleId"),
    sampleStatus: readString(formData, "sampleStatus") as "APPROVED" | "INVALIDATED" | "READY",
  };
}

async function run(
  formData: FormData,
  status: ActionStatus,
  command: (
    context: Awaited<ReturnType<typeof commandContext>>,
    locale: AppLocale,
  ) => Promise<unknown>,
): Promise<never> {
  const locale = readLocale(formData);
  try {
    await command(await commandContext(locale), locale);
  } catch (error) {
    redirect(path(locale, "error", mapError(error)));
  }
  redirect(path(locale, "status", status));
}

export async function createStickerDesignVersion(formData: FormData): Promise<never> {
  return run(formData, "designCreated", async ({ actor, service }) => {
    const scope = siteScope(formData);
    await service.createDesign({
      actor,
      auditRequestId: crypto.randomUUID(),
      designConfig: buildDesignConfig(formData, scope.siteId),
      reason: readString(formData, "reason"),
      templateCode: readString(formData, "templateCode"),
      ...scope,
    });
  });
}

export async function approveStickerDesignVersion(formData: FormData): Promise<never> {
  return run(formData, "designApproved", async ({ actor, service }) => {
    await service.approveDesign({ actor, ...designReviewInput(formData) });
  });
}

export async function archiveStickerDesignVersion(formData: FormData): Promise<never> {
  return run(formData, "designArchived", async ({ actor, service }) => {
    const input = designReviewInput(formData);
    await service.archiveDesign({
      actor,
      auditRequestId: input.auditRequestId,
      designId: input.designId,
      expectedVersion: input.expectedVersion,
      managementCompanyId: input.managementCompanyId,
      reason: input.reason,
      siteId: input.siteId,
      status: input.status,
      tenantId: input.tenantId,
    });
  });
}

export async function requestQrBatch(formData: FormData): Promise<never> {
  return run(formData, "batchRequested", async ({ actor, service }) => {
    await service.requestBatch({
      actor,
      auditRequestId: crypto.randomUUID(),
      designStatus: readString(formData, "designStatus") as "APPROVED",
      expectedDesignVersion: Number(readString(formData, "expectedDesignVersion")),
      expectedSiteVersion: Number(readString(formData, "expectedSiteVersion")),
      idempotencyKey: crypto.randomUUID(),
      purpose: readString(formData, "purpose"),
      quantity: Number(readString(formData, "quantity")),
      reason: readString(formData, "reason"),
      siteStatus: readString(formData, "siteStatus") as "ACTIVE",
      stickerDesignVersionId: readString(formData, "designId"),
      ...resourceScope(formData),
    });
  });
}

export async function attachQrBatchSample(formData: FormData): Promise<never> {
  return run(formData, "sampleAttached", async ({ actor, service }) => {
    await service.attachSample({
      actor,
      auditRequestId: crypto.randomUUID(),
      byteSize: Number(readString(formData, "byteSize")),
      checksumSha256: readString(formData, "checksumSha256"),
      contrastPassed: readBoolean(formData, "contrastPassed"),
      decodePassed: readBoolean(formData, "decodePassed"),
      mimeType: readString(formData, "mimeType"),
      quietZonePassed: readBoolean(formData, "quietZonePassed"),
      reason: readString(formData, "reason"),
      storageBucket: readString(formData, "storageBucket"),
      storagePath: readString(formData, "storagePath"),
      ...batchInput(formData),
    });
  });
}

export async function generateQrBatchSample(formData: FormData): Promise<never> {
  return run(formData, "sampleGenerated", async ({ actor, client, service }) => {
    const storageClient = createAdminServiceClient();
    if (!storageClient) {
      throw new Error("SAMPLE_STORAGE_CONFIGURATION_MISSING");
    }
    const batchId = readString(formData, "batchId");
    const renderContextResult = await client.rpc("get_qr_sample_render_context", {
      p_batch_id: batchId,
    });
    if (
      renderContextResult.error ||
      !renderContextResult.data ||
      typeof renderContextResult.data !== "object" ||
      Array.isArray(renderContextResult.data)
    ) {
      throw new QrInventorySampleRepositoryError("BLOCKED");
    }
    const renderContext = renderContextResult.data as Record<string, unknown>;
    const templateCode = renderContext.template_code;
    const tenantId = renderContext.tenant_id;
    const brandAsset = renderContext.brand_asset;
    if (
      typeof tenantId !== "string" ||
      tenantId !== readString(formData, "tenantId") ||
      !STICKER_TEMPLATE_CODES.some((candidate) => candidate === templateCode) ||
      (brandAsset !== null &&
        (!brandAsset || typeof brandAsset !== "object" || Array.isArray(brandAsset)))
    ) {
      throw new QrInventorySampleRepositoryError("BLOCKED");
    }
    let customerLogoDataUri: string | undefined;
    if (brandAsset) {
      const asset = brandAsset as Record<string, unknown>;
      if (
        typeof asset.storage_bucket !== "string" ||
        typeof asset.storage_path !== "string" ||
        (asset.mime_type !== "image/png" && asset.mime_type !== "image/svg+xml")
      ) {
        throw new QrInventorySampleRepositoryError("BLOCKED");
      }
      const downloaded = await storageClient.storage
        .from(asset.storage_bucket)
        .download(asset.storage_path);
      if (downloaded.error) {
        throw new Error("BRAND_ASSET_DOWNLOAD_FAILED");
      }
      const bytes = Buffer.from(await downloaded.data.arrayBuffer());
      customerLogoDataUri = `data:${asset.mime_type};base64,${bytes.toString("base64")}`;
    }
    const environment = parseServerEnvironment();
    const baseUrl =
      environment.PUBLIC_QR_BASE_URL ?? environment.APP_URL ?? "https://sample.taptolk.invalid";
    const publicUrl = new URL(`/q/sample-${crypto.randomUUID()}`, baseUrl).toString();
    const logo = await readFile(join(process.cwd(), "public", "brand", "taptolk-logo.png"));
    const rendered = await renderSticker({
      ...(customerLogoDataUri ? { customerLogoDataUri } : {}),
      publicUrl,
      taptolkLogoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
      templateCode: templateCode as StickerTemplateCode,
    });
    const artifactBase = `${tenantId}/samples/${batchId}/${crypto.randomUUID()}`;
    const pngPath = `${artifactBase}.png`;
    const svgPath = `${artifactBase}.svg`;
    const uploads = await Promise.all([
      storageClient.storage.from("qr-artifacts").upload(pngPath, rendered.png, {
        cacheControl: "31536000",
        contentType: "image/png",
        upsert: false,
      }),
      storageClient.storage.from("qr-artifacts").upload(svgPath, rendered.svg, {
        cacheControl: "31536000",
        contentType: "image/svg+xml",
        upsert: false,
      }),
    ]);
    if (uploads.some((upload) => upload.error)) {
      await storageClient.storage.from("qr-artifacts").remove([pngPath, svgPath]);
      throw new Error("SAMPLE_STORAGE_UPLOAD_FAILED");
    }
    try {
      await service.attachSample({
        actor,
        auditRequestId: crypto.randomUUID(),
        byteSize: rendered.png.byteLength,
        checksumSha256: createHash("sha256").update(rendered.png).digest("hex"),
        contrastPassed: true,
        decodePassed: rendered.decodedValue === publicUrl,
        mimeType: "image/png",
        quietZonePassed: true,
        reason: readString(formData, "reason"),
        storageBucket: "qr-artifacts",
        storagePath: pngPath,
        ...batchInput(formData),
      });
    } catch (error) {
      await storageClient.storage.from("qr-artifacts").remove([pngPath, svgPath]);
      throw error;
    }
  });
}

export async function approveQrBatchSample(formData: FormData): Promise<never> {
  return run(formData, "sampleApproved", async ({ actor, service }) => {
    await service.approveSample({
      actor,
      auditRequestId: crypto.randomUUID(),
      contrastPassed: readBoolean(formData, "contrastPassed"),
      decodePassed: readBoolean(formData, "decodePassed"),
      quietZonePassed: readBoolean(formData, "quietZonePassed"),
      reason: readString(formData, "reason"),
      requestedByCurrentActor: readBoolean(formData, "requestedByCurrentActor"),
      ...sampleInput(formData),
    });
  });
}

export async function invalidateQrBatchSample(formData: FormData): Promise<never> {
  return run(formData, "sampleInvalidated", async ({ actor, service }) => {
    await service.invalidateSample({
      actor,
      auditRequestId: crypto.randomUUID(),
      reason: readString(formData, "reason"),
      ...sampleInput(formData),
    });
  });
}

export async function cancelQrBatch(formData: FormData): Promise<never> {
  return run(formData, "batchCancelled", async ({ actor, service }) => {
    await service.cancelBatch({
      actor,
      auditRequestId: crypto.randomUUID(),
      reason: readString(formData, "reason"),
      requestedByCurrentActor: readBoolean(formData, "requestedByCurrentActor"),
      ...batchInput(formData),
    });
  });
}
