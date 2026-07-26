import { describe, expect, it } from "vitest";
import { redactSensitiveData } from "./redaction.js";

describe("structured-log redaction", () => {
  it("removes nested secrets and personal contact data", () => {
    expect(
      redactSensitiveData({
        payload: {
          messageBody: "private",
          phone: "01012345678",
          safeStatus: "queued",
        },
        token: "opaque",
      }),
    ).toEqual({
      payload: {
        messageBody: "[REDACTED]",
        phone: "[REDACTED]",
        safeStatus: "queued",
      },
      token: "[REDACTED]",
    });
  });

  it("redacts phone-like values even when a provider echoes them under a safe key", () => {
    expect(
      redactSensitiveData({
        errorCode: "INVALID_RECIPIENT",
        providerEcho: "recipient 010-1234-5678 was rejected",
        retryable: false,
      }),
    ).toEqual({
      errorCode: "INVALID_RECIPIENT",
      providerEcho: "[REDACTED]",
      retryable: false,
    });
  });
});
