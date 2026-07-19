import { describe, expect, it } from "vitest";
import { AesGcmVehiclePlateProtector } from "./vehicle-plate-protector";

describe("vehicle plate protection", () => {
  it("creates deterministic lookup and randomized ciphertext without plaintext", async () => {
    let nonceSeed = 0;
    const protector = new AesGcmVehiclePlateProtector(
      "encryption-secret-for-test",
      "lookup-secret-for-test",
      1,
      (size) => Buffer.alloc(size, nonceSeed++),
    );
    const first = await protector.protect("12가3456");
    const second = await protector.protect("12가3456");
    expect(first.lookupHash).toBe(second.lookupHash);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.ciphertext).not.toContain("12가3456");
    expect(first.last4).toBe("3456");
  });
});
