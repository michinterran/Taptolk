import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { STICKER_TEMPLATE_CODES } from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { renderSticker, type StickerTemplateCode } from "@taptolk/qr-engine";
import { NextResponse } from "next/server";
import { loadAdminContext } from "../../../../auth/admin-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await loadAdminContext();
  if (context.status !== "AVAILABLE" || context.decision.state !== "READY" || !context.userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED" } },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }
  const template = new URL(request.url).searchParams.get("template");
  if (!template || !STICKER_TEMPLATE_CODES.some((candidate) => candidate === template)) {
    return NextResponse.json(
      { error: { code: "INVALID_TEMPLATE" } },
      { headers: { "Cache-Control": "no-store" }, status: 400 },
    );
  }
  try {
    const environment = parseServerEnvironment();
    const baseUrl =
      environment.PUBLIC_QR_BASE_URL ?? environment.APP_URL ?? "https://sample.taptolk.invalid";
    const logo = await readFile(join(process.cwd(), "public", "brand", "taptolk-logo.png"));
    const rendered = await renderSticker({
      publicUrl: new URL("/q/preview", baseUrl).toString(),
      taptolkLogoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
      templateCode: template as StickerTemplateCode,
    });
    return new Response(Buffer.from(rendered.png), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "PREVIEW_UNAVAILABLE" } },
      { headers: { "Cache-Control": "no-store" }, status: 503 },
    );
  }
}
