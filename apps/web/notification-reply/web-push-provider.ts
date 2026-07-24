import "server-only";

import { createHash } from "node:crypto";
import {
  OwnerNotificationProviderError,
  type WebPushNotificationProvider,
} from "@taptolk/application";
import type { ContactReasonCode } from "@taptolk/domain";
import webPush from "web-push";
import { PUBLIC_CONTACT_COPY } from "../content/public-contact-copy";

interface WebPushProviderConfig {
  privateKey: string;
  publicKey: string;
  subject: string;
}

export function hasWebPushConfig(input: {
  privateKey: string | undefined;
  publicKey: string | undefined;
  subject: string | undefined;
}): input is WebPushProviderConfig {
  return Boolean(input.privateKey && input.publicKey && input.subject);
}

export class VapidWebPushNotificationProvider implements WebPushNotificationProvider {
  constructor(config: WebPushProviderConfig) {
    webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  }

  async send(input: Parameters<WebPushNotificationProvider["send"]>[0]) {
    if (input.notification.templateKey !== "OWNER_CONTACT_REQUEST_V1") {
      throw new OwnerNotificationProviderError("PERMANENT_FAILURE");
    }
    const reasonCode = input.notification.variables.reasonCode as ContactReasonCode;
    const copy = PUBLIC_CONTACT_COPY[input.notification.locale];
    try {
      await webPush.sendNotification(
        input.subscription,
        JSON.stringify({
          body: copy.reasonLabels[reasonCode],
          tag: `owner-contact-${input.idempotencyKey}`,
          title: input.notification.locale === "ko" ? "새 차량 연락" : "New vehicle request",
          url: input.notification.variables.responseUrl,
        }),
      );
      return {
        providerMessageId: createHash("sha256")
          .update(`web-push:${input.idempotencyKey}`, "utf8")
          .digest("hex"),
      };
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode: unknown }).statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        throw new OwnerNotificationProviderError("INVALID_RECIPIENT");
      }
      if (statusCode === 401 || statusCode === 403) {
        throw new OwnerNotificationProviderError("AUTH_ERROR");
      }
      throw new OwnerNotificationProviderError("TEMPORARY_FAILURE");
    }
  }
}
