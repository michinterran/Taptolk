import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createNotificationDispatchService,
  readNotificationWorkerSecret,
} from "../../../../notification-reply/notification-reply-runtime";
import { readNotificationStagingInbox } from "../../../../notification-reply/notification-staging-provider";
import { notificationWorkerAuthorized } from "../../../../notification-reply/owner-response-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const secret = readNotificationWorkerSecret();
  if (!secret || !notificationWorkerAuthorized(request, secret)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED" }, meta: { requestId } },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }
  const service = createNotificationDispatchService();
  if (!service) {
    return NextResponse.json(
      { error: { code: "UNAVAILABLE" }, meta: { requestId } },
      { headers: { "Cache-Control": "no-store" }, status: 503 },
    );
  }
  try {
    const result = await service.run({
      leaseSeconds: 30,
      limit: 10,
      workerId: `web-${requestId}`,
    });
    return NextResponse.json(
      {
        data: {
          ...result,
          stagingInbox: readNotificationStagingInbox(),
        },
        meta: { requestId },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: { code: "DISPATCH_FAILED" }, meta: { requestId } },
      { headers: { "Cache-Control": "no-store" }, status: 500 },
    );
  }
}
