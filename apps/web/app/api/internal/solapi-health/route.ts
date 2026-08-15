import { randomUUID } from "node:crypto";
import { APP_IDENTITY } from "@taptolk/config";
import { createLogger } from "@taptolk/observability";
import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "../../../../internal/cron-authorization";
import { readScheduledNotificationDispatchConfiguration } from "../../../../notification-reply/notification-reply-runtime";
import { captureSolapiAccountHealth } from "../../../../notification-reply/solapi-operations-runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = randomUUID();
  const logger = createLogger({ requestId, service: APP_IDENTITY.serviceNames.web });
  const configuration = readScheduledNotificationDispatchConfiguration();
  if (!configuration) {
    logger.warn("solapi.balance.configuration_unavailable");
    return NextResponse.json({ error: { code: "UNAVAILABLE" } }, { status: 503 });
  }
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), configuration.cronSecret)) {
    logger.warn("solapi.balance.unauthorized");
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  try {
    const status = await captureSolapiAccountHealth("CRON");
    if (status === "UNAVAILABLE") logger.warn("solapi.balance.capture_unavailable");
    return NextResponse.json(
      { data: { status } },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch {
    logger.error("solapi.balance.capture_failed");
    return NextResponse.json({ error: { code: "CAPTURE_FAILED" } }, { status: 500 });
  }
}
