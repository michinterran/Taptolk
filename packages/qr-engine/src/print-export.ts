import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { PDFDocument } from "pdf-lib";

export interface PrintExportItem {
  humanCode: string;
  ordinal: number;
  previewPng: Uint8Array;
  printSvg: string;
  renderChecksumSha256: string;
}

export interface PrintExportArtifact {
  bytes: Uint8Array;
  checksumSha256: string;
  filename: string;
  mimeType: string;
}

export interface PrintExportBundle {
  csv: PrintExportArtifact;
  manifest: PrintExportArtifact;
  pdf: PrintExportArtifact;
  zip: PrintExportArtifact;
}

export interface SvgExportItem {
  humanCode: string;
  ordinal: number;
  printSvg: string;
  renderChecksumSha256: string;
}

export interface PrintPdfInspection {
  pageCount: number;
  pages: readonly { height: number; width: number }[];
}

export async function inspectPrintPdf(bytes: Uint8Array): Promise<PrintPdfInspection> {
  const document = await PDFDocument.load(bytes);
  return {
    pageCount: document.getPageCount(),
    pages: document.getPages().map((page) => page.getSize()),
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function artifact(filename: string, mimeType: string, bytes: Uint8Array): PrintExportArtifact {
  return { bytes, checksumSha256: sha256(bytes), filename, mimeType };
}

function assertItems(items: readonly PrintExportItem[]): void {
  if (items.length < 1 || items.length > 10_000) {
    throw new Error("INVALID_EXPORT_ITEM_COUNT");
  }
  const ordinals = new Set<number>();
  const humanCodes = new Set<string>();
  for (const item of items) {
    if (
      !Number.isInteger(item.ordinal) ||
      item.ordinal < 1 ||
      !/^[0-9A-HJKMNP-TV-Z]{10}$/u.test(item.humanCode) ||
      !/^[0-9a-f]{64}$/u.test(item.renderChecksumSha256) ||
      item.previewPng.byteLength === 0 ||
      !item.printSvg.startsWith("<svg")
    ) {
      throw new Error("INVALID_EXPORT_ITEM");
    }
    if (ordinals.has(item.ordinal) || humanCodes.has(item.humanCode)) {
      throw new Error("DUPLICATE_EXPORT_ITEM");
    }
    ordinals.add(item.ordinal);
    humanCodes.add(item.humanCode);
  }
}

function assertSvgItems(items: readonly SvgExportItem[]): void {
  if (items.length < 1 || items.length > 10_000) {
    throw new Error("INVALID_SVG_EXPORT_ITEM_COUNT");
  }
  const ordinals = new Set<number>();
  const humanCodes = new Set<string>();
  for (const item of items) {
    if (
      !Number.isInteger(item.ordinal) ||
      item.ordinal < 1 ||
      !/^[0-9A-HJKMNP-TV-Z]{10}$/u.test(item.humanCode) ||
      !/^[0-9a-f]{64}$/u.test(item.renderChecksumSha256) ||
      !item.printSvg.startsWith("<svg")
    ) {
      throw new Error("INVALID_SVG_EXPORT_ITEM");
    }
    if (ordinals.has(item.ordinal) || humanCodes.has(item.humanCode)) {
      throw new Error("DUPLICATE_SVG_EXPORT_ITEM");
    }
    ordinals.add(item.ordinal);
    humanCodes.add(item.humanCode);
  }
}

async function buildPdf(items: readonly PrintExportItem[]): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const millimetresToPoints = 72 / 25.4;
  const stickerSize = 85 * millimetresToPoints;
  const columns = 2;
  const rows = 3;
  const horizontalMargin = (pageWidth - stickerSize * columns) / 2;
  const verticalMargin = (pageHeight - stickerSize * rows) / 2;
  for (let offset = 0; offset < items.length; offset += columns * rows) {
    const page = document.addPage([pageWidth, pageHeight]);
    const pageItems = items.slice(offset, offset + columns * rows);
    for (const [index, item] of pageItems.entries()) {
      const image = await document.embedPng(item.previewPng);
      const cellX = horizontalMargin + (index % columns) * stickerSize;
      const cellY = pageHeight - verticalMargin - (Math.floor(index / columns) + 1) * stickerSize;
      page.drawImage(image, {
        height: stickerSize,
        width: stickerSize,
        x: cellX,
        y: cellY,
      });
    }
  }
  return document.save({ addDefaultPage: false, useObjectStreams: true });
}

export async function buildPrintExportBundle(
  batchCode: string,
  inputItems: readonly PrintExportItem[],
): Promise<PrintExportBundle> {
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/u.test(batchCode)) {
    throw new Error("INVALID_BATCH_CODE");
  }
  assertItems(inputItems);
  const items = [...inputItems].sort((left, right) => left.ordinal - right.ordinal);
  const manifestRows = items.map((item) => {
    const ordinal = item.ordinal.toString().padStart(5, "0");
    return {
      humanCode: item.humanCode,
      ordinal: item.ordinal,
      previewFile: `preview/${ordinal}.png`,
      printFile: `svg/${ordinal}.svg`,
      renderChecksumSha256: item.renderChecksumSha256,
    };
  });
  const csvBytes = strToU8(
    [
      "ordinal,human_code,preview_file,print_file,render_checksum_sha256",
      ...manifestRows.map(
        (row) =>
          `${row.ordinal},${row.humanCode},${row.previewFile},${row.printFile},${row.renderChecksumSha256}`,
      ),
    ].join("\n"),
  );
  const manifestBytes = strToU8(
    JSON.stringify(
      {
        batchCode,
        files: manifestRows,
        itemCount: items.length,
        schemaVersion: 1,
      },
      null,
      2,
    ),
  );
  const pdfBytes = await buildPdf(items);
  const csv = artifact(`${batchCode}-manifest.csv`, "text/csv", csvBytes);
  const manifest = artifact(`${batchCode}-checksums.json`, "application/json", manifestBytes);
  const pdf = artifact(`${batchCode}-print.pdf`, "application/pdf", pdfBytes);
  const zipEntries: Record<string, Uint8Array> = {
    [csv.filename]: csv.bytes,
    [manifest.filename]: manifest.bytes,
  };
  for (const item of items) {
    const ordinal = item.ordinal.toString().padStart(5, "0");
    zipEntries[`preview/${ordinal}.png`] = item.previewPng;
    zipEntries[`svg/${ordinal}.svg`] = strToU8(item.printSvg);
  }
  const zip = artifact(
    `${batchCode}-print-bundle.zip`,
    "application/zip",
    zipSync(zipEntries, { level: 6 }),
  );
  return { csv, manifest, pdf, zip };
}

export function buildSvgExportBundle(
  batchCode: string,
  inputItems: readonly SvgExportItem[],
): PrintExportArtifact {
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/u.test(batchCode)) {
    throw new Error("INVALID_BATCH_CODE");
  }
  assertSvgItems(inputItems);
  const items = [...inputItems].sort((left, right) => left.ordinal - right.ordinal);
  const manifestRows = items.map((item) => {
    const ordinal = item.ordinal.toString().padStart(5, "0");
    return {
      humanCode: item.humanCode,
      ordinal: item.ordinal,
      printFile: `svg/${ordinal}.svg`,
      renderChecksumSha256: item.renderChecksumSha256,
    };
  });
  const zipEntries: Record<string, Uint8Array> = {
    [`${batchCode}-svg-checksums.json`]: strToU8(
      JSON.stringify(
        {
          batchCode,
          files: manifestRows,
          itemCount: items.length,
          schemaVersion: 1,
        },
        null,
        2,
      ),
    ),
  };
  for (const item of items) {
    const ordinal = item.ordinal.toString().padStart(5, "0");
    zipEntries[`svg/${ordinal}.svg`] = strToU8(item.printSvg);
  }
  return artifact(
    `${batchCode}-svg-bundle.zip`,
    "application/zip",
    zipSync(zipEntries, { level: 6 }),
  );
}
