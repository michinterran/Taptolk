import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { ProtectedVehiclePlate, VehiclePlateProtector } from "@taptolk/application";

function deriveKey(secret: string, purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}\0${secret}`, "utf8").digest();
}

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

export class AesGcmVehiclePlateProtector implements VehiclePlateProtector {
  private readonly encryptionKey: Buffer;
  private readonly lookupKey: Buffer;

  constructor(
    encryptionSecret: string,
    lookupSecret: string,
    private readonly keyVersion = 1,
    private readonly random: (size: number) => Uint8Array = randomBytes,
  ) {
    if (encryptionSecret.length < 16 || lookupSecret.length < 16 || keyVersion < 1) {
      throw new Error("VEHICLE_PLATE_PROTECTION_CONFIG_INVALID");
    }
    this.encryptionKey = deriveKey(encryptionSecret, "vehicle-plate-encryption");
    this.lookupKey = deriveKey(lookupSecret, "vehicle-plate-lookup");
  }

  async protect(normalizedPlate: string): Promise<ProtectedVehiclePlate> {
    const nonce = this.random(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(normalizedPlate, "utf8"), cipher.final()]);
    return {
      ciphertext: [
        `v${this.keyVersion}`,
        base64Url(nonce),
        base64Url(cipher.getAuthTag()),
        base64Url(ciphertext),
      ].join("."),
      keyVersion: this.keyVersion,
      last4: normalizedPlate.slice(-4),
      lookupHash: createHmac("sha256", this.lookupKey)
        .update(normalizedPlate, "utf8")
        .digest("hex"),
    };
  }
}
