import "server-only";

import { createHash } from "node:crypto";
import type {
  NotificationDeliveryClaim,
  NotificationDeliveryRepository,
  NotificationHasher,
  NotificationSecretFactory,
  OwnerResponseInspection,
  OwnerResponseRepository,
  WebPushDeliveryClaim,
  WebPushDeliveryRepository,
} from "@taptolk/application";
import { CONTACT_REASON_CODES, type ContactReasonCode } from "@taptolk/domain";
import type { createAdminServiceClient } from "../auth/service-client";

type ServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
  }
  return value;
}

function assertResult(result: { data: unknown; error: unknown }): unknown {
  if (result.error) {
    throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
  }
  return result.data;
}

export function createSupabaseNotificationDeliveryRepository(input: {
  baseUrl: string;
  client: ServiceClient;
  hasher: NotificationHasher;
  secrets: NotificationSecretFactory;
}): NotificationDeliveryRepository {
  return {
    async claim(claimInput): Promise<readonly NotificationDeliveryClaim[]> {
      const data = assertResult(
        await input.client.rpc("claim_notification_deliveries", {
          p_lease_seconds: claimInput.leaseSeconds,
          p_limit: claimInput.limit,
          p_worker_id: claimInput.workerId,
        }),
      );
      if (!Array.isArray(data)) {
        throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
      }
      const claims: NotificationDeliveryClaim[] = [];
      for (const value of data) {
        const claimed = row(value);
        const deliveryId = text(claimed.delivery_id);
        const leaseVersion = claimed.lease_version;
        if (typeof leaseVersion !== "number") {
          throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
        }
        const responseToken = input.secrets.createResponseToken();
        const tokenHash = await input.hasher.hash(responseToken, "response-token");
        assertResult(
          await input.client.rpc("attach_notification_response_token", {
            p_delivery_id: deliveryId,
            p_lease_version: leaseVersion,
            p_token_hash: tokenHash,
            p_ttl_seconds: 3_600,
            p_worker_id: claimInput.workerId,
          }),
        );
        const responseUrl = `${input.baseUrl.replace(/\/$/u, "")}/ko/respond/${responseToken}`;
        const reasonCode = text(claimed.reason_code);
        if (!CONTACT_REASON_CODES.includes(reasonCode as ContactReasonCode)) {
          throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
        }
        claims.push({
          deliveryId,
          destinationCiphertext: text(claimed.destination_ciphertext),
          idempotencyKey: text(claimed.idempotency_key),
          leaseVersion,
          notification: {
            locale: "ko",
            templateKey: "OWNER_CONTACT_REQUEST_V1",
            variables: {
              reasonCode: reasonCode as ContactReasonCode,
              responseUrl,
            },
          },
        });
      }
      return claims;
    },
    async fail(failure): Promise<void> {
      assertResult(
        await input.client.rpc("record_notification_failure", {
          p_delivery_id: failure.deliveryId,
          p_error_code: failure.errorCode,
          p_final: failure.final,
          p_lease_version: failure.leaseVersion,
          p_next_attempt_at: failure.nextAttemptAt,
          p_worker_id: failure.workerId,
        }),
      );
    },
    async sent(sentInput): Promise<void> {
      assertResult(
        await input.client.rpc("record_notification_sent", {
          p_delivery_id: sentInput.deliveryId,
          p_lease_version: sentInput.leaseVersion,
          p_provider_message_id: sentInput.providerMessageId,
          p_worker_id: sentInput.workerId,
        }),
      );
    },
  };
}

function subscription(value: unknown): WebPushDeliveryClaim["subscription"] {
  const data = row(value);
  const keys = row(data.keys);
  const expirationTime = data.expirationTime;
  if (expirationTime !== null && typeof expirationTime !== "number") {
    throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
  }
  return {
    endpoint: text(data.endpoint),
    expirationTime,
    keys: {
      auth: text(keys.auth),
      p256dh: text(keys.p256dh),
    },
  };
}

export function createSupabaseWebPushDeliveryRepository(input: {
  baseUrl: string;
  client: ServiceClient;
}): WebPushDeliveryRepository {
  return {
    async claim(claimInput): Promise<readonly WebPushDeliveryClaim[]> {
      const data = assertResult(
        await input.client.rpc("claim_web_push_notification_deliveries", {
          p_lease_seconds: claimInput.leaseSeconds,
          p_limit: claimInput.limit,
          p_worker_id: claimInput.workerId,
        }),
      );
      if (!Array.isArray(data)) {
        throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
      }
      const claims: WebPushDeliveryClaim[] = [];
      for (const value of data) {
        const claimed = row(value);
        const deliveryId = text(claimed.delivery_id);
        const leaseVersion = claimed.lease_version;
        if (typeof leaseVersion !== "number") {
          throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
        }
        const responseUrl = `${input.baseUrl.replace(/\/$/u, "")}/ko/owner`;
        const reasonCode = text(claimed.reason_code);
        if (!CONTACT_REASON_CODES.includes(reasonCode as ContactReasonCode)) {
          throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
        }
        claims.push({
          deliveryId,
          idempotencyKey: text(claimed.idempotency_key),
          leaseVersion,
          notification: {
            locale: "ko",
            templateKey: "OWNER_CONTACT_REQUEST_V1",
            variables: {
              reasonCode: reasonCode as ContactReasonCode,
              responseUrl,
            },
          },
          subscription: subscription(claimed.subscription),
        });
      }
      return claims;
    },
    async fail(failure): Promise<void> {
      assertResult(
        await input.client.rpc("record_notification_failure", {
          p_delivery_id: failure.deliveryId,
          p_error_code: failure.errorCode,
          p_final: failure.final,
          p_lease_version: failure.leaseVersion,
          p_next_attempt_at: failure.nextAttemptAt,
          p_worker_id: failure.workerId,
        }),
      );
    },
    async sent(sentInput): Promise<void> {
      assertResult(
        await input.client.rpc("record_notification_sent", {
          p_delivery_id: sentInput.deliveryId,
          p_lease_version: sentInput.leaseVersion,
          p_provider_message_id: sentInput.providerMessageId,
          p_worker_id: sentInput.workerId,
        }),
      );
    },
  };
}

export function createSupabaseOwnerResponseRepository(
  client: ServiceClient,
): OwnerResponseRepository {
  return {
    async inspect(input): Promise<OwnerResponseInspection> {
      const result = row(
        assertResult(
          await client.rpc("inspect_owner_response", {
            p_token_hash: input.responseTokenHash,
          }),
        ),
      );
      return {
        callerMessage: text(result.caller_message),
        expiresAt: text(result.expires_at),
        reasonCode: text(result.reason_code),
        siteDisplayName: text(result.site_display_name),
        vehiclePlateLast4: text(result.vehicle_plate_last4),
      };
    },
    async reply(input): Promise<{ status: "OWNER_REPLIED" }> {
      const effectiveBody = input.body ?? input.replyCode;
      const result = row(
        assertResult(
          await client.rpc("submit_owner_response", {
            p_body: input.body,
            p_body_hash: createHash("sha256").update(effectiveBody, "utf8").digest("hex"),
            p_reply_code: input.replyCode,
            p_token_hash: input.responseTokenHash,
          }),
        ),
      );
      if (result.status !== "OWNER_REPLIED") {
        throw new Error("NOTIFICATION_REPOSITORY_UNAVAILABLE");
      }
      return { status: "OWNER_REPLIED" };
    },
  };
}
