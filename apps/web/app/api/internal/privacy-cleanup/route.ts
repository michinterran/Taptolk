import { APP_IDENTITY } from "@taptolk/config";
import { createLogger } from "@taptolk/observability";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handlePrivacyCleanupRequest } from "../../../../internal/privacy-cleanup-handler";
import {
  readPrivacyCleanupConfiguration,
  runPrivacyCleanup,
} from "../../../../internal/privacy-cleanup-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ tenantId: z.string().uuid() }).strict();

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
