import { describe, expect, it } from "vitest";
import {
  ExponentialQrGenerationDeliveryRetryPolicy,
  type QrGenerationDeliveryRetryPolicyConfig,
  QrGenerationDeliveryRetryPolicyError,
} from "./qr-generation-delivery-retry-policy.js";
import type { QrGenerationQueuePublishErrorCode } from "./qr-generation-dispatch-coordinator.js";
import type { QrGenerationDeliveryClaim } from "./qr-generation-dispatcher-service.js";

const NOW = new Date("2026-07-19T06:00:00.000Z");
const CLAIM: QrGenerationDeliveryClaim = {
  batchId: "00000000-0000-4000-8000-000000000201",
  createdAt: "2026-07-19T05:59:00.000Z",
  deliveryAttemptCount: 1,
  generationRevision: 1,
  jobId: "00000000-0000-4000-8000-000000000101",
  jobStatus: "DELIVERY_LEASED",
  jobType: "QR_GENERATION",
  jobVersion: 2,
  leaseExpiresAt: "2026-07-19T06:00:30.000Z",
  siteId: "00000000-0000-4000-8000-000000000301",
  tenantId: "00000000-0000-4000-8000-000000000401",
};
const CONFIG: QrGenerationDeliveryRetryPolicyConfig = {
  baseDelayMs: 5_000,
  jitterRatio: 0,
  maxDelayMs: 60_000,
};

function next(
  policy: ExponentialQrGenerationDeliveryRetryPolicy,
  claim: QrGenerationDeliveryClaim = CLAIM,
  errorCode: QrGenerationQueuePublishErrorCode = "QUEUE_UNAVAILABLE",
) {
  return policy.nextAvailableAt({ claim, errorCode });
}

describe("ExponentialQrGenerationDeliveryRetryPolicy", () => {
  it("uses the configured base delay for the first delivery failure", () => {
    const policy = new ExponentialQrGenerationDeliveryRetryPolicy(
      CONFIG,
      () => NOW,
      () => 0.5,
    );

    expect(next(policy)).toBe("2026-07-19T06:00:05.000Z");
  });

  it("doubles by delivery attempt and caps at the configured maximum", () => {
    const policy = new ExponentialQrGenerationDeliveryRetryPolicy(
      CONFIG,
      () => NOW,
      () => 0.5,
    );

    expect(next(policy, { ...CLAIM, deliveryAttemptCount: 3 })).toBe("2026-07-19T06:00:20.000Z");
    expect(next(policy, { ...CLAIM, deliveryAttemptCount: 30 })).toBe("2026-07-19T06:01:00.000Z");
  });

  it("applies bounded symmetric jitter from an injected random source", () => {
    const config = { ...CONFIG, jitterRatio: 0.25 };

    expect(
      next(
        new ExponentialQrGenerationDeliveryRetryPolicy(
          config,
          () => NOW,
          () => 0,
        ),
      ),
    ).toBe("2026-07-19T06:00:03.750Z");
    expect(
      next(
        new ExponentialQrGenerationDeliveryRetryPolicy(
          config,
          () => NOW,
          () => 1,
        ),
      ),
    ).toBe("2026-07-19T06:00:06.250Z");
  });

  it.each([
    [{ ...CONFIG, baseDelayMs: 999 }, "INVALID_BASE_DELAY"],
    [{ ...CONFIG, baseDelayMs: 86_400_001 }, "INVALID_BASE_DELAY"],
    [{ ...CONFIG, maxDelayMs: 4_999 }, "INVALID_MAX_DELAY"],
    [{ ...CONFIG, maxDelayMs: 86_400_001 }, "INVALID_MAX_DELAY"],
    [{ ...CONFIG, jitterRatio: -0.01 }, "INVALID_JITTER_RATIO"],
    [{ ...CONFIG, jitterRatio: 0.51 }, "INVALID_JITTER_RATIO"],
  ])("rejects unsafe configuration: %s", (config, code) => {
    expect(
      () =>
        new ExponentialQrGenerationDeliveryRetryPolicy(
          config,
          () => NOW,
          () => 0.5,
        ),
    ).toThrow(expect.objectContaining({ code }));
  });

  it("rejects an invalid attempt before calculating retry time", () => {
    const policy = new ExponentialQrGenerationDeliveryRetryPolicy(
      CONFIG,
      () => NOW,
      () => 0.5,
    );

    expect(() => next(policy, { ...CLAIM, deliveryAttemptCount: 0 })).toThrow(
      expect.objectContaining({ code: "INVALID_ATTEMPT" }),
    );
  });

  it("rejects invalid clock and random sources", () => {
    expect(() =>
      next(
        new ExponentialQrGenerationDeliveryRetryPolicy(
          CONFIG,
          () => new Date("invalid"),
          () => 0.5,
        ),
      ),
    ).toThrow(expect.objectContaining({ code: "INVALID_CLOCK" }));
    expect(() =>
      next(
        new ExponentialQrGenerationDeliveryRetryPolicy(
          CONFIG,
          () => NOW,
          () => 1.1,
        ),
      ),
    ).toThrow(expect.objectContaining({ code: "INVALID_RANDOM_SOURCE" }));
  });

  it("exposes typed policy errors without provider payloads", () => {
    expect(new QrGenerationDeliveryRetryPolicyError("INVALID_JITTER_RATIO")).toMatchObject({
      code: "INVALID_JITTER_RATIO",
      name: "QrGenerationDeliveryRetryPolicyError",
    });
  });
});
