import { randomUUID } from "node:crypto";
import {
  createQrCredentialGenerator,
  type IssuedQrCredential,
  issueQrBatch,
  renderDynamicQr,
  renderSticker,
  type StickerTemplateCode,
} from "@taptolk/qr-engine";
import type { QueueJob } from "../queue-consumer.js";

export const QR_GENERATION_EXECUTION_CHUNK_SIZE = 50;

export interface QrGenerationExecutionContext {
  alreadyCompleted: boolean;
  batchId: string;
  completedOrdinals: readonly number[];
  customerLogoDataUri?: string;
  generationRevision: number;
  jobId: string;
  managementCompanyId: string;
  requestedQuantity: number;
  siteId: string;
  stickerDesignVersionId: string;
  templateCode: StickerTemplateCode;
  tenantId: string;
  renderMode?: "QR_ONLY" | "STICKER";
}

export interface QrGenerationArtifact {
  previewPngPath: string;
  printSvgPath: string;
  renderChecksumSha256: string;
}

export interface QrGenerationCommitItem {
  activationCodeCiphertext: string;
  activationCodeHash: string;
  activationKeyVersion: number;
  decodedPublicTokenHash: string;
  humanCode: string;
  internalUuid: string;
  ordinal: number;
  previewPngPath: string;
  printSvgPath: string;
  publicTokenCiphertext: string;
  publicTokenHash: string;
  qrAssetId: string;
  renderChecksumSha256: string;
  tokenKeyVersion: number;
}

export interface QrGenerationExecutionRepository {
  commitChunk(input: {
    generationRevision: number;
    items: readonly QrGenerationCommitItem[];
    jobId: string;
  }): Promise<{ committedCount: number; totalCount: number }>;
  complete(input: {
    generationRevision: number;
    jobId: string;
  }): Promise<{ completedCount: number }>;
  start(input: {
    generationRevision: number;
    jobId: string;
  }): Promise<QrGenerationExecutionContext>;
}

export interface QrGenerationArtifactStore {
  store(input: {
    batchId: string;
    generationRevision: number;
    ordinal: number;
    png: Uint8Array;
    svg: string;
    tenantId: string;
  }): Promise<QrGenerationArtifact>;
}

export interface QrGenerationRenderer {
  render(input: {
    customerLogoDataUri?: string;
    publicUrl: string;
    taptolkLogoDataUri: string;
    templateCode: StickerTemplateCode;
    renderMode?: "QR_ONLY" | "STICKER";
  }): Promise<{
    checksumSha256: string;
    decodedValue: string;
    png: Uint8Array;
    svg: string;
  }>;
}

export interface QrGenerationHandlerOptions {
  encryptionKey: Uint8Array;
  keyVersion: number;
  publicQrBaseUrl: string;
  renderConcurrency: number;
  taptolkLogoDataUri: string;
}

export class QrGenerationHandler {
  private readonly generateCredential: () => IssuedQrCredential;

  constructor(
    private readonly repository: QrGenerationExecutionRepository,
    private readonly artifactStore: QrGenerationArtifactStore,
    private readonly renderer: QrGenerationRenderer,
    private readonly options: QrGenerationHandlerOptions,
  ) {
    if (
      !Number.isInteger(options.renderConcurrency) ||
      options.renderConcurrency < 1 ||
      options.renderConcurrency > 10
    ) {
      throw new Error("INVALID_RENDER_CONCURRENCY");
    }
    this.generateCredential = createQrCredentialGenerator({
      encryptionKey: options.encryptionKey,
      keyVersion: options.keyVersion,
    });
  }

  async handle(job: QueueJob): Promise<{
    completedCount: number;
    generatedThisRun: number;
  }> {
    const context = await this.repository.start({
      generationRevision: job.generationRevision,
      jobId: job.jobId,
    });
    if (
      context.jobId !== job.jobId ||
      context.batchId !== job.batchId ||
      context.tenantId !== job.tenantId ||
      context.siteId !== job.siteId ||
      context.generationRevision !== job.generationRevision
    ) {
      throw new Error("GENERATION_CONTEXT_MISMATCH");
    }
    if (context.alreadyCompleted) {
      return {
        completedCount: context.completedOrdinals.length,
        generatedThisRun: 0,
      };
    }

    const completed = new Set(context.completedOrdinals);
    const missingOrdinals = Array.from(
      { length: context.requestedQuantity },
      (_, index) => index + 1,
    ).filter((ordinal) => !completed.has(ordinal));
    let generatedThisRun = 0;

    for (
      let offset = 0;
      offset < missingOrdinals.length;
      offset += QR_GENERATION_EXECUTION_CHUNK_SIZE
    ) {
      const ordinals = missingOrdinals.slice(offset, offset + QR_GENERATION_EXECUTION_CHUNK_SIZE);
      const credentials = issueQrBatch(ordinals.length, this.generateCredential);
      const items = new Array<QrGenerationCommitItem>(ordinals.length);
      let nextIndex = 0;
      const workers = Array.from(
        { length: Math.min(ordinals.length, this.options.renderConcurrency) },
        async () => {
          while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= ordinals.length) {
              return;
            }
            const ordinal = ordinals[index];
            if (ordinal === undefined) {
              throw new Error("GENERATION_ORDINAL_MISSING");
            }
            const credential = credentials[index];
            if (!credential) {
              throw new Error("GENERATION_CREDENTIAL_MISSING");
            }
            const publicUrl = new URL(
              `/q/${credential.publicToken.value}`,
              this.options.publicQrBaseUrl,
            ).toString();
            const renderInput = {
              ...(context.customerLogoDataUri
                ? { customerLogoDataUri: context.customerLogoDataUri }
                : {}),
              publicUrl,
              taptolkLogoDataUri: this.options.taptolkLogoDataUri,
              templateCode: context.templateCode,
              ...(context.renderMode ? { renderMode: context.renderMode } : {}),
            };
            const rendered = await this.renderer.render(renderInput);
            if (rendered.decodedValue !== publicUrl) {
              throw new Error("QR_DECODE_MISMATCH");
            }
            const artifact = await this.artifactStore.store({
              batchId: context.batchId,
              generationRevision: context.generationRevision,
              ordinal,
              png: rendered.png,
              svg: rendered.svg,
              tenantId: context.tenantId,
            });
            items[index] = {
              activationCodeCiphertext: credential.activationCode.ciphertext,
              activationCodeHash: credential.activationCode.hash,
              activationKeyVersion: credential.activationCode.keyVersion,
              decodedPublicTokenHash: credential.publicToken.hash,
              humanCode: credential.humanCode,
              internalUuid: randomUUID(),
              ordinal,
              previewPngPath: artifact.previewPngPath,
              printSvgPath: artifact.printSvgPath,
              publicTokenCiphertext: credential.publicToken.ciphertext,
              publicTokenHash: credential.publicToken.hash,
              qrAssetId: randomUUID(),
              renderChecksumSha256: artifact.renderChecksumSha256,
              tokenKeyVersion: credential.publicToken.keyVersion,
            };
          }
        },
      );
      await Promise.all(workers);
      const committed = await this.repository.commitChunk({
        generationRevision: context.generationRevision,
        items,
        jobId: context.jobId,
      });
      generatedThisRun += committed.committedCount;
    }

    const completedResult = await this.repository.complete({
      generationRevision: context.generationRevision,
      jobId: context.jobId,
    });
    return {
      completedCount: completedResult.completedCount,
      generatedThisRun,
    };
  }
}

export const sharpQrGenerationRenderer: QrGenerationRenderer = {
  async render(input) {
    return input.renderMode === "QR_ONLY"
      ? renderDynamicQr({ publicUrl: input.publicUrl })
      : renderSticker(input);
  },
};
