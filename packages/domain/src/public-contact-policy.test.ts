import { describe, expect, it } from "vitest";
import {
  assertContactPlateLast4,
  assertPublicContactRatePolicy,
  DEFAULT_PUBLIC_CONTACT_RATE_POLICY,
  getPublicContactPollingInterval,
  normalizeContactMessage,
  normalizeContactReason,
  PublicContactPolicyError,
} from "./public-contact-policy.js";

describe("public contact policy", () => {
  it("accepts approved reasons and normalizes bounded text", () => {
    expect(normalizeContactReason("MOVE_REQUEST")).toBe("MOVE_REQUEST");
    expect(normalizeContactMessage({ mode: "FREE_TEXT", value: "  이동을  부탁드립니다.  " })).toBe(
      "이동을 부탁드립니다.",
    );
    expect(() => assertContactPlateLast4("7098")).not.toThrow();
  });

  it.each([
    "https://example.com",
    "caller@example.com",
    "010-1234-5678",
    "찾아간다",
    "a".repeat(201),
    "",
  ])("rejects unsafe caller message: %s", (value) => {
    expect(() => normalizeContactMessage({ mode: "FREE_TEXT", value })).toThrow(
      PublicContactPolicyError,
    );
  });

  it("rejects unknown reasons and malformed plate confirmations", () => {
    expect(() => normalizeContactReason("UNKNOWN")).toThrowError("INVALID_CONTACT_REASON");
    expect(() => assertContactPlateLast4("123")).toThrowError("INVALID_PLATE_CONFIRMATION");
  });

  it("accepts the approved rate policy and rejects weakened ordering", () => {
    expect(() => assertPublicContactRatePolicy(DEFAULT_PUBLIC_CONTACT_RATE_POLICY)).not.toThrow();
    expect(() =>
      assertPublicContactRatePolicy({
        ...DEFAULT_PUBLIC_CONTACT_RATE_POLICY,
        duplicateMergeSeconds: 601,
      }),
    ).toThrowError("INVALID_CONTACT_POLICY");
  });

  it("selects adaptive polling and stops at terminal status", () => {
    expect(
      getPublicContactPollingInterval({
        elapsedSeconds: 10,
        hidden: false,
        status: "NOTIFICATION_QUEUED",
      }),
    ).toBe(3_000);
    expect(
      getPublicContactPollingInterval({
        elapsedSeconds: 180,
        hidden: false,
        status: "OWNER_NOTIFIED",
      }),
    ).toBe(5_000);
    expect(
      getPublicContactPollingInterval({
        elapsedSeconds: 400,
        hidden: true,
        networkFailures: 1,
        status: "OWNER_REPLIED",
      }),
    ).toBe(30_000);
    expect(
      getPublicContactPollingInterval({
        elapsedSeconds: 10,
        hidden: false,
        status: "RESOLVED",
      }),
    ).toBeNull();
  });
});
