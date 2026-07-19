import { QrSampleArtifactService } from "@taptolk/application";
import { NextResponse } from "next/server";
import { createSupabaseQrSampleArtifactRepository } from "../../../../../admin/supabase-qr-sample-artifact-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { loadAdminContext } from "../../../../../auth/admin-context";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { createAdminServiceClient } from "../../../../../auth/service-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sampleId: string }> },
) {
  const [context, userClient, serviceClient, { sampleId }] = await Promise.all([
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
    const artifact = await new QrSampleArtifactService(
      createSupabaseQrSampleArtifactRepository(userClient, serviceClient),
    ).get({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
      sampleId,
    });
    return new Response(Buffer.from(artifact.bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": artifact.mimeType,
        ETag: `"${artifact.checksumSha256}"`,
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "SAMPLE_ARTIFACT_NOT_FOUND" } },
      { headers: { "Cache-Control": "no-store" }, status: 404 },
    );
  }
}
