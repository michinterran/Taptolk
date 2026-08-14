import type { ServerEnvironment } from "@taptolk/config";

export interface QrCredentialEncryptionConfiguration {
  keyVersion: 1 | 2;
  secret: string;
}

type QrCredentialEncryptionEnvironment = Pick<
  ServerEnvironment,
  "APP_ENCRYPTION_KEY_V1" | "APP_ENCRYPTION_KEY_VERSION" | "QR_CREDENTIAL_ENCRYPTION_KEY_V2"
>;

/**
 * QR credentials have their own rotation boundary. A dedicated v2 key lets a
 * separately hosted worker issue new credentials without replacing the v1 key
 * that still protects existing owner, vehicle, and QR records.
 */
export function resolveQrCredentialEncryption(
  environment: QrCredentialEncryptionEnvironment,
): QrCredentialEncryptionConfiguration | null {
  if (environment.QR_CREDENTIAL_ENCRYPTION_KEY_V2) {
    return {
      keyVersion: 2,
      secret: environment.QR_CREDENTIAL_ENCRYPTION_KEY_V2,
    };
  }
  if (environment.APP_ENCRYPTION_KEY_V1 && environment.APP_ENCRYPTION_KEY_VERSION === 1) {
    return {
      keyVersion: 1,
      secret: environment.APP_ENCRYPTION_KEY_V1,
    };
  }
  return null;
}
