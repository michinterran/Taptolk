import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { createTaptolkAdminClient } from "@taptolk/auth";
import type { QrWorkerExecutionErrorCode } from "../pgmq-queue-runtime.js";
import type {
  QrGenerationArtifactStore,
  QrGenerationCommitItem,
  QrGenerationExecutionContext,
  QrGenerationExecutionRepository,
} from "./qr-generation-handler.js";
import type {
  QrPrintExportArtifactStorage,
  QrPrintExportContext,
  QrPrintExportRepository,
} from "./qr-print-export-handler.js";

type SupabaseAdminClient = ReturnType<typeof createTaptolkAdminClient>;

export class SupabaseQrGenerationRuntimeError extends Error {
  constructor(readonly code: "CONFLICT" | "UNAVAILABLE") {
    super(`Supabase QR generation runtime failed: ${code}`);
    this.name = "SupabaseQrGenerationRuntimeError";
  }
}

function assertObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
  }
  return value as Record<string, unknown>;
}

function mapContext(value: unknown): QrGenerationExecutionContext & {
  customerLogoSource?: { mimeType: "image/png" | "image/svg+xml"; path: string; bucket: string };
} {
  const row = assertObject(value);
  if (
    typeof row.job_id !== "string" ||
    typeof row.tenant_id !== "string" ||
    typeof row.site_id !== "string" ||
    typeof row.batch_id !== "string" ||
    typeof row.requested_quantity !== "number" ||
    typeof row.template_code !== "string" ||
    typeof row.generation_revision !== "number" ||
    !Array.isArray(row.completed_ordinals) ||
    typeof row.already_completed !== "boolean"
  ) {
    throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
  }
  const templateCode = row.template_code;
  const customerLogo = row.customer_logo;
  if (
    ![
      "ROUND_BLUE_HOLOGRAM_V1",
      "ROUND_PURPLE_GRADIENT_V1",
      "ROUND_WHITE_MINIMAL_V1",
      "SQUARE_DARK_PREMIUM_V1",
    ].includes(templateCode)
  ) {
    throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
  }
  let customerLogoSource:
    | { mimeType: "image/png" | "image/svg+xml"; path: string; bucket: string }
    | undefined;
  if (customerLogo !== null && customerLogo !== undefined) {
    const asset = assertObject(customerLogo);
    if (
      typeof asset.storage_bucket !== "string" ||
      typeof asset.storage_path !== "string" ||
      (asset.mime_type !== "image/png" && asset.mime_type !== "image/svg+xml")
    ) {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    customerLogoSource = {
      bucket: asset.storage_bucket,
      mimeType: asset.mime_type,
      path: asset.storage_path,
    };
  }
  return {
    alreadyCompleted: row.already_completed,
    batchId: row.batch_id,
    completedOrdinals: row.completed_ordinals.map(Number),
    ...(customerLogoSource ? { customerLogoSource } : {}),
    generationRevision: row.generation_revision,
    jobId: row.job_id,
    managementCompanyId:
      typeof row.management_company_id === "string" ? row.management_company_id : "",
    requestedQuantity: row.requested_quantity,
    siteId: row.site_id,
    stickerDesignVersionId:
      typeof row.sticker_design_version_id === "string" ? row.sticker_design_version_id : "",
    templateCode: templateCode as QrGenerationExecutionContext["templateCode"],
    tenantId: row.tenant_id,
  };
}

function mapRuntimeError(error: { code?: string; message?: string }) {
  return error.code === "23505" ||
    error.code === "40001" ||
    (error.message ?? "").includes("MISMATCH")
    ? new SupabaseQrGenerationRuntimeError("CONFLICT")
    : new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
}

function serializeItem(item: QrGenerationCommitItem) {
  return {
    activation_code_ciphertext: item.activationCodeCiphertext,
    activation_code_hash: item.activationCodeHash,
    activation_key_version: item.activationKeyVersion,
    decoded_public_token_hash: item.decodedPublicTokenHash,
    human_code: item.humanCode,
    internal_uuid: item.internalUuid,
    ordinal: item.ordinal,
    preview_png_path: item.previewPngPath,
    print_svg_path: item.printSvgPath,
    public_token_ciphertext: item.publicTokenCiphertext,
    public_token_hash: item.publicTokenHash,
    qr_asset_id: item.qrAssetId,
    render_checksum_sha256: item.renderChecksumSha256,
    token_key_version: item.tokenKeyVersion,
  };
}

export class SupabaseQrGenerationExecutionRepository implements QrGenerationExecutionRepository {
  constructor(private readonly client: SupabaseAdminClient) {}

  async start(input: {
    generationRevision: number;
    jobId: string;
  }): Promise<QrGenerationExecutionContext> {
    const result = await this.client.rpc("start_qr_generation_execution", {
      p_generation_revision: input.generationRevision,
      p_job_id: input.jobId,
    });
    if (result.error) {
      throw mapRuntimeError(result.error);
    }
    const context = mapContext(result.data);
    const batchMode = await this.client
      .from("qr_batches")
      .select("request_mode")
      .eq("id", context.batchId)
      .maybeSingle();
    if (batchMode.error) {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    const renderMode = batchMode.data?.request_mode === "ADMIN_DIRECT" ? "QR_ONLY" : "STICKER";
    if (!context.customerLogoSource) {
      return { ...context, renderMode };
    }
    const source = context.customerLogoSource;
    const download = await this.client.storage.from(source.bucket).download(source.path);
    if (download.error) {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    return {
      ...context,
      customerLogoDataUri: `data:${source.mimeType};base64,${Buffer.from(
        await download.data.arrayBuffer(),
      ).toString("base64")}`,
      renderMode,
    };
  }

  async commitChunk(input: {
    generationRevision: number;
    items: readonly QrGenerationCommitItem[];
    jobId: string;
  }): Promise<{ committedCount: number; totalCount: number }> {
    const result = await this.client.rpc("commit_qr_generation_chunk", {
      p_generation_revision: input.generationRevision,
      p_items: input.items.map(serializeItem),
      p_job_id: input.jobId,
    });
    if (result.error) {
      throw mapRuntimeError(result.error);
    }
    const row = assertObject(result.data);
    if (typeof row.committed_count !== "number" || typeof row.total_count !== "number") {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    return { committedCount: row.committed_count, totalCount: row.total_count };
  }

  async complete(input: {
    generationRevision: number;
    jobId: string;
  }): Promise<{ completedCount: number }> {
    const result = await this.client.rpc("complete_qr_generation_execution", {
      p_generation_revision: input.generationRevision,
      p_job_id: input.jobId,
    });
    if (result.error) {
      throw mapRuntimeError(result.error);
    }
    const row = assertObject(result.data);
    if (typeof row.completed_count !== "number") {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    return { completedCount: row.completed_count };
  }
}

export class SupabaseQrGenerationArtifactStore implements QrGenerationArtifactStore {
  constructor(
    private readonly client: SupabaseAdminClient,
    private readonly bucket = "qr-artifacts",
  ) {}

  async store(input: {
    batchId: string;
    generationRevision: number;
    ordinal: number;
    png: Uint8Array;
    svg: string;
    tenantId: string;
  }) {
    const prefix = `${input.tenantId}/batches/${input.batchId}/generation-${input.generationRevision}`;
    const ordinal = input.ordinal.toString().padStart(5, "0");
    const previewPngPath = `${prefix}/${ordinal}.png`;
    const printSvgPath = `${prefix}/${ordinal}.svg`;
    const [pngUpload, svgUpload] = await Promise.all([
      this.client.storage.from(this.bucket).upload(previewPngPath, input.png, {
        cacheControl: "31536000",
        contentType: "image/png",
        upsert: true,
      }),
      this.client.storage.from(this.bucket).upload(printSvgPath, input.svg, {
        cacheControl: "31536000",
        contentType: "image/svg+xml",
        upsert: true,
      }),
    ]);
    if (pngUpload.error || svgUpload.error) {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    return {
      previewPngPath,
      printSvgPath,
      renderChecksumSha256: createHash("sha256").update(input.svg).digest("hex"),
    };
  }
}

export class SupabaseQrPrintExportRuntime
  implements QrPrintExportRepository, QrPrintExportArtifactStorage
{
  constructor(
    private readonly client: SupabaseAdminClient,
    private readonly bucket = "qr-artifacts",
  ) {}

  async getContext(batchId: string): Promise<QrPrintExportContext> {
    const result = await this.client.rpc("get_qr_print_export_context", {
      p_batch_id: batchId,
    });
    if (result.error) {
      throw mapRuntimeError(result.error);
    }
    const row = assertObject(result.data);
    if (
      typeof row.tenant_id !== "string" ||
      typeof row.site_id !== "string" ||
      typeof row.batch_id !== "string" ||
      typeof row.batch_code !== "string" ||
      typeof row.export_revision !== "number" ||
      typeof row.already_completed !== "boolean" ||
      !Array.isArray(row.items)
    ) {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    return {
      alreadyCompleted: row.already_completed,
      batchCode: row.batch_code,
      batchId: row.batch_id,
      exportRevision: row.export_revision,
      items: row.items.map((value) => {
        const item = assertObject(value);
        if (
          typeof item.ordinal !== "number" ||
          typeof item.human_code !== "string" ||
          typeof item.preview_png_path !== "string" ||
          typeof item.print_svg_path !== "string" ||
          typeof item.render_checksum_sha256 !== "string"
        ) {
          throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
        }
        return {
          humanCode: item.human_code,
          ordinal: item.ordinal,
          previewPngPath: item.preview_png_path,
          printSvgPath: item.print_svg_path,
          renderChecksumSha256: item.render_checksum_sha256,
        };
      }),
      siteId: row.site_id,
      tenantId: row.tenant_id,
    };
  }

  async load(path: string): Promise<Uint8Array> {
    const result = await this.client.storage.from(this.bucket).download(path);
    if (result.error) {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    return new Uint8Array(await result.data.arrayBuffer());
  }

  async store(input: {
    artifact: {
      bytes: Uint8Array;
      checksumSha256: string;
      filename: string;
      mimeType: string;
    };
    batchId: string;
    exportRevision: number;
    tenantId: string;
  }): Promise<string> {
    const path = `${input.tenantId}/batches/${input.batchId}/exports-${input.exportRevision}/${input.artifact.filename}`;
    const result = await this.client.storage.from(this.bucket).upload(path, input.artifact.bytes, {
      cacheControl: "31536000",
      contentType: input.artifact.mimeType,
      upsert: true,
    });
    if (result.error) {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    return path;
  }

  async commit(input: {
    batchId: string;
    exportRevision: number;
    exports: readonly {
      byteSize: number;
      checksumSha256: string;
      exportType: "CSV" | "MANIFEST" | "PDF" | "ZIP";
      storagePath: string;
    }[];
  }): Promise<void> {
    const result = await this.client.rpc("commit_qr_print_exports", {
      p_batch_id: input.batchId,
      p_export_revision: input.exportRevision,
      p_exports: input.exports.map((item) => ({
        byte_size: item.byteSize,
        checksum_sha256: item.checksumSha256,
        export_type: item.exportType,
        storage_path: item.storagePath,
      })),
    });
    if (result.error) {
      throw mapRuntimeError(result.error);
    }
  }
}

export class SupabaseQrWorkerFailureRepository {
  constructor(private readonly client: SupabaseAdminClient) {}

  async recordGenerationFailure(input: {
    errorCode: Exclude<QrWorkerExecutionErrorCode, "PRINT_EXPORT_UNAVAILABLE">;
    generationRevision: number;
    jobId: string;
  }): Promise<{ terminal: boolean }> {
    const result = await this.client.rpc("record_qr_generation_execution_failure", {
      p_error_code: input.errorCode,
      p_generation_revision: input.generationRevision,
      p_job_id: input.jobId,
    });
    if (result.error) {
      throw mapRuntimeError(result.error);
    }
    const row = assertObject(result.data);
    if (typeof row.terminal !== "boolean") {
      throw new SupabaseQrGenerationRuntimeError("UNAVAILABLE");
    }
    return { terminal: row.terminal };
  }

  async recordPrintExportFailure(batchId: string): Promise<void> {
    const result = await this.client.rpc("record_qr_print_export_failure", {
      p_batch_id: batchId,
      p_error_code: "PRINT_EXPORT_UNAVAILABLE",
    });
    if (result.error) {
      throw mapRuntimeError(result.error);
    }
  }
}

export async function readWorkerTaptolkLogoDataUri(): Promise<string> {
  const logo = await readFile(
    new URL("../../../web/public/brand/taptolk-logo.png", import.meta.url),
  );
  return `data:image/png;base64,${logo.toString("base64")}`;
}
