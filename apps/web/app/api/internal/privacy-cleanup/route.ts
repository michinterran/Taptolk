import { APP_IDENTITY } from "@taptolk/config";
import { createLogger } from "@taptolk/observability";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handlePrivacyCleanupRequest } from "../../../../internal/privacy-cleanup-handler";
import {
  readPrivacyCleanupConfiguration,
  readScheduledPrivacyCleanupConfiguration,
  runPrivacyCleanup,
  runScheduledPrivacyCleanup,
} from "../../../../internal/privacy-cleanup-runtime";
import { handleScheduledPrivacyCleanupRequest } from "../../../../internal/scheduled-privacy-cleanup-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

const bodySchema = z.object({ tenantId: z.string().uuid() }).strict();

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const logger = createLogger({ requestId, service: APP_IDENTITY.serviceNames.web });
  const result = await handleScheduledPrivacyCleanupRequest(
    {
      authorizationHeader: request.headers.get("authorization"),
      requestId,
    },
    {
      readConfiguration: readScheduledPrivacyCleanupConfiguration,
      run: runScheduledPrivacyCleanup,
    },
  );
  if (result.status !== 200) {
    const data =
      result.body.data && typeof result.body.data === "object"
        ? (result.body.data as Record<string, unknown>)
        : {};
    logger.warn("scheduled_privacy_cleanup.request_failed", {
      errorCode: result.status,
      failedTenantCount:
        typeof data.failedTenantCount === "number" ? data.failedTenantCount : undefined,
    });
  }
  return NextResponse.json(result.body, {
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    status: result.status,
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const logger = createLogger({ requestId, service: APP_IDENTITY.serviceNames.web });
  let tenantId = "";
  try {
    tenantId = bodySchema.parse(await request.json()).tenantId;
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION", retryable: false }, meta: { requestId } },
      { headers: { "Cache-Control": "no-store" }, status: 400 },
    );
  }
  const result = await handlePrivacyCleanupRequest(
    {
      authorizationHeader: request.headers.get("authorization"),
      requestId,
      tenantId,
    },
    {
      readConfiguration: readPrivacyCleanupConfiguration,
      run: runPrivacyCleanup,
    },
  );
  if (result.status !== 200) {
    logger.warn("privacy_cleanup.request_failed", { errorCode: result.status });
  }
  return NextResponse.json(result.body, {
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    status: result.status,
  });
}
