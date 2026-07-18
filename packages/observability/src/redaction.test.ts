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
});
