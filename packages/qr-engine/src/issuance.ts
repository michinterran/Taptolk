import { createCipheriv, createHash, randomBytes } from "node:crypto";

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TOKEN_BYTES = 16;
const DEFAULT_COLLISION_RETRIES = 5;

export const HUMAN_CODE_LENGTH = 10;
export const ACTIVATION_CODE_LENGTH = 8;

export interface EncryptedSecret {
  ciphertext: string;
  keyVersion: number;
}

export interface IssuedQrCredential {
  activationCode: EncryptedSecret & { hash: string };
  humanCode: string;
  publicToken: EncryptedSecret & { hash: string; value: string };
}

export interface QrCredentialGeneratorOptions {
  encryptionKey: Uint8Array;
  keyVersion: number;
  random?: (size: number) => Uint8Array;
}

export class QrIssuanceError extends Error {
  constructor(readonly code: "COLLISION_RETRY_EXHAUSTED" | "INVALID_COUNT" | "INVALID_KEY") {
    super(`QR issuance failed: ${code}`);
    this.name = "QrIssuanceError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Canonical lookup hash for the public credential carried by a QR sticker.
 *
 * The issuance engine persists this value in `qr_assets.public_token_hash`, so
 * every scan entry point must use the exact same policy when looking it up.
 */
export function hashQrPublicToken(value: string): string {
  return sha256(value);
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function encrypt(
  value: string,
  key: Uint8Array,
  keyVersion: number,
  random: (size: number) => Uint8Array,
) {
  const nonce = random(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: [
      `v${keyVersion}`,
      toBase64Url(nonce),
      toBase64Url(cipher.getAuthTag()),
      toBase64Url(encrypted),
    ].join("."),
    keyVersion,
  };
}

function randomCrockford(length: number, random: (size: number) => Uint8Array): string {
  const bytes = random(length);
  let result = "";
  for (const byte of bytes) {
    result += CROCKFORD_ALPHABET.charAt(byte % CROCKFORD_ALPHABET.length);
  }
  return result;
}

function checksum(value: string): string {
  let accumulator = 0;
  for (const character of value) {
    accumulator = (accumulator * 33 + CROCKFORD_ALPHABET.indexOf(character)) % 32;
  }
  return CROCKFORD_ALPHABET.charAt(accumulator);
}

export function createQrCredentialGenerator(options: QrCredentialGeneratorOptions) {
  if (
    options.encryptionKey.byteLength !== 32 ||
    !Number.isInteger(options.keyVersion) ||
    options.keyVersion < 1
  ) {
    throw new QrIssuanceError("INVALID_KEY");
  }
  const random = options.random ?? randomBytes;

  return (): IssuedQrCredential => {
    const token = toBase64Url(random(TOKEN_BYTES));
    const humanData = randomCrockford(HUMAN_CODE_LENGTH - 1, random);
    const humanCode = `${humanData}${checksum(humanData)}`;
    const activationValue = randomCrockford(ACTIVATION_CODE_LENGTH, random);

    return {
      activationCode: {
        ...encrypt(activationValue, options.encryptionKey, options.keyVersion, random),
        hash: sha256(activationValue),
      },
      humanCode,
      publicToken: {
        ...encrypt(token, options.encryptionKey, options.keyVersion, random),
        hash: hashQrPublicToken(token),
        value: token,
      },
    };
  };
}

export function issueQrBatch(
  count: number,
  generate: () => IssuedQrCredential,
  collisionRetries = DEFAULT_COLLISION_RETRIES,
): readonly IssuedQrCredential[] {
  if (!Number.isInteger(count) || count < 1 || count > 10_000) {
    throw new QrIssuanceError("INVALID_COUNT");
  }
  const tokenHashes = new Set<string>();
  const humanCodes = new Set<string>();
  const activationHashes = new Set<string>();
  const issued: IssuedQrCredential[] = [];

  while (issued.length < count) {
    let accepted = false;
    for (let attempt = 0; attempt <= collisionRetries; attempt += 1) {
      const candidate = generate();
      if (
        tokenHashes.has(candidate.publicToken.hash) ||
        humanCodes.has(candidate.humanCode) ||
        activationHashes.has(candidate.activationCode.hash)
      ) {
        continue;
      }
      tokenHashes.add(candidate.publicToken.hash);
      humanCodes.add(candidate.humanCode);
      activationHashes.add(candidate.activationCode.hash);
      issued.push(candidate);
      accepted = true;
      break;
    }
    if (!accepted) {
      throw new QrIssuanceError("COLLISION_RETRY_EXHAUSTED");
    }
  }
  return issued;
}
