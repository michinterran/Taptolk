import { describe, expect, it, vi } from "vitest";
import {
  NotificationDispatchService,
  NotificationSmsProviderError,
  OwnerResponseService,
} from "./notification-reply-service.js";

const claim = {
  deliveryId: "delivery-1",
  destinationCiphertext: "protected-destination",
  idempotencyKey: "stable-key",
  leaseVersion: 1,
  locale: "ko" as const,
  messageBody: "safe body",
  responseToken: "r".repeat(43),
};

describe("notification dispatch service", () => {
  it("records one provider success", async () => {
    const repository = {
      claim: vi.fn().mockResolvedValue([claim]),
      fail: vi.fn(),
      sent: vi.fn(),
    };
    const service = new NotificationDispatchService(
      repository,
      { send: vi.fn().mockResolvedValue({ providerMessageId: "receipt-hash" }) },
      { hash: vi.fn().mockResolvedValue("a".repeat(64)) },
      { createResponseToken: () => "r".repeat(43) },
    );
    await expect(
      service.run({ leaseSeconds: 30, limit: 1, workerId: "worker-01" }),
    ).resolves.toEqual({ claimed: 1, failedFinal: 0, retryScheduled: 0, sent: 1 });
    expect(repository.sent).toHaveBeenCalledOnce();
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it("schedules transient failures and finalizes permanent failures", async () => {
    for (const [code, expected] of [
      ["TEMPORARY_FAILURE", { failedFinal: 0, retryScheduled: 1 }],
      ["INVALID_RECIPIENT", { failedFinal: 1, retryScheduled: 0 }],
    ] as const) {
      const repository = {
        claim: vi.fn().mockResolvedValue([claim]),
        fail: vi.fn(),
        sent: vi.fn(),
      };
      const service = new NotificationDispatchService(
        repository,
        {
          send: vi.fn().mockRejectedValue(new NotificationSmsProviderError(code)),
        },
        { hash: vi.fn().mockResolvedValue("a".repeat(64)) },
        { createResponseToken: () => "r".repeat(43) },
        () => new Date("2026-07-20T00:00:00.000Z"),
      );
      const result = await service.run({ leaseSeconds: 30, limit: 1, workerId: "worker-01" });
      expect(result).toMatchObject(expected);
      expect(repository.fail).toHaveBeenCalledOnce();
    }
  });
});

describe("owner response service", () => {
  it("hashes the token and normalizes the reply", async () => {
    const repository = {
      inspect: vi.fn(),
      reply: vi.fn().mockResolvedValue({ status: "OWNER_REPLIED" as const }),
    };
    const service = new OwnerResponseService(repository, {
      hash: vi.fn().mockResolvedValue("b".repeat(64)),
    });
    await expect(
      service.reply({ code: "CUSTOM", body: "  이동하겠습니다. ", responseToken: "r".repeat(43) }),
    ).resolves.toEqual({ status: "OWNER_REPLIED" });
    expect(repository.reply).toHaveBeenCalledWith({
      body: "이동하겠습니다.",
      replyCode: "CUSTOM",
      responseTokenHash: "b".repeat(64),
    });
  });
});
