import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildOwnerOtpText,
  hasSolapiOwnerOtpConfig,
  SolapiOwnerOtpProvider,
} from "./owner-activation-provider";

describe("SOLAPI owner OTP provider", () => {
  it("requires all server-only provider settings", () => {
    expect(hasSolapiOwnerOtpConfig({ apiKey: "key", apiSecret: "secret" })).toBe(false);
    expect(
      hasSolapiOwnerOtpConfig({
        apiKey: "NCSAYU7YDBXYORXC",
        apiSecret: "b".repeat(32),
        from: "01012345678",
      }),
    ).toBe(true);
  });

  it("builds a localized six-digit OTP message without the destination phone", () => {
    expect(buildOwnerOtpText("ko", "123456")).toContain("123456");
    expect(buildOwnerOtpText("ko", "123456")).not.toContain("010");
    expect(buildOwnerOtpText("en", "123456")).toContain("3 minutes");
    expect(() => buildOwnerOtpText("ko", "12345")).toThrow("OWNER_OTP_INVALID");
  });

  it("sends the generated OTP only through the SOLAPI boundary", async () => {
    const sendOne = vi.fn().mockResolvedValue({
      groupId: "group_12345678",
      messageId: "message_12345678",
    });
    const provider = new SolapiOwnerOtpProvider(
      {
        apiKey: "NCSAYU7YDBXYORXC",
        apiSecret: "b".repeat(32),
        from: "01098765432",
      },
      sendOne,
    );

    await provider.send({
      challengeId: "challenge-id-is-not-sent",
      locale: "ko",
      otp: "123456",
      phone: "01012345678",
    });

    expect(sendOne).toHaveBeenCalledWith({
      to: "01012345678",
      from: "01098765432",
      text: expect.stringContaining("123456"),
      autoTypeDetect: true,
    });
  });

  it("fails closed for a non-mobile Korean destination", async () => {
    const sendOne = vi.fn();
    const provider = new SolapiOwnerOtpProvider(
      {
        apiKey: "NCSAYU7YDBXYORXC",
        apiSecret: "b".repeat(32),
        from: "01098765432",
      },
      sendOne,
    );

    await expect(
      provider.send({
        challengeId: "challenge-id-is-not-sent",
        locale: "ko",
        otp: "123456",
        phone: "010-1234-5678",
      }),
    ).rejects.toThrow("OWNER_OTP_INVALID_RECIPIENT");
    expect(sendOne).not.toHaveBeenCalled();
  });
});
