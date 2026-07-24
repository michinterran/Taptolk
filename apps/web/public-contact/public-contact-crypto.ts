import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import type {
  PublicContactHasher,
  PublicContactHashPurpose,
  PublicContactSecretFactory,
} from "@taptolk/application";

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

export class HmacPublicContactHasher implements PublicContactHasher {
  private readonly ownerRootKey: Buffer;
  private readonly publicContactRootKey: Buffer;

  constructor(secret: string) {
    if (secret.length < 16) {
      throw new Error("PUBLIC_CONTACT_HASH_CONFIG_INVALID");
    }
    this.ownerRootKey = createHash("sha256").update(`owner-hmac-root\0${secret}`, "utf8").digest();
    this.publicContactRootKey = createHash("sha256")
      .update(`public-contact-root\0${secret}`, "utf8")
      .digest();
  }

  async hash(value: string, purpose: PublicContactHashPurpose): Promise<string> {
    const rootKey = purpose === "public-token" ? this.ownerRootKey : this.publicContactRootKey;
    const purposePrefix = purpose === "public-token" ? "owner" : "public-contact";
    const purposeKey = createHmac("sha256", rootKey)
      .update(`${purposePrefix}-${purpose}`, "utf8")
      .digest();
    return createHmac("sha256", purposeKey).update(value, "utf8").digest("hex");
  }
}

export class RandomPublicContactSecretFactory implements PublicContactSecretFactory {
  createSessionToken(): string {
    return base64Url(randomBytes(32));
  }
}

export function createPublicContactAnonymousToken(): string {
  return base64Url(randomBytes(32));
}
