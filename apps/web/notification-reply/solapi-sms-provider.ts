import "server-only";

import {
  type OwnerContactNotification,
  type OwnerNotificationProvider,
  OwnerNotificationProviderError,
} from "@taptolk/application";
import type { NotificationProviderErrorCode } from "@taptolk/domain";
import { SolapiMessageService } from "solapi";
import { PUBLIC_CONTACT_COPY } from "../content/public-contact-copy";
import type { NotificationReplyCrypto } from "./notification-reply-crypto";

export interface SolapiSmsNotificationProviderConfig {
  apiKey: string;
  apiSecret: string;
  from: string;
}

type SolapiSmsNotificationProviderConfigInput = {
  apiKey?: string | undefined;
  apiSecret?: string | undefined;
  from?: string | undefined;
};

type SendOne = (
  message: Parameters<SolapiMessageService["sendOne"]>[0],
) => ReturnType<SolapiMessageService["sendOne"]>;

export function hasSolapiSmsConfig(
  config: SolapiSmsNotificationProviderConfigInput,
): config is SolapiSmsNotificationProviderConfig {
  return Boolean(config.apiKey && config.apiSecret && config.from);
}

export function buildOwnerSmsText(notification: OwnerContactNotification): string {
  const copy = PUBLIC_CONTACT_COPY[notification.locale];
  const reason =
    copy.templateMessages[notification.variables.reasonCode] || copy.ownerNotificationFallback;
  return [
    copy.ownerNotificationTitle,
    reason,
    `${copy.ownerNotificationLinkLabel}: ${notification.variables.responseUrl}`,
  ].join("\n");
}

function readErrorField(error: unknown, key: string): string | number | undefined {
  if (!error || typeof error !== "object" || !(key in error)) {
    return undefined;
  }
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function classifySolapiError(error: unknown): NotificationProviderErrorCode {
  const status = readErrorField(error, "httpStatus");
  const errorCode = String(readErrorField(error, "errorCode") ?? "").toUpperCase();
  const statusNumber = typeof status === "number" ? status : Number(status);

  if (
    statusNumber === 401 ||
    statusNumber === 403 ||
    /AUTH|API.?KEY|SIGNATURE|TOKEN/u.test(errorCode)
  ) {
    return "AUTH_ERROR";
  }
  if (statusNumber === 429 || /RATE|LIMIT|THROTTL/u.test(errorCode)) {
    return "RATE_LIMIT";
  }
  if (
    /RECIPIENT|PHONE|NUMBER|INVALID_TO|INVALID_RECIPIENT/u.test(errorCode) ||
    statusNumber === 422
  ) {
    return "INVALID_RECIPIENT";
  }
  if (
    statusNumber === 408 ||
    statusNumber >= 500 ||
    /TIMEOUT|NETWORK|TEMPORARY|UNAVAILABLE|CONNECTION/u.test(errorCode)
  ) {
    return "TEMPORARY_FAILURE";
  }
  if (statusNumber >= 400) {
    return "PERMANENT_FAILURE";
  }
  return "UNKNOWN";
}

function providerMessageId(result: Awaited<ReturnType<SendOne>>): string {
  if (typeof result.messageId === "string" && /^[A-Za-z0-9_-]{8,200}$/u.test(result.messageId)) {
    return result.messageId;
  }
  if (typeof result.groupId === "string" && /^[A-Za-z0-9_-]{8,200}$/u.test(result.groupId)) {
    return result.groupId;
  }
  throw new OwnerNotificationProviderError("UNKNOWN");
}

export class SolapiSmsNotificationProvider implements OwnerNotificationProvider {
  private readonly sendOne: SendOne;

  constructor(
    private readonly config: SolapiSmsNotificationProviderConfig,
    private readonly crypto: Pick<NotificationReplyCrypto, "decryptOwnerPhone">,
    sendOne?: SendOne,
  ) {
    if (!hasSolapiSmsConfig(config) || !/^[0-9]{8,14}$/u.test(config.from)) {
      throw new Error("SOLAPI_SMS_CONFIG_INVALID");
    }
    const service = new SolapiMessageService(config.apiKey, config.apiSecret);
    this.sendOne = sendOne ?? service.sendOne.bind(service);
  }

  async send(input: {
    idempotencyKey: string;
    notification: OwnerContactNotification;
    toCiphertext: string;
  }): Promise<{ providerMessageId: string }> {
    let destination: string;
    try {
      destination = this.crypto.decryptOwnerPhone(input.toCiphertext);
    } catch {
      throw new OwnerNotificationProviderError("INVALID_RECIPIENT");
    }
    if (!/^010[0-9]{8}$/u.test(destination)) {
      throw new OwnerNotificationProviderError("INVALID_RECIPIENT");
    }

    try {
      const result = await this.sendOne({
        to: destination,
        from: this.config.from,
        text: buildOwnerSmsText(input.notification),
        autoTypeDetect: true,
        customFields: { taptolkDeliveryKey: input.idempotencyKey },
      });
      return { providerMessageId: providerMessageId(result) };
    } catch (error) {
      if (error instanceof OwnerNotificationProviderError) {
        throw error;
      }
      throw new OwnerNotificationProviderError(classifySolapiError(error));
    }
  }
}
