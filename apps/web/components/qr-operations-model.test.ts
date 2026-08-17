import type { QrOperationsBatch } from "@taptolk/application";
import { describe, expect, it } from "vitest";
import {
  aggregateProgress,
  clampPage,
  clampPageSize,
  clampQuantity,
  percent,
  quantityPlan,
  statusTone,
  visiblePages,
  withQuery,
} from "./qr-operations-model";

function batch(overrides: Partial<QrOperationsBatch> = {}): QrOperationsBatch {
  return {
    batchCode: "QR-001",
    createdAt: "2026-08-18T00:00:00.000Z",
    directGenerationRequestId: null,
    downloadReady: false,
    executionAttemptCount: null,
    exportTypes: [],
    failedQuantity: 0,
    generatedQuantity: 0,
    id: "batch-1",
    jobFailedQuantity: 0,
    jobPassedQuantity: 0,
    jobStatus: null,
    managementCompanyId: "company-1",
    passedQuantity: 0,
    processedCount: null,
    renderedQuantity: 0,
    requestedQuantity: 100,
    siteId: "site-1",
    siteName: "Site",
    status: "DRAFT",
    version: 1,
    ...overrides,
  };
}

describe("QR operations view model", () => {
  it("clamps generation quantity and calculates the server split plan", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(10_001)).toBe(10_000);
    expect(clampQuantity(Number.NaN)).toBe(100);
    expect(quantityPlan(101)).toEqual({ batches: 2, last: 1 });
    expect(quantityPlan(200)).toEqual({ batches: 2, last: 100 });
  });

  it("aggregates tracked progress without reporting an empty request as ready", () => {
    expect(aggregateProgress([])).toEqual({
      failed: 0,
      generated: 0,
      passed: 0,
      ready: false,
      rendered: 0,
      requested: 0,
    });
    expect(
      aggregateProgress([
        batch({
          downloadReady: true,
          generatedQuantity: 100,
          passedQuantity: 99,
          renderedQuantity: 100,
        }),
        batch({
          downloadReady: true,
          failedQuantity: 1,
          generatedQuantity: 1,
          requestedQuantity: 1,
        }),
      ]),
    ).toEqual({
      failed: 1,
      generated: 101,
      passed: 99,
      ready: true,
      rendered: 100,
      requested: 101,
    });
  });

  it("keeps progress, status tone, and pagination within UI bounds", () => {
    expect(percent(120, 100)).toBe(100);
    expect(percent(1, 0)).toBe(0);
    expect(statusTone("FAILED")).toBe("danger");
    expect(statusTone("COMPLETED")).toBe("success");
    expect(clampPage(0, 7)).toBe(1);
    expect(clampPage(20, 7)).toBe(7);
    expect(clampPageSize(12)).toBe(10);
    expect(clampPageSize(50)).toBe(50);
    expect(visiblePages(6, 10)).toEqual([4, 5, 6, 7, 8]);
  });

  it("builds the localized route from non-empty query values", () => {
    expect(withQuery("ko", { company: "company-1", confirmed: 1, site: undefined })).toBe(
      "/ko/admin/qr-inventory?company=company-1&confirmed=1",
    );
  });
});
