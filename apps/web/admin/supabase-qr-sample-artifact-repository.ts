import "server-only";

import { createHash } from "node:crypto";
import type { QrSampleArtifactRepository } from "@taptolk/application";
import type { createAdminServerClient } from "../auth/server-client";
import type { createAdminServiceClient } from "../auth/service-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;
type AdminServiceClient = NonNullable<ReturnType<typeof createAdminServiceClient>>;

export function createSupabaseQrSampleArtifactRepository(
  userClient: AdminServerClient,
  serviceClient: AdminServiceClient,
): QrSampleArtifactRepository {
  return {
    async get(sampleId) {
      const metadata = await userClient
        .from("qr_batch_samples")
        .select("storage_bucket, storage_path, checksum_sha256, mime_type, byte_size")
        .eq("id", sampleId)
        .neq("status", "INVALIDATED")
        .maybeSingle();
      if (
        metadata.error ||
        !metadata.data ||
        (metadata.data.mime_type !== "image/png" && metadata.data.mime_type !== "image/svg+xml") ||
        typeof metadata.data.storage_bucket !== "string" ||
        typeof metadata.data.storage_path !== "string" ||
        typeof metadata.data.checksum_sha256 !== "string" ||
        typeof metadata.data.byte_size !== "number"
      ) {
        throw new Error("SAMPLE_ARTIFACT_NOT_FOUND");
      }
      const download = await serviceClient.storage
        .from(metadata.data.storage_bucket)
        .download(metadata.data.storage_path);
      if (download.error) {
        throw new Error("SAMPLE_ARTIFACT_NOT_FOUND");
      }
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
      if (
        bytes.byteLength !== metadata.data.byte_size ||
        checksumSha256 !== metadata.data.checksum_sha256
      ) {
        throw new Error("SAMPLE_ARTIFACT_INTEGRITY_FAILED");
      }
      return {
        bytes,
        checksumSha256,
        mimeType: metadata.data.mime_type,
      };
    },
  };
}
