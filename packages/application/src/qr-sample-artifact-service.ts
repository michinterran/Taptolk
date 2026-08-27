import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface QrSampleArtifactActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface QrSampleArtifact {
  bytes: Uint8Array;
  checksumSha256: string;
  mimeType: "image/png" | "image/svg+xml";
}

export interface QrSampleArtifactRepository {
  get(sampleId: string): Promise<QrSampleArtifact>;
}

export class QrSampleArtifactService {
  constructor(private readonly repository: QrSampleArtifactRepository) {}

  async get(input: { actor: QrSampleArtifactActor; sampleId: string }): Promise<QrSampleArtifact> {
    if (!UUID_PATTERN.test(input.actor.userId) || !UUID_PATTERN.test(input.sampleId)) {
      throw new Error("INVALID_ID");
    }
    const scope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "qr-batch:read", {
        ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
        ...(scope.siteId ? { siteId: scope.siteId } : {}),
        tenantId: scope.tenantId ?? "platform-sample-artifact",
      }),
    );
    return this.repository.get(input.sampleId);
  }
}
