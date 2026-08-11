import "server-only";

import { createHash } from "node:crypto";
import { QrSvgBundleError, type QrSvgBundleRepository } from "@taptolk/application";
import { buildSvgExportBundle } from "@taptolk/qr-engine";
import type { createAdminServerClient } from "../auth/server-client";
import type { createAdminServiceClient } from "../auth/service-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;
type AdminServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;

type BatchRow = {
  batch_code: string;
  id: string;
  requested_quantity: number;
  site_id: string;
  tenant_id: string;
};

type GenerationJobRow = {
  generation_revision: number;
  id: string;
};

type GenerationItemRow = {
  ordinal: number;
  qr_asset_id: string;
};

type AssetRow = {
  human_code: string;
  id: string;
};

type RenderedAssetRow = {
  checksum_sha256: string;
  print_svg_path: string;
  qr_asset_id: string;
};

function isBatchRow(value: unknown): value is BatchRow {
  const candidate = value as Partial<BatchRow> | null;
  return (
    Boolean(candidate) &&
    typeof candidate?.batch_code === "string" &&
    typeof candidate.id === "string" &&
    typeof candidate.requested_quantity === "number" &&
    typeof candidate.site_id === "string" &&
    typeof candidate.tenant_id === "string"
  );
}

function isGenerationJobRow(value: unknown): value is GenerationJobRow {
  const candidate = value as Partial<GenerationJobRow> | null;
  return (
    Boolean(candidate) &&
    typeof candidate?.generation_revision === "number" &&
    typeof candidate.id === "string"
  );
}

function isGenerationItemRow(value: unknown): value is GenerationItemRow {
  const candidate = value as Partial<GenerationItemRow> | null;
  return (
    Boolean(candidate) &&
    typeof candidate?.ordinal === "number" &&
    typeof candidate.qr_asset_id === "string"
  );
}

function isAssetRow(value: unknown): value is AssetRow {
  const candidate = value as Partial<AssetRow> | null;
  return (
    Boolean(candidate) &&
    typeof candidate?.human_code === "string" &&
    typeof candidate.id === "string"
  );
}

function isRenderedAssetRow(value: unknown): value is RenderedAssetRow {
  const candidate = value as Partial<RenderedAssetRow> | null;
  return (
    Boolean(candidate) &&
    typeof candidate?.checksum_sha256 === "string" &&
    typeof candidate.print_svg_path === "string" &&
    typeof candidate.qr_asset_id === "string"
  );
}

function assertRows<T>(rows: unknown, predicate: (value: unknown) => value is T): readonly T[] {
  if (!Array.isArray(rows) || !rows.every(predicate)) {
    throw new QrSvgBundleError("NOT_READY");
  }
  return rows;
}

async function readSvg(
  serviceClient: AdminServiceClient,
  path: string,
  checksumSha256: string,
): Promise<string> {
  const result = await serviceClient.storage.from("qr-artifacts").download(path);
  if (result.error) {
    throw new QrSvgBundleError("NOT_READY");
  }
  const bytes = new Uint8Array(await result.data.arrayBuffer());
  const actualChecksum = createHash("sha256").update(bytes).digest("hex");
  if (actualChecksum !== checksumSha256) {
    throw new QrSvgBundleError("NOT_READY");
  }
  return new TextDecoder().decode(bytes);
}

export function createSupabaseQrSvgBundleRepository(
  userClient: AdminServerClient,
  serviceClient: AdminServiceClient,
): QrSvgBundleRepository {
  return {
    async get(batchId) {
      const batchResult = await userClient
        .from("qr_batches")
        .select("id, tenant_id, site_id, batch_code, requested_quantity")
        .eq("id", batchId)
        .maybeSingle();
      if (batchResult.error || !isBatchRow(batchResult.data)) {
        throw new QrSvgBundleError("NOT_READY");
      }
      const batch = batchResult.data;
      const jobResult = await serviceClient
        .from("qr_generation_jobs")
        .select("id, generation_revision")
        .eq("qr_batch_id", batch.id)
        .eq("status", "COMPLETED")
        .order("generation_revision", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (jobResult.error || !isGenerationJobRow(jobResult.data)) {
        throw new QrSvgBundleError("NOT_READY");
      }
      const itemResult = await serviceClient
        .from("qr_generation_items")
        .select("ordinal, qr_asset_id")
        .eq("generation_job_id", jobResult.data.id)
        .order("ordinal", { ascending: true });
      const items = assertRows(itemResult.data, isGenerationItemRow);
      if (itemResult.error || items.length !== batch.requested_quantity) {
        throw new QrSvgBundleError("NOT_READY");
      }
      const assetIds = items.map((item) => item.qr_asset_id);
      const [assetResult, renderedResult] = await Promise.all([
        serviceClient.from("qr_assets").select("id, human_code").in("id", assetIds),
        serviceClient
          .from("rendered_assets")
          .select("qr_asset_id, print_svg_path, checksum_sha256")
          .eq("tenant_id", batch.tenant_id)
          .eq("site_id", batch.site_id)
          .eq("render_version", jobResult.data.generation_revision)
          .eq("quality_status", "PASSED")
          .in("qr_asset_id", assetIds),
      ]);
      if (assetResult.error || renderedResult.error) {
        throw new QrSvgBundleError("NOT_READY");
      }
      const assetsById = new Map(
        assertRows(assetResult.data, isAssetRow).map((row) => [row.id, row]),
      );
      const renderedByAssetId = new Map(
        assertRows(renderedResult.data, isRenderedAssetRow).map((row) => [row.qr_asset_id, row]),
      );
      const exportItems = await Promise.all(
        items.map(async (item) => {
          const asset = assetsById.get(item.qr_asset_id);
          const rendered = renderedByAssetId.get(item.qr_asset_id);
          if (!asset || !rendered) {
            throw new QrSvgBundleError("NOT_READY");
          }
          return {
            humanCode: asset.human_code,
            ordinal: item.ordinal,
            printSvg: await readSvg(
              serviceClient,
              rendered.print_svg_path,
              rendered.checksum_sha256,
            ),
            renderChecksumSha256: rendered.checksum_sha256,
          };
        }),
      );
      const artifact = buildSvgExportBundle(batch.batch_code, exportItems);
      return {
        bytes: artifact.bytes,
        checksumSha256: artifact.checksumSha256,
        filename: artifact.filename,
        mimeType: "application/zip",
      };
    },
  };
}
