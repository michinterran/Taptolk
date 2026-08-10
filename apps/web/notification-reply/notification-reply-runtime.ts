import "server-only";

import {
  NotificationDispatchService,
  OwnerResponseService,
  WebPushNotificationDispatchService,
} from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { requireDevelopmentTestStage } from "@taptolk/config/stage/server";
import { createAdminServiceClient } from "../auth/service-client";
import { NotificationReplyCrypto } from "./notification-reply-crypto";
import {
  StagingOwnerNotificationProvider,
  UnavailableOwnerNotificationProvider,
} from "./notification-staging-provider";
import { hasSolapiSmsConfig, SolapiSmsNotificationProvider } from "./solapi-sms-provider";
import {
  createSupabaseNotificationDeliveryRepository,
  createSupabaseOwnerResponseRepository,
  createSupabaseWebPushDeliveryRepository,
} from "./supabase-notification-reply-repository";
import { hasWebPushConfig, VapidWebPushNotificationProvider } from "./web-push-provider";

function dependencies() {
  const environment = parseServerEnvironment();
  const client = createAdminServiceClient();
  if (
    !client ||
    !environment.APP_ENCRYPTION_KEY_V1 ||
    !environment.TOKEN_HMAC_KEY ||
    !environment.OWNER_RESPONSE_BASE_URL
  ) {
    return null;
  }
  const crypto = new NotificationReplyCrypto(
    environment.APP_ENCRYPTION_KEY_V1,
    environment.TOKEN_HMAC_KEY,
    environment.APP_ENCRYPTION_KEY_VERSION,
  );
  return { client, crypto, environment };
}

export function createNotificationDispatchService(): NotificationDispatchService | null {
  const value = dependencies();
  if (!value) {
    return null;
  }
  const solapiConfig = {
    apiKey: value.environment.SOLAPI_API_KEY,
    apiSecret: value.environment.SOLAPI_API_SECRET,
    from: value.environment.SOLAPI_SMS_FROM,
  };
  const provider =
    value.environment.OWNER_NOTIFICATION_PROVIDER === "mock"
      ? createStagingProvider(value.crypto)
      : value.environment.OWNER_NOTIFICATION_PROVIDER === "solapi-sms" &&
          hasSolapiSmsConfig(solapiConfig)
        ? new SolapiSmsNotificationProvider(solapiConfig, value.crypto)
        : new UnavailableOwnerNotificationProvider();
  return new NotificationDispatchService(
    createSupabaseNotificationDeliveryRepository({
      baseUrl: value.environment.OWNER_RESPONSE_BASE_URL as string,
      client: value.client,
      hasher: value.crypto,
      secrets: value.crypto,
    }),
    provider,
  );
}

function createStagingProvider(crypto: NotificationReplyCrypto) {
  try {
    requireDevelopmentTestStage();
    return new StagingOwnerNotificationProvider(crypto);
  } catch {
    return new UnavailableOwnerNotificationProvider();
  }
}

export function createWebPushNotificationDispatchService(): WebPushNotificationDispatchService | null {
  const value = dependencies();
  if (!value) {
    return null;
  }
  const webPushConfig = {
    privateKey: value.environment.OWNER_WEB_PUSH_VAPID_PRIVATE_KEY,
    publicKey: value.environment.OWNER_WEB_PUSH_VAPID_PUBLIC_KEY,
    subject: value.environment.OWNER_WEB_PUSH_VAPID_SUBJECT,
  };
  if (!hasWebPushConfig(webPushConfig)) {
    return null;
  }
  return new WebPushNotificationDispatchService(
    createSupabaseWebPushDeliveryRepository({
      baseUrl: value.environment.OWNER_RESPONSE_BASE_URL as string,
      client: value.client,
    }),
    new VapidWebPushNotificationProvider(webPushConfig),
  );
}

export function createOwnerResponseService(): OwnerResponseService | null {
  const value = dependencies();
  return value
    ? new OwnerResponseService(
        createSupabaseOwnerResponseRepository(value.client),
        value.crypto,
        value.environment.RESPONSE_TOKEN_TTL_MINUTES * 60,
      )
    : null;
}

export function readNotificationWorkerSecret(): string | null {
  try {
    return parseServerEnvironment().QUEUE_WORKER_SECRET ?? null;
  } catch {
    return null;
  }
}
