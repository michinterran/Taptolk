import "server-only";

import { createCipheriv, createHash, randomBytes } from "node:crypto";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(`management-company-contact\0${secret}`, "utf8").digest();
}

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

export function protectManagementCompanyPhone(
  value: string,
  input: { encryptionSecret: string; keyVersion: number },
): string {
  if (input.encryptionSecret.length < 16 || input.keyVersion < 1) {
    throw new Error("MANAGEMENT_COMPANY_CONTACT_PROTECTION_CONFIG_INVALID");
  }
  const normalized = value.replaceAll(/[\s-]/gu, "");
  if (normalized.length === 0) {
    return "";
  }
  if (!/^[0-9]{8,15}$/u.test(normalized)) {
    throw new Error("MANAGEMENT_COMPANY_CONTACT_PHONE_INVALID");
  }
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(input.encryptionSecret), nonce);
  cipher.setAAD(Buffer.from(`management-company-contact:v${input.keyVersion}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  return [
    `v${input.keyVersion}`,
    base64Url(nonce),
    base64Url(cipher.getAuthTag()),
    base64Url(ciphertext),
  ].join(".");
}
