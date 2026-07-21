import { describe, expect, it } from "vitest";
import {
  assertResponseTokenTtl,
  getNotificationRetryDelaySeconds,
  isRetryableNotificationProviderError,
  NotificationReplyPolicyError,
  normalizeOwnerReply,
} from "./notification-reply-policy.js";

describe("notification reply policy", () => {
  it("classifies only bounded transient provider failures as retryable", () => {
    expect(isRetryableNotificationProviderError("RATE_LIMIT")).toBe(true);
    expect(isRetryableNotificationProviderError("TEMPORARY_FAILURE")).toBe(true);
    expect(isRetryableNotificationProviderError("UNKNOWN")).toBe(true);
    expect(isRetryableNotificationProviderError("AUTH_ERROR")).toBe(false);
    expect(() => isRetryableNotificationProviderError("RAW_PROVIDER_TEXT")).toThrow(
      NotificationReplyPolicyError,
    );
  });

  it("uses capped retry delays", () => {
    expect([1, 2, 3, 4].map((attempt) => getNotificationRetryDelaySeconds(attempt))).toEqual([
      30, 120, 300, 300,
    ]);
  });

  it("accepts allowlisted quick replies and moderates custom replies", () => {
    expect(normalizeOwnerReply({ code: "MOVING_NOW" })).toEqual({
      body: null,
      code: "MOVING_NOW",
    });
    expect(normalizeOwnerReply({ body: "  5분 뒤 이동하겠습니다.  ", code: "CUSTOM" })).toEqual({
      body: "5분 뒤 이동하겠습니다.",
      code: "CUSTOM",
    });
    expect(() => normalizeOwnerReply({ body: "010-1234-5678", code: "CUSTOM" })).toThrow();
  });

  it("bounds response token TTL", () => {
    expect(() => assertResponseTokenTtl(3_600)).not.toThrow();
    expect(() => assertResponseTokenTtl(60)).toThrow(NotificationReplyPolicyError);
  });
});
