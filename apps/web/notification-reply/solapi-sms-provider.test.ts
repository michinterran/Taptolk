import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildOwnerSmsText,
  hasSolapiSmsConfig,
  SolapiSmsNotificationProvider,
} from "./solapi-sms-provider";

const notification = {
  locale: "ko" as const,
  templateKey: "OWNER_CONTACT_REQUEST_V1" as const,
  variables: {
    reasonCode: "MOVE_REQUEST" as const,
    responseUrl: "https://taptolk.example/ko/respond/response-token-value",
  },
};

describe("SOLAPI SMS notification provider", () => {
  it("requires all server-only provider settings", () => {
    expect(hasSolapiSmsConfig({ apiKey: "key", apiSecret: "secret" })).toBe(false);
    expect(
      hasSolapiSmsConfig({
        apiKey: "a".repeat(24),
        apiSecret: "b".repeat(24),
        from: "01012345678",
      }),
    ).toBe(true);
  });

  it("builds a minimal PWA response message without the destination phone", () => {
    const text = buildOwnerSmsText(notification);
    expect(text).toContain("차량 이동을 부탁드립니다.");
    expect(text).toContain(notification.variables.responseUrl);
    expect(text).not.toContain("010");
  });

  it("decrypts only at the provider boundary and persists the SOLAPI receipt id", async () => {
    const sendOne = vi.fn().mockResolvedValue({
      groupId: "group_12345678",
      messageId: "message_12345678",
    });
    const provider = new SolapiSmsNotificationProvider(
      {
        apiKey: "a".repeat(24),
        apiSecret: "b".repeat(24),
        from: "01098765432",
      },
      { decryptOwnerPhone: vi.fn().mockReturnValue("01012345678") },
      sendOne,
    );

    await expect(
      provider.send({
        idempotencyKey: "i".repeat(64),
        notification,
        toCiphertext: "encrypted-owner-phone",
      }),
    ).resolves.toEqual({ providerMessageId: "message_12345678" });
    expect(sendOne).toHaveBeenCalledWith({
      to: "01012345678",
      from: "01098765432",
      text: expect.stringContaining(notification.variables.responseUrl),
      autoTypeDetect: true,
    });
  });

  it("maps provider throttling to the existing retry policy", async () => {
    const provider = new SolapiSmsNotificationProvider(
      {
        apiKey: "a".repeat(24),
        apiSecret: "b".repeat(24),
        from: "01098765432",
      },
      { decryptOwnerPhone: () => "01012345678" },
      vi.fn().mockRejectedValue({ httpStatus: 429, errorCode: "RATE_LIMIT" }),
    );

    await expect(
      provider.send({
        idempotencyKey: "i".repeat(64),
        notification,
        toCiphertext: "encrypted-owner-phone",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT" });
  });

  it("fails closed when the decrypted destination is not a Korean mobile number", async () => {
    const provider = new SolapiSmsNotificationProvider(
      {
        apiKey: "a".repeat(24),
        apiSecret: "b".repeat(24),
        from: "01098765432",
      },
      { decryptOwnerPhone: () => "010-1234-5678" },
      vi.fn(),
    );

    await expect(
      provider.send({
        idempotencyKey: "i".repeat(64),
        notification,
        toCiphertext: "encrypted-owner-phone",
      }),
    ).rejects.toMatchObject({ code: "INVALID_RECIPIENT" });
  });
});
