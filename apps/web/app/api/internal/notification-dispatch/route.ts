import { randomUUID } from "node:crypto";
import { APP_IDENTITY } from "@taptolk/config";
import { createLogger } from "@taptolk/observability";
import { NextResponse } from "next/server";
import { handleScheduledNotificationDispatchRequest } from "../../../../internal/scheduled-notification-dispatch-handler";
import {
  NotificationDispatchUnavailableError,
  runNotificationDispatchBatch,
} from "../../../../notification-reply/notification-dispatch-runner";
import {
  readNotificationWorkerSecret,
  readScheduledNotificationDispatchConfiguration,
} from "../../../../notification-reply/notification-reply-runtime";
import { notificationWorkerAuthorized } from "../../../../notification-reply/owner-response-route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

function response(requestId: string, body: Readonly<Record<string, unknown>>, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    status,
  });
}

export async function GET(request: Request) {
  const requestId = randomUUID();
  const result = await handleScheduledNotificationDispatchRequest(
    {
      authorizationHeader: request.headers.get("authorization"),
      requestId,
    },
    {
      readConfiguration: readScheduledNotificationDispatchConfiguration,
      run: async (id) => runNotificationDispatchBatch({ workerId: `cron-${id}` }),
    },
  );
  if (result.status !== 200) {
    createLogger({ requestId, service: APP_IDENTITY.serviceNames.web }).warn(
      "notification_dispatch.cron_failed",
      { errorCode: result.status },
    );
  }
  return response(requestId, result.body, result.status);
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const secret = readNotificationWorkerSecret();
  if (!secret || !notificationWorkerAuthorized(request, secret)) {
    return response(requestId, { error: { code: "UNAUTHORIZED" }, meta: { requestId } }, 401);
  }
  try {
    return response(requestId, {
      data: await runNotificationDispatchBatch({ workerId: `manual-${requestId}` }),
      meta: { requestId },
    });
  } catch (error) {
    if (error instanceof NotificationDispatchUnavailableError) {
      return response(requestId, { error: { code: "UNAVAILABLE" }, meta: { requestId } }, 503);
    }
    return response(requestId, { error: { code: "DISPATCH_FAILED" }, meta: { requestId } }, 500);
  }
}
