import "server-only";

import type { OwnerOtpProvider } from "@taptolk/application";
import { SolapiMessageService } from "solapi";
import { OWNER_ACTIVATION_COPY } from "../content/owner-activation-copy";

export interface SolapiOwnerOtpProviderConfig {
  apiKey: string;
  apiSecret: string;
  from: string;
}

type SolapiOwnerOtpProviderConfigInput = {
  apiKey?: string | undefined;
  apiSecret?: string | undefined;
  from?: string | undefined;
};

type SendOne = (
  message: Parameters<SolapiMessageService["sendOne"]>[0],
) => ReturnType<SolapiMessageService["sendOne"]>;

export function hasSolapiOwnerOtpConfig(
  config: SolapiOwnerOtpProviderConfigInput,
): config is SolapiOwnerOtpProviderConfig {
  return Boolean(config.apiKey && config.apiSecret && config.from);
}

export function buildOwnerOtpText(locale: "en" | "ko", otp: string): string {
  if (!/^[0-9]{6}$/u.test(otp)) {
    throw new Error("OWNER_OTP_INVALID");
  }
  return OWNER_ACTIVATION_COPY[locale].otpMessage.replace("{otp}", otp);
}

export class SolapiOwnerOtpProvider implements OwnerOtpProvider {
  private readonly sendOne: SendOne;

  constructor(
    private readonly config: SolapiOwnerOtpProviderConfig,
    sendOne?: SendOne,
  ) {
    if (!hasSolapiOwnerOtpConfig(config) || !/^[0-9]{8,14}$/u.test(config.from)) {
      throw new Error("SOLAPI_OWNER_OTP_CONFIG_INVALID");
    }
    const service = new SolapiMessageService(config.apiKey, config.apiSecret);
    this.sendOne = sendOne ?? service.sendOne.bind(service);
  }

  async send(input: {
    challengeId: string;
    locale: "en" | "ko";
    otp: string;
    phone: string;
  }): Promise<void> {
    void input.challengeId;
    if (!/^010[0-9]{8}$/u.test(input.phone)) {
      throw new Error("OWNER_OTP_INVALID_RECIPIENT");
    }
    await this.sendOne({
      to: input.phone,
      from: this.config.from,
      text: buildOwnerOtpText(input.locale, input.otp),
      autoTypeDetect: true,
    });
  }
}

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
