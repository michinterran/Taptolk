import "server-only";

import type { OwnerOtpProvider } from "@taptolk/application";

export class StagingMockOwnerOtpProvider implements OwnerOtpProvider {
  async send(): Promise<void> {
    // Deliberately no inbox, log, or persisted raw OTP. Staging acceptance owns
    // the configured six-digit value out-of-band.
  }
}

export class UnavailableOwnerOtpProvider implements OwnerOtpProvider {
  async send(): Promise<never> {
    throw new Error("OWNER_OTP_PROVIDER_UNAVAILABLE");
  }
}
