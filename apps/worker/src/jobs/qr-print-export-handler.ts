import {
  buildPrintExportBundle,
  type PrintExportArtifact,
  type PrintExportItem,
} from "@taptolk/qr-engine";

export interface QrPrintExportContextItem {
  humanCode: string;
  ordinal: number;
  previewPngPath: string;
  printSvgPath: string;
  renderChecksumSha256: string;
}

export interface QrPrintExportContext {
  alreadyCompleted: boolean;
  batchCode: string;
  batchId: string;
  exportRevision: number;
  items: readonly QrPrintExportContextItem[];
  siteId: string;
  tenantId: string;
}

export interface QrPrintExportRepository {
  commit(input: {
    batchId: string;
    exportRevision: number;
    exports: readonly {
      byteSize: number;
      checksumSha256: string;
      exportType: "CSV" | "MANIFEST" | "PDF" | "ZIP";
      storagePath: string;
    }[];
  }): Promise<void>;
  getContext(batchId: string): Promise<QrPrintExportContext>;
}

export interface QrPrintExportArtifactStorage {
  load(path: string): Promise<Uint8Array>;
  store(input: {
    artifact: PrintExportArtifact;
    batchId: string;
    exportRevision: number;
    tenantId: string;
  }): Promise<string>;
}

export interface QrPrintExportHandlerOptions {
  loadConcurrency: number;
  storeConcurrency: number;
}

export type QrPrintExportHandlerErrorCode =
  | "ARTIFACT_LOAD"
  | "BUNDLE_BUILD"
  | "CONTEXT_LOAD"
  | "EXPORT_COMMIT"
  | "EXPORT_STORE";

export class QrPrintExportHandlerError extends Error {
  constructor(readonly code: QrPrintExportHandlerErrorCode) {
    super(`QR print export handler failed: ${code}`);
    this.name = "QrPrintExportHandlerError";
  }
}

export class QrPrintExportHandler {
  constructor(
    private readonly repository: QrPrintExportRepository,
    private readonly storage: QrPrintExportArtifactStorage,
    private readonly options: QrPrintExportHandlerOptions,
  ) {
    if (
      !Number.isInteger(options.loadConcurrency) ||
      options.loadConcurrency < 1 ||
      options.loadConcurrency > 10
    ) {
      throw new Error("INVALID_PRINT_EXPORT_LOAD_CONCURRENCY");
    }
    if (
      !Number.isInteger(options.storeConcurrency) ||
      options.storeConcurrency < 1 ||
      options.storeConcurrency > 4
    ) {
      throw new Error("INVALID_PRINT_EXPORT_STORE_CONCURRENCY");
    }
  }

  async handle(batchId: string): Promise<{ exportCount: number; itemCount: number }> {
    let context: QrPrintExportContext;
    try {
      context = await this.repository.getContext(batchId);
    } catch {
      throw new QrPrintExportHandlerError("CONTEXT_LOAD");
    }
    if (context.batchId !== batchId) {
      throw new Error("PRINT_EXPORT_CONTEXT_MISMATCH");
    }
    if (context.alreadyCompleted) {
      return { exportCount: 4, itemCount: context.items.length };
    }
    const items = new Array<PrintExportItem>(context.items.length);
    let nextIndex = 0;
    const workers = Array.from(
      { length: Math.min(context.items.length, this.options.loadConcurrency) },
      async () => {
        while (true) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= context.items.length) {
            return;
          }
          const item = context.items[index];
          if (!item) {
            throw new Error("PRINT_EXPORT_ITEM_MISSING");
          }
          const [previewPng, printSvg] = await Promise.all([
            this.storage.load(item.previewPngPath),
            this.storage.load(item.printSvgPath),
          ]);
          items[index] = {
            humanCode: item.humanCode,
            ordinal: item.ordinal,
            previewPng,
            printSvg: new TextDecoder().decode(printSvg),
            renderChecksumSha256: item.renderChecksumSha256,
          };
        }
      },
    );
    try {
      await Promise.all(workers);
    } catch {
      throw new QrPrintExportHandlerError("ARTIFACT_LOAD");
    }
    let bundle: Awaited<ReturnType<typeof buildPrintExportBundle>>;
    try {
      bundle = await buildPrintExportBundle(context.batchCode, items);
    } catch {
      throw new QrPrintExportHandlerError("BUNDLE_BUILD");
    }
    const typedArtifacts = [
      ["CSV", bundle.csv],
      ["MANIFEST", bundle.manifest],
      ["PDF", bundle.pdf],
      ["ZIP", bundle.zip],
    ] as const;
    const exports = new Array<{
      byteSize: number;
      checksumSha256: string;
      exportType: "CSV" | "MANIFEST" | "PDF" | "ZIP";
      storagePath: string;
    }>(typedArtifacts.length);
    try {
      let nextArtifactIndex = 0;
      const storeWorkers = Array.from(
        {
          length: Math.min(typedArtifacts.length, this.options.storeConcurrency),
        },
        async () => {
          while (true) {
            const index = nextArtifactIndex;
            nextArtifactIndex += 1;
            if (index >= typedArtifacts.length) {
              return;
            }
            const typedArtifact = typedArtifacts[index];
            if (!typedArtifact) {
              throw new Error("PRINT_EXPORT_ARTIFACT_MISSING");
            }
            const [exportType, artifact] = typedArtifact;
            exports[index] = {
              byteSize: artifact.bytes.byteLength,
              checksumSha256: artifact.checksumSha256,
              exportType,
              storagePath: await this.storage.store({
                artifact,
                batchId: context.batchId,
                exportRevision: context.exportRevision,
                tenantId: context.tenantId,
              }),
            };
          }
        },
      );
      await Promise.all(storeWorkers);
    } catch {
      throw new QrPrintExportHandlerError("EXPORT_STORE");
    }
    try {
      await this.repository.commit({
        batchId: context.batchId,
        exportRevision: context.exportRevision,
        exports,
      });
    } catch {
      throw new QrPrintExportHandlerError("EXPORT_COMMIT");
    }
    return { exportCount: exports.length, itemCount: items.length };
  }
}
