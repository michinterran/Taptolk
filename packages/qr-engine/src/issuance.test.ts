import { describe, expect, it } from "vitest";
import {
  ACTIVATION_CODE_LENGTH,
  createQrCredentialGenerator,
  HUMAN_CODE_LENGTH,
  issueQrBatch,
  QrIssuanceError,
} from "./issuance.js";

describe("QR issuance", () => {
  it("issues 1,000 unique, encrypted credentials", () => {
    const generate = createQrCredentialGenerator({
      encryptionKey: Buffer.alloc(32, 7),
      keyVersion: 3,
    });
    const issued = issueQrBatch(1_000, generate);
    expect(new Set(issued.map((item) => item.publicToken.hash))).toHaveLength(1_000);
    expect(new Set(issued.map((item) => item.humanCode))).toHaveLength(1_000);
    expect(new Set(issued.map((item) => item.activationCode.hash))).toHaveLength(1_000);
    expect(issued.every((item) => item.humanCode.length === HUMAN_CODE_LENGTH)).toBe(true);
    expect(issued.every((item) => item.activationCode.ciphertext.split(".").length === 4)).toBe(
      true,
    );
    expect(issued.every((item) => item.publicToken.value.length >= 22)).toBe(true);
    expect(ACTIVATION_CODE_LENGTH).toBe(8);
  });

  it("fails closed when collision retries are exhausted", () => {
    const fixed = createQrCredentialGenerator({
      encryptionKey: Buffer.alloc(32, 3),
      keyVersion: 1,
      random: (size) => Buffer.alloc(size, 1),
    });
    expect(() => issueQrBatch(2, fixed, 2)).toThrowError(
      new QrIssuanceError("COLLISION_RETRY_EXHAUSTED"),
    );
  });
});
