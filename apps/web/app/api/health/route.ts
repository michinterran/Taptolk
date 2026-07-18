import { APP_IDENTITY } from "@taptolk/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const requestId = crypto.randomUUID();

  return NextResponse.json(
    {
      data: {
        service: APP_IDENTITY.serviceNames.web,
        status: "ready",
      },
      meta: {
        requestId,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}
