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

export class QrPrintExportHandler {
  constructor(
    private readonly repository: QrPrintExportRepository,
    private readonly storage: QrPrintExportArtifactStorage,
  ) {}

  async handle(batchId: string): Promise<{ exportCount: number; itemCount: number }> {
    const context = await this.repository.getContext(batchId);
    if (context.batchId !== batchId) {
      throw new Error("PRINT_EXPORT_CONTEXT_MISMATCH");
    }
    if (context.alreadyCompleted) {
      return { exportCount: 4, itemCount: context.items.length };
    }
    const items: PrintExportItem[] = await Promise.all(
      context.items.map(async (item) => ({
        humanCode: item.humanCode,
        ordinal: item.ordinal,
        previewPng: await this.storage.load(item.previewPngPath),
        printSvg: new TextDecoder().decode(await this.storage.load(item.printSvgPath)),
        renderChecksumSha256: item.renderChecksumSha256,
      })),
    );
    const bundle = await buildPrintExportBundle(context.batchCode, items);
    const typedArtifacts = [
      ["CSV", bundle.csv],
      ["MANIFEST", bundle.manifest],
      ["PDF", bundle.pdf],
      ["ZIP", bundle.zip],
    ] as const;
    const exports = await Promise.all(
      typedArtifacts.map(async ([exportType, artifact]) => ({
        byteSize: artifact.bytes.byteLength,
        checksumSha256: artifact.checksumSha256,
        exportType,
        storagePath: await this.storage.store({
          artifact,
          batchId: context.batchId,
          exportRevision: context.exportRevision,
          tenantId: context.tenantId,
        }),
      })),
    );
    await this.repository.commit({
      batchId: context.batchId,
      exportRevision: context.exportRevision,
      exports,
    });
    return { exportCount: exports.length, itemCount: items.length };
  }
}
