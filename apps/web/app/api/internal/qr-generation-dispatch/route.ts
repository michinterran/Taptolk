import { APP_IDENTITY } from "@taptolk/config";
import { createLogger } from "@taptolk/observability";
import { NextResponse } from "next/server";
import { handleQrGenerationDispatchRequest } from "../../../../internal/qr-generation-dispatch-handler";
import {
  readStagingQrGenerationDispatchConfiguration,
  runStagingQrGenerationDispatch,
} from "../../../../internal/qr-generation-dispatch-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(requestId: string, body: Readonly<Record<string, unknown>>, status: number) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
    status,
  });
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const logger = createLogger({
    requestId,
    service: APP_IDENTITY.serviceNames.web,
  });
  const result = await handleQrGenerationDispatchRequest(
    {
      authorizationHeader: request.headers.get("authorization"),
      requestId,
    },
    {
      readConfiguration: readStagingQrGenerationDispatchConfiguration,
      run: runStagingQrGenerationDispatch,
    },
  );

  if (result.status === 401) {
    logger.warn("qr_generation.dispatch.unauthorized");
  } else if (result.status === 503) {
    logger.warn("qr_generation.dispatch.unavailable", {
      errorCode: "CONFIGURATION_UNAVAILABLE",
    });
  } else if (result.status === 500) {
    logger.error("qr_generation.dispatch.failed", {
      errorCode: "DISPATCH_FAILED",
    });
  }

  return jsonResponse(requestId, result.body, result.status);
}
