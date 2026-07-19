import { describe, expect, it, vi } from "vitest";
import type { QrGenerationDispatchResult } from "./qr-generation-dispatch-coordinator.js";
import {
  BoundedQrGenerationDispatchRuntime,
  type QrGenerationDispatchRunner,
  QrGenerationDispatchRuntimeError,
} from "./qr-generation-dispatch-runtime.js";

const JOB_A = "00000000-0000-4000-8000-000000000101";
const JOB_B = "00000000-0000-4000-8000-000000000102";

function runner(results: readonly QrGenerationDispatchResult[]): QrGenerationDispatchRunner {
  const queue = [...results];
  return {
    runOnce: vi.fn(async () => queue.shift() ?? { claimedCount: 0, outcomes: [] }),
  };
}

function queuedRunner(results: QrGenerationDispatchResult[]) {
  return {
    runOnce: vi.fn(async () => results.shift() ?? { claimedCount: 0, outcomes: [] }),
  } satisfies QrGenerationDispatchRunner;
}

const POLICY = {
  claimLimit: 10,
  durationBudgetMs: 8_000,
  leaseSeconds: 60,
};

describe("BoundedQrGenerationDispatchRuntime", () => {
  it("claims one job at a time and stops on an empty Queue", async () => {
    const target = queuedRunner([
      {
        claimedCount: 1,
        outcomes: [{ jobId: JOB_A, status: "PUBLISHED" }],
      },
      {
        claimedCount: 1,
        outcomes: [{ jobId: JOB_B, status: "DELIVERY_RETRY_SCHEDULED" }],
      },
      { claimedCount: 0, outcomes: [] },
    ]);
    const runtime = new BoundedQrGenerationDispatchRuntime(target, POLICY, () => 100);

    await expect(runtime.run()).resolves.toEqual({
      claimedCount: 2,
      completedWithinBudget: true,
      outcomeCounts: {
        DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING: 0,
        DELIVERY_RETRY_SCHEDULED: 1,
        PUBLICATION_ACKNOWLEDGEMENT_PENDING: 0,
        PUBLISHED: 1,
      },
    });
    expect(target.runOnce).toHaveBeenCalledTimes(3);
    expect(target.runOnce).toHaveBeenCalledWith({ leaseSeconds: 60, limit: 1 });
  });

  it("never exceeds the configured claim limit", async () => {
    const target = queuedRunner([
      {
        claimedCount: 1,
        outcomes: [{ jobId: JOB_A, status: "PUBLISHED" }],
      },
      {
        claimedCount: 1,
        outcomes: [{ jobId: JOB_B, status: "PUBLISHED" }],
      },
      { claimedCount: 1, outcomes: [{ jobId: crypto.randomUUID(), status: "PUBLISHED" }] },
    ]);
    const runtime = new BoundedQrGenerationDispatchRuntime(
      target,
      { ...POLICY, claimLimit: 2 },
      () => 100,
    );

    await expect(runtime.run()).resolves.toMatchObject({
      claimedCount: 2,
      completedWithinBudget: true,
    });
    expect(target.runOnce).toHaveBeenCalledTimes(2);
  });

  it("stops before another claim when the duration budget is exhausted", async () => {
    const target = queuedRunner([
      {
        claimedCount: 1,
        outcomes: [{ jobId: JOB_A, status: "PUBLICATION_ACKNOWLEDGEMENT_PENDING" }],
      },
      {
        claimedCount: 1,
        outcomes: [{ jobId: JOB_B, status: "PUBLISHED" }],
      },
    ]);
    const clock = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(1_000);
    const runtime = new BoundedQrGenerationDispatchRuntime(
      target,
      { ...POLICY, durationBudgetMs: 1_000 },
      clock,
    );

    await expect(runtime.run()).resolves.toEqual({
      claimedCount: 1,
      completedWithinBudget: false,
      outcomeCounts: {
        DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING: 0,
        DELIVERY_RETRY_SCHEDULED: 0,
        PUBLICATION_ACKNOWLEDGEMENT_PENDING: 1,
        PUBLISHED: 0,
      },
    });
    expect(target.runOnce).toHaveBeenCalledTimes(1);
  });

  it("aggregates acknowledgement-pending outcomes without returning job identities", async () => {
    const target = queuedRunner([
      {
        claimedCount: 1,
        outcomes: [{ jobId: JOB_A, status: "DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING" }],
      },
      { claimedCount: 0, outcomes: [] },
    ]);
    const runtime = new BoundedQrGenerationDispatchRuntime(target, POLICY, () => 100);

    const result = await runtime.run();

    expect(result.outcomeCounts.DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING).toBe(1);
    expect(JSON.stringify(result)).not.toContain(JOB_A);
  });

  it("fails closed on inconsistent coordinator results", async () => {
    const target = queuedRunner([{ claimedCount: 1, outcomes: [] }]);
    const runtime = new BoundedQrGenerationDispatchRuntime(target, POLICY, () => 100);

    await expect(runtime.run()).rejects.toMatchObject({
      code: "INVALID_RUN_RESULT",
      name: "QrGenerationDispatchRuntimeError",
    });
  });

  it.each([
    [{ ...POLICY, claimLimit: 0 }, "INVALID_CLAIM_LIMIT"],
    [{ ...POLICY, claimLimit: 51 }, "INVALID_CLAIM_LIMIT"],
    [{ ...POLICY, leaseSeconds: 4 }, "INVALID_LEASE_SECONDS"],
    [{ ...POLICY, leaseSeconds: 301 }, "INVALID_LEASE_SECONDS"],
    [{ ...POLICY, durationBudgetMs: 999 }, "INVALID_DURATION_BUDGET"],
    [{ ...POLICY, durationBudgetMs: 60_001 }, "INVALID_DURATION_BUDGET"],
  ] as const)("rejects invalid policy %o", (policy, code) => {
    expect(() => new BoundedQrGenerationDispatchRuntime(runner([]), policy)).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it("rejects a non-finite monotonic clock", async () => {
    const runtime = new BoundedQrGenerationDispatchRuntime(runner([]), POLICY, () => Number.NaN);

    await expect(runtime.run()).rejects.toBeInstanceOf(QrGenerationDispatchRuntimeError);
  });
});
