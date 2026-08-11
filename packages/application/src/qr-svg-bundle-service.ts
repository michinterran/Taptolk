import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/iu;

export interface QrSvgBundleActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface QrSvgBundleArtifact {
  bytes: Uint8Array;
  checksumSha256: string;
  filename: string;
  mimeType: "application/zip";
}

export interface QrSvgBundleRepository {
  get(batchId: string): Promise<QrSvgBundleArtifact>;
}

export class QrSvgBundleError extends Error {
  readonly code: "INVALID_ID" | "NOT_READY";

  constructor(code: QrSvgBundleError["code"]) {
    super(`QR SVG bundle rejected: ${code}`);
    this.name = "QrSvgBundleError";
    this.code = code;
  }
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new QrSvgBundleError("INVALID_ID");
  }
}

export class QrSvgBundleService {
  constructor(private readonly repository: QrSvgBundleRepository) {}

  async get(input: { actor: QrSvgBundleActor; batchId: string }): Promise<QrSvgBundleArtifact> {
    assertUuid(input.actor.userId);
    assertUuid(input.batchId);
    const scope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "qr-batch:read", {
        ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
        ...(scope.siteId ? { siteId: scope.siteId } : {}),
        tenantId: scope.tenantId ?? "platform-svg-bundle",
      }),
    );
    try {
      return await this.repository.get(input.batchId);
    } catch (error) {
      if (error instanceof QrSvgBundleError) {
        throw error;
      }
      throw new QrSvgBundleError("NOT_READY");
    }
  }
}
