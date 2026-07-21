import { describe, expect, it } from "vitest";
import { ManagementCompanyWorkspaceService } from "./management-company-workspace-service.js";

const platformActor = {
  mfaVerified: false,
  role: "SUPER_ADMIN" as const,
  scope: { type: "PLATFORM" as const },
};

describe("ManagementCompanyWorkspaceService", () => {
  it("authorizes a platform administrator before reading the workspace", async () => {
    const repository = { read: async () => null };
    await expect(
      new ManagementCompanyWorkspaceService(repository).read({
        actor: platformActor,
        companyId: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toBeNull();
  });

  it("rejects a company-scoped administrator opening another company", async () => {
    const repository = { read: async () => null };
    await expect(
      new ManagementCompanyWorkspaceService(repository).read({
        actor: {
          mfaVerified: false,
          role: "MANAGEMENT_ADMIN",
          scope: {
            managementCompanyId: "22222222-2222-4222-8222-222222222222",
            tenantId: "33333333-3333-4333-8333-333333333333",
            type: "MANAGEMENT_COMPANY",
          },
        },
        companyId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });
});
