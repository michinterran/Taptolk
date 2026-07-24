import { parseServerEnvironment } from "@taptolk/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    const environment = parseServerEnvironment();
    const publicKey = environment.OWNER_WEB_PUSH_VAPID_PUBLIC_KEY;
    return NextResponse.json(
      {
        data: publicKey
          ? {
              enabled: true,
              publicKey,
            }
          : {
              enabled: false,
            },
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { data: { enabled: false } },
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
