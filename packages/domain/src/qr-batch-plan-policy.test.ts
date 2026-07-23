import { describe, expect, it } from "vitest";
import {
  clampQrBatchTotal,
  planQrBatchOrder,
  QR_BATCH_ITEM_MAX,
  QR_BATCH_SERIES_TOTAL_MAX,
  type QrSiteCapacity,
} from "./qr-batch-plan-policy.js";

const SITE: QrSiteCapacity = { contractVehicleLimit: 240, unassignedStock: 40 };
const NO_CONTRACT: QrSiteCapacity = { contractVehicleLimit: null, unassignedStock: 0 };

describe("qr batch plan policy", () => {
  it("splits a total into whole batches capped at the per-batch contract", () => {
    const plan = planQrBatchOrder(350, SITE);

    expect(plan.perBatchMax).toBe(QR_BATCH_ITEM_MAX);
    expect(plan.fullBatchCount).toBe(3);
    expect(plan.batchCount).toBe(4);
    expect(plan.lastBatchSize).toBe(50);
  });

  it("reports an exact split as aligned with no partial batch", () => {
    const plan = planQrBatchOrder(300, SITE);

    expect(plan.batchCount).toBe(3);
    expect(plan.lastBatchSize).toBe(QR_BATCH_ITEM_MAX);
    expect(plan.segments.partial).toBeNull();
    expect(plan.snap).toEqual({ kind: "ALIGNED" });
  });

  it("offers both snap targets that remove the partial batch", () => {
    const plan = planQrBatchOrder(350, SITE);

    expect(plan.snap).toEqual({
      downBy: 50,
      downTo: 300,
      kind: "ADJUSTABLE",
      upBy: 50,
      upTo: 400,
    });
  });

  it("collapses full batches beyond the display limit", () => {
    const plan = planQrBatchOrder(1_250, { contractVehicleLimit: 2_000, unassignedStock: 0 });

    expect(plan.fullBatchCount).toBe(12);
    expect(plan.segments.drawn).toBe(8);
    expect(plan.segments.collapsed).toBe(4);
    expect(plan.segments.partial).toBe(50);
  });

  it("grows the slider bound so it can always display the typed total", () => {
    const base = planQrBatchOrder(0, SITE).sliderMax;
    expect(base).toBe(360);

    const beyond = planQrBatchOrder(2_000, SITE);
    expect(beyond.sliderMax).toBe(2_000);
    expect(beyond.sliderMax).toBeGreaterThanOrEqual(beyond.total);
  });

  it("derives the recommendation and presets from the contract size", () => {
    const plan = planQrBatchOrder(100, SITE);

    expect(plan.recommendedTotal).toBe(200);
    expect(plan.presets).toEqual([
      { kind: "FIXED", value: 100 },
      { kind: "CONTRACT", value: 240 },
      { kind: "CONTRACT_DOUBLE", value: 480 },
    ]);
  });

  it("drops presets that duplicate the recommendation", () => {
    const plan = planQrBatchOrder(100, { contractVehicleLimit: 240, unassignedStock: 140 });

    expect(plan.recommendedTotal).toBe(100);
    expect(plan.presets).toEqual([
      { kind: "CONTRACT", value: 240 },
      { kind: "CONTRACT_DOUBLE", value: 480 },
    ]);
  });

  it("warns without blocking when the order exceeds the contract size", () => {
    const plan = planQrBatchOrder(300, SITE);

    expect(plan.capacitySignal).toBe("OVER_CONTRACT");
    expect(plan.overBy).toBe(60);
  });

  it("signals when existing stock would fill the contract", () => {
    const plan = planQrBatchOrder(220, SITE);

    expect(plan.capacitySignal).toBe("FILLS_CONTRACT");
    expect(plan.overBy).toBe(0);
  });

  it("stays silent when the order fits within the contract", () => {
    const plan = planQrBatchOrder(100, SITE);

    expect(plan.capacitySignal).toBe("NONE");
    expect(plan.overBy).toBe(0);
  });

  it("omits contract-derived values when the site has no contract size", () => {
    const plan = planQrBatchOrder(350, NO_CONTRACT);

    expect(plan.recommendedTotal).toBeNull();
    expect(plan.capacitySignal).toBe("NONE");
    expect(plan.presets).toEqual([{ kind: "FIXED", value: 100 }]);
    expect(plan.batchCount).toBe(4);
  });

  it("renders an empty order honestly instead of guessing", () => {
    const plan = planQrBatchOrder(0, SITE);

    expect(plan.batchCount).toBe(0);
    expect(plan.lastBatchSize).toBeNull();
    expect(plan.estimatedMinutes).toBeNull();
    expect(plan.snap).toBeNull();
    expect(plan.segments).toEqual({ collapsed: 0, drawn: 0, partial: null });
  });

  it("estimates generation time from the total", () => {
    expect(planQrBatchOrder(1, SITE).estimatedMinutes).toBe(1);
    expect(planQrBatchOrder(350, SITE).estimatedMinutes).toBe(6);
  });

  it.each([
    [-5, 0],
    [12.7, 12],
    [Number.NaN, 0],
    [QR_BATCH_SERIES_TOTAL_MAX + 1, QR_BATCH_SERIES_TOTAL_MAX],
  ])("clamps %s to %s", (input, expected) => {
    expect(clampQrBatchTotal(input)).toBe(expected);
  });

  it("ignores a non-positive contract limit rather than dividing by it", () => {
    const plan = planQrBatchOrder(150, { contractVehicleLimit: 0, unassignedStock: 10 });

    expect(plan.recommendedTotal).toBeNull();
    expect(plan.capacitySignal).toBe("NONE");
    expect(plan.sliderMax).toBe(200);
  });
});
