import "server-only";

import { createHash } from "node:crypto";
import { QrSvgBundleError, type QrSvgBundleRepository } from "@taptolk/application";
import { buildSvgExportBundleFromPrintBundle } from "@taptolk/qr-engine";
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

type PrintExportRow = {
  byte_size: number;
  checksum_sha256: string;
  storage_path: string;
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

function isPrintExportRow(value: unknown): value is PrintExportRow {
  const candidate = value as Partial<PrintExportRow> | null;
  return (
    Boolean(candidate) &&
    typeof candidate?.byte_size === "number" &&
    typeof candidate?.checksum_sha256 === "string" &&
    typeof candidate.storage_path === "string"
  );
}

async function readArtifact(
  serviceClient: AdminServiceClient,
  path: string,
  checksumSha256: string,
  byteSize: number,
): Promise<Uint8Array> {
  const result = await serviceClient.storage.from("qr-artifacts").download(path);
  if (result.error) {
    throw new QrSvgBundleError("NOT_READY");
  }
  const bytes = new Uint8Array(await result.data.arrayBuffer());
  const actualChecksum = createHash("sha256").update(bytes).digest("hex");
  if (actualChecksum !== checksumSha256) {
    throw new QrSvgBundleError("NOT_READY");
  }
  if (bytes.byteLength !== byteSize) {
    throw new QrSvgBundleError("NOT_READY");
  }
  return bytes;
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
      const exportResult = await serviceClient
        .from("print_exports")
        .select("storage_path, checksum_sha256, byte_size")
        .eq("qr_batch_id", batch.id)
        .eq("export_type", "ZIP")
        .eq("status", "READY")
        .order("export_revision", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (exportResult.error || !isPrintExportRow(exportResult.data)) {
        throw new QrSvgBundleError("NOT_READY");
      }
      const printBundleBytes = await readArtifact(
        serviceClient,
        exportResult.data.storage_path,
        exportResult.data.checksum_sha256,
        exportResult.data.byte_size,
      );
      let artifact: ReturnType<typeof buildSvgExportBundleFromPrintBundle>;
      try {
        artifact = buildSvgExportBundleFromPrintBundle(batch.batch_code, printBundleBytes);
      } catch {
        throw new QrSvgBundleError("NOT_READY");
      }
      return {
        bytes: artifact.bytes,
        checksumSha256: artifact.checksumSha256,
        filename: artifact.filename,
        mimeType: "application/zip",
      };
    },
  };
}
