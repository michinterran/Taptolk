import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseSolapiDeliveryWebhookPayload,
  solapiWebhookAuthorized,
} from "./solapi-delivery-webhook-handler";

describe("SOLAPI delivery webhook handler", () => {
  it("uses the provider SHA-1 header contract without comparing the raw secret", () => {
    const secret = "webhook-secret-value";
    const hash = createHash("sha1").update(secret).digest("hex");
    expect(solapiWebhookAuthorized(hash, secret)).toBe(true);
    expect(solapiWebhookAuthorized("0".repeat(40), secret)).toBe(false);
    expect(solapiWebhookAuthorized(null, secret)).toBe(false);
  });

  it("keeps only delivery identity, result, time, and the redacted correlation key", () => {
    const report = parseSolapiDeliveryWebhookPayload([
      {
        customFields: { taptolkDeliveryKey: "a".repeat(64) },
        dateReceived: "2026-08-15T01:10:01.000Z",
        dateReported: "2026-08-15T01:10:02.000Z",
        from: "sensitive-sender",
        messageId: "message_12345678",
        statusCode: "4000",
        statusMessage: "must not persist",
        text: "must not persist",
        to: "sensitive-recipient",
      },
    ])[0];

    expect(report).toEqual({
      idempotencyKey: "a".repeat(64),
      providerMessageId: "message_12345678",
      providerReceivedAt: "2026-08-15T01:10:01.000Z",
      providerReportedAt: "2026-08-15T01:10:02.000Z",
      statusCode: "4000",
    });
    expect(Object.keys(report ?? {})).not.toEqual(expect.arrayContaining(["from", "text", "to"]));
  });

  it("rejects an oversized or malformed payload", () => {
    expect(() => parseSolapiDeliveryWebhookPayload([])).toThrow("SOLAPI_WEBHOOK_PAYLOAD_INVALID");
    expect(() =>
      parseSolapiDeliveryWebhookPayload([
        { dateReported: "not-a-date", messageId: "message_12345678", statusCode: "4000" },
      ]),
    ).toThrow("SOLAPI_WEBHOOK_PAYLOAD_INVALID");
  });
});
