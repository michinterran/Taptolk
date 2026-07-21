import { parseServerEnvironment } from "@taptolk/config";
import {
  NOTIFICATION_PROVIDER_ERROR_CODES,
  type NotificationProviderErrorCode,
} from "@taptolk/domain";
import { NextResponse } from "next/server";
import {
  clearNotificationStagingInbox,
  configureNotificationStagingFailure,
  readNotificationStagingInbox,
} from "../../../../notification-reply/notification-staging-provider";
import { notificationWorkerAuthorized } from "../../../../notification-reply/owner-response-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const environment = parseServerEnvironment();
  return (
    environment.APP_ENV !== "production" &&
    Boolean(
      environment.QUEUE_WORKER_SECRET &&
        notificationWorkerAuthorized(request, environment.QUEUE_WORKER_SECRET),
    )
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  return NextResponse.json(
    { data: readNotificationStagingInbox() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const input = (await request.json()) as { failureCode?: string | null };
  if (
    input.failureCode !== null &&
    !NOTIFICATION_PROVIDER_ERROR_CODES.includes(input.failureCode as NotificationProviderErrorCode)
  ) {
    return NextResponse.json({ error: { code: "INVALID" } }, { status: 400 });
  }
  configureNotificationStagingFailure(
    (input.failureCode as NotificationProviderErrorCode | null) ?? null,
  );
  return NextResponse.json({ data: { configured: true } });
}

export async function DELETE(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  clearNotificationStagingInbox();
  return NextResponse.json({ data: { cleared: true } });
}
