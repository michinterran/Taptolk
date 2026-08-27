import { QrSvgBundleService } from "@taptolk/application";
import { NextResponse } from "next/server";
import { createSupabaseQrSvgBundleRepository } from "../../../../../../admin/supabase-qr-svg-bundle-repository";
import { toAdminAuthorizationContext } from "../../../../../../auth/admin-authorization";
import { loadAdminContext } from "../../../../../../auth/admin-context";
import { createAdminServerClient } from "../../../../../../auth/server-client";
import { createAdminServiceClient } from "../../../../../../auth/service-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function attachmentFilename(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/gu, "_");
}

export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const [context, userClient, serviceClient, { batchId }] = await Promise.all([
    loadAdminContext(),
    createAdminServerClient(),
    Promise.resolve(createAdminServiceClient()),
    params,
  ]);
  if (
    context.status !== "AVAILABLE" ||
    context.decision.state !== "READY" ||
    !context.userId ||
    !userClient ||
    !serviceClient
  ) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED" } },
      { headers: { "Cache-Control": "no-store" }, status: 401 },
    );
  }
  try {
    const artifact = await new QrSvgBundleService(
      createSupabaseQrSvgBundleRepository(userClient, serviceClient),
    ).get({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
      batchId,
    });
    return new Response(Buffer.from(artifact.bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${attachmentFilename(artifact.filename)}"`,
        "Content-Type": artifact.mimeType,
        ETag: `"${artifact.checksumSha256}"`,
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "QR_SVG_BUNDLE_NOT_READY" } },
      { headers: { "Cache-Control": "no-store" }, status: 404 },
    );
  }
}
