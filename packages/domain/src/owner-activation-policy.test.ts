import { describe, expect, it } from "vitest";
import {
  assertOwnerConsent,
  assertOwnerDeviceId,
  assertOwnerOtpPolicy,
  DEFAULT_OWNER_OTP_POLICY,
  normalizeOwnerActivationCode,
  normalizeOwnerOtp,
  normalizeOwnerPhone,
  normalizeOwnerVehiclePlate,
  OwnerActivationPolicyError,
} from "./owner-activation-policy.js";

describe("owner activation policy", () => {
  it("normalizes supported owner inputs without changing meaning", () => {
    expect(normalizeOwnerPhone("010-1234-5678")).toBe("01012345678");
    expect(normalizeOwnerVehiclePlate("12가 3456")).toBe("12가3456");
    expect(normalizeOwnerActivationCode("abcd-2345")).toBe("ABCD2345");
    expect(normalizeOwnerOtp(" 123456 ")).toBe("123456");
  });

  it.each([
    () => normalizeOwnerPhone("0201234567"),
    () => normalizeOwnerVehiclePlate("invalid"),
    () => normalizeOwnerActivationCode("O0I1"),
    () => normalizeOwnerOtp("12345"),
    () => assertOwnerDeviceId("device"),
    () =>
      assertOwnerConsent({
        accepted: false,
        privacyVersion: "PRIVACY_V1",
        termsVersion: "TERMS_V1",
      }),
  ])("rejects unsafe input", (run) => {
    expect(run).toThrow(OwnerActivationPolicyError);
  });

  it("accepts the approved bounded OTP policy", () => {
    expect(() => assertOwnerOtpPolicy(DEFAULT_OWNER_OTP_POLICY)).not.toThrow();
  });

  it("rejects a policy that weakens the approved ordering", () => {
    expect(() =>
      assertOwnerOtpPolicy({
        ...DEFAULT_OWNER_OTP_POLICY,
        dailyPhoneLimit: 4,
      }),
    ).toThrowError("INVALID_POLICY");
  });
});
