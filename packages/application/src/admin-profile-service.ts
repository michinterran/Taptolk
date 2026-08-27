import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface AdminProfileModel {
  displayName: string;
  status: "ACTIVE" | "CLOSED" | "INVITED" | "SUSPENDED";
  version: number;
}

export interface AdminProfileRepository {
  read(): Promise<AdminProfileModel>;
  update(input: {
    displayName: string;
    expectedVersion: number;
    reason: string;
    requestId: string;
  }): Promise<void>;
}

export class AdminProfileService {
  constructor(private readonly repository: AdminProfileRepository) {}

  private authorize(actor: { authorization: AdminAuthorizationContext; userId: string }) {
    if (!UUID_PATTERN.test(actor.userId)) throw new Error("INVALID_ADMIN_PROFILE");
    const scope = actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(actor.authorization, "audit:read", {
        ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
        ...(scope.siteId ? { siteId: scope.siteId } : {}),
        tenantId: scope.tenantId ?? "self-admin-profile",
      }),
    );
  }

  async read(input: {
    actor: { authorization: AdminAuthorizationContext; userId: string };
  }): Promise<AdminProfileModel> {
    this.authorize(input.actor);
    return this.repository.read();
  }

  async update(input: {
    actor: { authorization: AdminAuthorizationContext; userId: string };
    displayName: string;
    expectedVersion: number;
    reason: string;
    requestId: string;
  }): Promise<void> {
    this.authorize(input.actor);
    if (
      !UUID_PATTERN.test(input.requestId) ||
      !Number.isInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      input.displayName.trim().length < 1 ||
      input.displayName.trim().length > 100 ||
      input.reason.trim().length < 3 ||
      input.reason.trim().length > 500
    )
      throw new Error("INVALID_ADMIN_PROFILE");
    await this.repository.update({
      displayName: input.displayName.trim(),
      expectedVersion: input.expectedVersion,
      reason: input.reason.trim(),
      requestId: input.requestId,
    });
  }
}
