import type { QrGenerationDispatchRuntimeResult } from "@taptolk/application";
import { describe, expect, it, vi } from "vitest";
import type { StagingQrGenerationDispatchConfiguration } from "./qr-generation-dispatch-configuration";
import {
  handleQrGenerationDispatchRequest,
  type QrGenerationDispatchHandlerDependencies,
} from "./qr-generation-dispatch-handler";

const REQUEST_ID = "00000000-0000-4000-8000-000000000901";
const CRON_SECRET = "staging-cron-secret-value-123456789";
const CONFIGURATION: StagingQrGenerationDispatchConfiguration = {
  cronSecret: CRON_SECRET,
  publisher: {
    queueName: "qr-generation",
    requestTimeoutMs: 3_000,
  },
  retry: {
    baseDelayMs: 5_000,
    jitterRatio: 0.2,
    maxDelayMs: 300_000,
  },
  runtime: {
    claimLimit: 10,
    durationBudgetMs: 8_000,
    leaseSeconds: 60,
  },
};
const RESULT: QrGenerationDispatchRuntimeResult = {
  claimedCount: 2,
  completedWithinBudget: true,
  outcomeCounts: {
    DELIVERY_FAILURE_ACKNOWLEDGEMENT_PENDING: 0,
    DELIVERY_RETRY_SCHEDULED: 1,
    PUBLICATION_ACKNOWLEDGEMENT_PENDING: 0,
    PUBLISHED: 1,
  },
};

function dependencies(
  configuration: StagingQrGenerationDispatchConfiguration | null = CONFIGURATION,
): QrGenerationDispatchHandlerDependencies {
  return {
    readConfiguration: vi.fn(() => configuration),
    run: vi.fn().mockResolvedValue(RESULT),
  };
}

describe("QR generation dispatch HTTP handler policy", () => {
  it("fails closed before dispatch when staging configuration is unavailable", async () => {
    const target = dependencies(null);

    await expect(
      handleQrGenerationDispatchRequest(
        {
          authorizationHeader: `Bearer ${CRON_SECRET}`,
          requestId: REQUEST_ID,
        },
        target,
      ),
    ).resolves.toEqual({
      body: {
        error: {
          code: "UNAVAILABLE",
          retryable: false,
        },
        meta: { requestId: REQUEST_ID },
      },
      status: 503,
    });
    expect(target.run).not.toHaveBeenCalled();
  });

  it("rejects unauthorized requests before dispatch", async () => {
    const target = dependencies();

    await expect(
      handleQrGenerationDispatchRequest(
        {
          authorizationHeader: "Bearer wrong-secret-value-123456789",
          requestId: REQUEST_ID,
        },
        target,
      ),
    ).resolves.toMatchObject({
      body: {
        error: {
          code: "UNAUTHORIZED",
          retryable: false,
        },
      },
      status: 401,
    });
    expect(target.run).not.toHaveBeenCalled();
  });

  it("returns only aggregate dispatch outcomes", async () => {
    const target = dependencies();

    const response = await handleQrGenerationDispatchRequest(
      {
        authorizationHeader: `Bearer ${CRON_SECRET}`,
        requestId: REQUEST_ID,
      },
      target,
    );

    expect(response).toEqual({
      body: {
        data: RESULT,
        meta: { requestId: REQUEST_ID },
      },
      status: 200,
    });
    expect(target.run).toHaveBeenCalledWith(CONFIGURATION, REQUEST_ID);
    expect(JSON.stringify(response)).not.toContain(CRON_SECRET);
  });

  it("reduces runtime failures without provider or database details", async () => {
    const target = dependencies();
    vi.mocked(target.run).mockRejectedValue(new Error("raw provider and database detail"));

    const response = await handleQrGenerationDispatchRequest(
      {
        authorizationHeader: `Bearer ${CRON_SECRET}`,
        requestId: REQUEST_ID,
      },
      target,
    );

    expect(response).toEqual({
      body: {
        error: {
          code: "DISPATCH_FAILED",
          retryable: true,
        },
        meta: { requestId: REQUEST_ID },
      },
      status: 500,
    });
    expect(JSON.stringify(response)).not.toContain("raw provider");
  });
});
