import { randomUUID } from "node:crypto";
import { APP_IDENTITY } from "@taptolk/config";
import { createLogger } from "@taptolk/observability";
import { after, NextResponse } from "next/server";
import {
  parseSolapiDeliveryWebhookPayload,
  solapiWebhookAuthorized,
} from "../../../../notification-reply/solapi-delivery-webhook-handler";
import {
  captureSolapiAccountHealth,
  createSolapiDeliveryReportService,
  readSolapiWebhookConfiguration,
} from "../../../../notification-reply/solapi-operations-runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 10;
export const runtime = "nodejs";

function response(requestId: string, body: Readonly<Record<string, unknown>>, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    status,
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const logger = createLogger({ requestId, service: APP_IDENTITY.serviceNames.web });
  const configuration = readSolapiWebhookConfiguration();
  if (!configuration) {
    logger.warn("solapi.webhook.configuration_unavailable");
    return response(requestId, { error: { code: "UNAVAILABLE" } }, 503);
  }
  if (!solapiWebhookAuthorized(request.headers.get("x-solapi-secret"), configuration.secrets)) {
    logger.warn("solapi.webhook.unauthorized");
    return response(requestId, { error: { code: "UNAUTHORIZED" } }, 401);
  }

  let reports: ReturnType<typeof parseSolapiDeliveryWebhookPayload>;
  try {
    reports = parseSolapiDeliveryWebhookPayload(await request.json());
  } catch {
    logger.warn("solapi.webhook.payload_invalid");
    return response(requestId, { error: { code: "INVALID_PAYLOAD" } }, 400);
  }

  const service = createSolapiDeliveryReportService();
  if (!service) {
    logger.warn("solapi.webhook.repository_unavailable");
    return response(requestId, { error: { code: "UNAVAILABLE" } }, 503);
  }

  try {
    const result = await service.recordBatch(reports);
    logger.info("solapi.webhook.accepted", {
      deliveredCount: result.delivered,
      failedCount: result.failed,
      matchedCount: result.matched,
      pendingCount: result.pending,
      receivedCount: result.received,
      unmatchedCount: result.unmatched,
    });
    after(async () => {
      try {
        const status = await captureSolapiAccountHealth("WEBHOOK");
        if (status === "UNAVAILABLE") logger.warn("solapi.balance.capture_unavailable");
      } catch {
        logger.warn("solapi.balance.capture_failed");
      }
    });
    return response(requestId, { data: result });
  } catch {
    logger.error("solapi.webhook.record_failed", { receivedCount: reports.length });
    return response(requestId, { error: { code: "RECORD_FAILED" } }, 500);
  }
}
