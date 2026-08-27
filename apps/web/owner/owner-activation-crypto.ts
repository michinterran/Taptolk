import "server-only";

import { createCipheriv, createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import type {
  OwnerActivationHashPurpose,
  OwnerActivationProtectedValue,
  OwnerActivationProtector,
  OwnerActivationSecretFactory,
} from "@taptolk/application";
import { hashPublicQrTokenLookup } from "../scan/public-token-hash";

function deriveKey(secret: string, purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}\0${secret}`, "utf8").digest();
}

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

export class AesGcmOwnerActivationProtector implements OwnerActivationProtector {
  private readonly encryptionKey: Buffer;
  private readonly hmacRootKey: Buffer;

  constructor(
    encryptionSecret: string,
    hmacSecret: string,
    private readonly keyVersion: number,
  ) {
    if (encryptionSecret.length < 16 || hmacSecret.length < 16 || keyVersion < 1) {
      throw new Error("OWNER_PROTECTION_CONFIG_INVALID");
    }
    this.encryptionKey = deriveKey(encryptionSecret, "owner-encryption");
    this.hmacRootKey = deriveKey(hmacSecret, "owner-hmac-root");
  }

  async hash(value: string, purpose: OwnerActivationHashPurpose): Promise<string> {
    if (purpose === "public-token") {
      return hashPublicQrTokenLookup(value);
    }
    const purposeKey = createHmac("sha256", this.hmacRootKey)
      .update(`owner-${purpose}`, "utf8")
      .digest();
    return createHmac("sha256", purposeKey).update(value, "utf8").digest("hex");
  }

  async protect(
    value: string,
    purpose: "phone" | "vehicle-plate",
  ): Promise<OwnerActivationProtectedValue> {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, nonce);
    cipher.setAAD(Buffer.from(`owner:${purpose}:v${this.keyVersion}`, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return {
      ciphertext: [
        `v${this.keyVersion}`,
        base64Url(nonce),
        base64Url(cipher.getAuthTag()),
        base64Url(ciphertext),
      ].join("."),
      keyVersion: this.keyVersion,
      last4: value.slice(-4),
      lookupHash: await this.hash(value, purpose),
    };
  }
}

export class RandomOwnerActivationSecretFactory implements OwnerActivationSecretFactory {
  constructor(private readonly stagingOtp?: string) {}

  createOtp(): string {
    return this.stagingOtp ?? randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  createProof(): string {
    return base64Url(randomBytes(32));
  }

  createSession(): string {
    return base64Url(randomBytes(32));
  }
}
