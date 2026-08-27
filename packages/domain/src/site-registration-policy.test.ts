import { describe, expect, it } from "vitest";
import {
  getSiteQrReadiness,
  hasSiteContractCapacity,
  hasSiteOperatingAddress,
} from "./site-registration-policy.js";

describe("site registration policy", () => {
  it.each([
    ["서울시 중구", true],
    [" A ", false],
    ["  ", false],
    [null, false],
  ] as const)("classifies operating address %s", (address, expected) => {
    expect(hasSiteOperatingAddress(address)).toBe(expected);
  });

  it.each([
    [1, true],
    [200, true],
    [0, false],
    [1.5, false],
    [null, false],
  ] as const)("classifies contract capacity %s", (limit, expected) => {
    expect(hasSiteContractCapacity(limit)).toBe(expected);
  });

  it("requires an active, addressed Site with contract capacity before QR issuance", () => {
    expect(
      getSiteQrReadiness({
        address: "서울시 중구",
        contractVehicleLimit: 100,
        status: "ACTIVE",
      }),
    ).toBe("READY");
    expect(getSiteQrReadiness({ address: "", contractVehicleLimit: 100, status: "ACTIVE" })).toBe(
      "MISSING_ADDRESS",
    );
    expect(
      getSiteQrReadiness({ address: "서울시 중구", contractVehicleLimit: 0, status: "ACTIVE" }),
    ).toBe("MISSING_CONTRACT_CAPACITY");
    expect(
      getSiteQrReadiness({
        address: "서울시 중구",
        contractVehicleLimit: 100,
        status: "SUSPENDED",
      }),
    ).toBe("INACTIVE");
  });
});
