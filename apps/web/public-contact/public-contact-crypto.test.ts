import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { HmacPublicContactHasher } from "./public-contact-crypto";

vi.mock("server-only", () => ({}));

describe("HmacPublicContactHasher", () => {
  it("uses the issuance lookup hash for a public QR token", async () => {
    const hasher = new HmacPublicContactHasher("test-token-hmac-key");
    const token = "public-token-fixture";

    await expect(hasher.hash(token, "public-token")).resolves.toBe(
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
    await expect(hasher.hash(token, "session-token")).resolves.not.toBe(
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
  });
});
