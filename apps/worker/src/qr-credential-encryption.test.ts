import { describe, expect, it } from "vitest";
import { resolveQrCredentialEncryption } from "./qr-credential-encryption.js";

describe("resolveQrCredentialEncryption", () => {
  it("prefers the dedicated v2 key without replacing the legacy v1 key", () => {
    expect(
      resolveQrCredentialEncryption({
        APP_ENCRYPTION_KEY_V1: "legacy-secret-value-that-remains-stable",
        APP_ENCRYPTION_KEY_VERSION: 1,
        QR_CREDENTIAL_ENCRYPTION_KEY_V2: "worker-secret-value-for-version-two",
      }),
    ).toEqual({
      keyVersion: 2,
      secret: "worker-secret-value-for-version-two",
    });
  });

  it("keeps the existing v1 configuration as a compatible fallback", () => {
    expect(
      resolveQrCredentialEncryption({
        APP_ENCRYPTION_KEY_V1: "legacy-secret-value-that-remains-stable",
        APP_ENCRYPTION_KEY_VERSION: 1,
        QR_CREDENTIAL_ENCRYPTION_KEY_V2: undefined,
      }),
    ).toEqual({
      keyVersion: 1,
      secret: "legacy-secret-value-that-remains-stable",
    });
  });

  it("fails closed when neither a dedicated v2 key nor a valid v1 key is available", () => {
    expect(
      resolveQrCredentialEncryption({
        APP_ENCRYPTION_KEY_V1: undefined,
        APP_ENCRYPTION_KEY_VERSION: 1,
        QR_CREDENTIAL_ENCRYPTION_KEY_V2: undefined,
      }),
    ).toBeNull();
    expect(
      resolveQrCredentialEncryption({
        APP_ENCRYPTION_KEY_V1: "legacy-secret-value-that-remains-stable",
        APP_ENCRYPTION_KEY_VERSION: 2,
        QR_CREDENTIAL_ENCRYPTION_KEY_V2: undefined,
      }),
    ).toBeNull();
  });
});
