import { createHash, timingSafeEqual } from "node:crypto";
import type { SolapiDeliveryReport } from "@taptolk/application";
import { z } from "zod";

const PROVIDER_MESSAGE_PATTERN = /^[A-Za-z0-9_-]{8,200}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{64}$/u;

const eventSchema = z.object({
  customFields: z.record(z.string(), z.unknown()).optional(),
  dateReceived: z.string().nullable().optional(),
  dateReported: z.string(),
  messageId: z.string().regex(PROVIDER_MESSAGE_PATTERN),
  statusCode: z.string().regex(/^[0-9]{4}$/u),
});

const payloadSchema = z.array(eventSchema).min(1).max(100);

function isoDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error("SOLAPI_WEBHOOK_PAYLOAD_INVALID");
  }
  return parsed.toISOString();
}

export function solapiWebhookAuthorized(receivedHash: string | null, secret: string): boolean {
  if (!receivedHash || !/^[0-9a-f]{40}$/iu.test(receivedHash)) {
    return false;
  }
  const expected = Buffer.from(createHash("sha1").update(secret, "utf8").digest("hex"), "utf8");
  const received = Buffer.from(receivedHash.toLowerCase(), "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function parseSolapiDeliveryWebhookPayload(value: unknown): readonly SolapiDeliveryReport[] {
  const parsed = payloadSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("SOLAPI_WEBHOOK_PAYLOAD_INVALID");
  }
  return parsed.data.map((event) => {
    const idempotencyValue = event.customFields?.taptolkDeliveryKey;
    const idempotencyKey =
      typeof idempotencyValue === "string" && IDEMPOTENCY_KEY_PATTERN.test(idempotencyValue)
        ? idempotencyValue
        : null;
    return {
      idempotencyKey,
      providerMessageId: event.messageId,
      providerReceivedAt: event.dateReceived ? isoDate(event.dateReceived) : null,
      providerReportedAt: isoDate(event.dateReported),
      statusCode: event.statusCode,
    };
  });
}
