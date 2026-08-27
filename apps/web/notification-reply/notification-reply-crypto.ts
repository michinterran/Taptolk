import "server-only";

import { createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { NotificationHasher, NotificationSecretFactory } from "@taptolk/application";

function deriveKey(secret: string, purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}\0${secret}`, "utf8").digest();
}

export class NotificationReplyCrypto implements NotificationHasher, NotificationSecretFactory {
  private readonly encryptionKey: Buffer;
  private readonly hmacRootKey: Buffer;

  constructor(
    encryptionSecret: string,
    hmacSecret: string,
    private readonly keyVersion: number,
  ) {
    if (encryptionSecret.length < 16 || hmacSecret.length < 16 || keyVersion < 1) {
      throw new Error("NOTIFICATION_CRYPTO_CONFIG_INVALID");
    }
    this.encryptionKey = deriveKey(encryptionSecret, "owner-encryption");
    this.hmacRootKey = deriveKey(hmacSecret, "notification-reply-root");
  }

  createResponseToken(): string {
    return randomBytes(32).toString("base64url");
  }

  async hash(value: string, purpose: "response-token"): Promise<string> {
    const key = createHmac("sha256", this.hmacRootKey)
      .update(`notification-${purpose}`, "utf8")
      .digest();
    return createHmac("sha256", key).update(value, "utf8").digest("hex");
  }

  decryptOwnerPhone(protectedValue: string): string {
    const [version, nonceValue, tagValue, ciphertextValue, extra] = protectedValue.split(".");
    if (
      extra !== undefined ||
      version !== `v${this.keyVersion}` ||
      !nonceValue ||
      !tagValue ||
      !ciphertextValue
    ) {
      throw new Error("NOTIFICATION_DESTINATION_INVALID");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      Buffer.from(nonceValue, "base64url"),
    );
    decipher.setAAD(Buffer.from(`owner:phone:v${this.keyVersion}`, "utf8"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}
