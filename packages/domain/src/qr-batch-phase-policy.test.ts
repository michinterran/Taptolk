import { describe, expect, it } from "vitest";
import {
  buildQrBatchBoard,
  getQrBatchPhase,
  getQrBatchPhaseIndex,
  getQrBatchPlacement,
  QR_BATCH_PHASES,
} from "./qr-batch-phase-policy.js";

const ALL_STATUSES = [
  "DRAFT",
  "SAMPLE_RENDERING",
  "SAMPLE_READY",
  "SAMPLE_APPROVED",
  "FINAL_APPROVAL_PENDING",
  "GENERATION_APPROVED",
  "GENERATION_QUEUED",
  "GENERATING",
  "GENERATED",
  "QUALITY_CHECKED",
  "PRINT_FILE_READY",
  "SENT_TO_PRINTER",
  "PRINTED",
  "SHIPPED",
  "DELIVERED",
  "DISTRIBUTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "PARTIALLY_COMPLETED",
] as const;

describe("qr batch phase policy", () => {
  it("places every batch status the schema defines", () => {
    for (const status of ALL_STATUSES) {
      expect(getQrBatchPlacement(status), status).not.toBeNull();
    }
  });

  it("reports an unknown status as unplaced rather than guessing a phase", () => {
    expect(getQrBatchPlacement("NOT_A_STATUS")).toBeNull();
    expect(getQrBatchPhase("NOT_A_STATUS")).toBeNull();
  });

  it("keeps cancelled and failed off the phase lanes", () => {
    expect(getQrBatchPhase("CANCELLED")).toBeNull();
    expect(getQrBatchPhase("FAILED")).toBeNull();
    expect(getQrBatchPlacement("CANCELLED")).toEqual({ kind: "OUTCOME", outcome: "CANCELLED" });
    expect(getQrBatchPlacement("FAILED")).toEqual({ kind: "OUTCOME", outcome: "FAILED" });
  });

  it("orders the stages the way the canon tracks production", () => {
    expect(QR_BATCH_PHASES).toEqual(["GENERATION", "PRINT", "SHIPPING", "DELIVERY", "INTAKE"]);
    expect(getQrBatchPhaseIndex("GENERATION")).toBe(0);
    expect(getQrBatchPhaseIndex("INTAKE")).toBe(4);
  });

  it("groups approval-stage batches under generation", () => {
    expect(getQrBatchPhase("SAMPLE_READY")).toBe("GENERATION");
    expect(getQrBatchPhase("FINAL_APPROVAL_PENDING")).toBe("GENERATION");
    expect(getQrBatchPhase("GENERATING")).toBe("GENERATION");
  });

  it("separates printing, shipping, receipt and intake", () => {
    expect(getQrBatchPhase("SENT_TO_PRINTER")).toBe("PRINT");
    expect(getQrBatchPhase("SHIPPED")).toBe("SHIPPING");
    expect(getQrBatchPhase("DELIVERED")).toBe("DELIVERY");
    expect(getQrBatchPhase("DISTRIBUTING")).toBe("INTAKE");
    expect(getQrBatchPhase("PARTIALLY_COMPLETED")).toBe("INTAKE");
  });

  it("builds every lane even when a phase has no batches", () => {
    const board = buildQrBatchBoard([{ status: "SHIPPED" }], (item) => item.status);
    expect(board.lanes.map((lane) => lane.phase)).toEqual([
      "GENERATION",
      "PRINT",
      "SHIPPING",
      "DELIVERY",
      "INTAKE",
    ]);
    expect(board.lanes[0]?.items).toEqual([]);
    expect(board.lanes[2]?.items).toEqual([{ status: "SHIPPED" }]);
  });

  it("preserves the caller ordering inside a lane", () => {
    const items = [
      { id: "a", status: "GENERATING" },
      { id: "b", status: "SHIPPED" },
      { id: "c", status: "SAMPLE_READY" },
    ];
    const board = buildQrBatchBoard(items, (item) => item.status);
    expect(board.lanes[0]?.items.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("collects terminal outcomes and unknown statuses separately", () => {
    const items = [
      { id: "a", status: "CANCELLED" },
      { id: "b", status: "FAILED" },
      { id: "c", status: "SOMETHING_NEW" },
    ];
    const board = buildQrBatchBoard(items, (item) => item.status);
    expect(board.outcomes.map((entry) => entry.outcome)).toEqual(["CANCELLED", "FAILED"]);
    expect(board.unplaced.map((item) => item.id)).toEqual(["c"]);
    expect(board.lanes.every((lane) => lane.items.length === 0)).toBe(true);
  });
});
