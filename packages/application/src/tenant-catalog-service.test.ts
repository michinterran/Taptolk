import { describe, expect, it, vi } from "vitest";
import { AdminAuthorizationError } from "./authorization-error.js";
import { type TenantCatalogRepository, TenantCatalogService } from "./tenant-catalog-service.js";

function createRepository(): TenantCatalogRepository {
  return {
    list: vi.fn(async () => ({
      items: [
        {
          createdAt: "2026-07-18T00:00:00.000Z",
          id: "tenant-a",
          name: "Tenant A",
          slug: "tenant-a",
          status: "ACTIVE" as const,
          version: 1,
        },
      ],
      total: 1,
    })),
  };
}

describe("Tenant catalog service", () => {
  it("returns a deterministic platform catalog page", async () => {
    const repository = createRepository();
    const service = new TenantCatalogService(repository);

    const result = await service.list({
      actor: {
        mfaVerified: true,
        role: "SUPER_ADMIN",
        scope: { type: "PLATFORM" },
      },
      page: 2,
      pageSize: 10,
    });

    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 1 });
    expect(repository.list).toHaveBeenCalledWith({ limit: 10, offset: 10 });
  });

  it("rejects a tenant-scoped actor before repository access", async () => {
    const repository = createRepository();
    const service = new TenantCatalogService(repository);

    await expect(
      service.list({
        actor: {
          mfaVerified: true,
          role: "READ_ONLY",
          scope: { tenantId: "tenant-a", type: "TENANT" },
        },
      }),
    ).rejects.toEqual(new AdminAuthorizationError("OUT_OF_SCOPE"));

    expect(repository.list).not.toHaveBeenCalled();
  });

  it("allows a privileged platform actor without MFA under the current pilot policy", async () => {
    const repository = createRepository();
    const service = new TenantCatalogService(repository);

    await expect(
      service.list({
        actor: {
          mfaVerified: false,
          role: "SUPER_ADMIN",
          scope: { type: "PLATFORM" },
        },
      }),
    ).resolves.toMatchObject({ total: 1 });

    expect(repository.list).toHaveBeenCalled();
  });
});
