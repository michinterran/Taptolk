import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AesGcmOwnerActivationProtector } from "./owner-activation-crypto";

vi.mock("server-only", () => ({}));

describe("AesGcmOwnerActivationProtector", () => {
  it("uses the issuance lookup hash for a public QR token", async () => {
    const protector = new AesGcmOwnerActivationProtector(
      "test-encryption-key",
      "test-token-hmac-key",
      1,
    );
    const token = "public-token-fixture";

    await expect(protector.hash(token, "public-token")).resolves.toBe(
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
    await expect(protector.hash(token, "session")).resolves.not.toBe(
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
  });
});
