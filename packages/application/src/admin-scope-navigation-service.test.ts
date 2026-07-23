import { describe, expect, it } from "vitest";
import type { AdminScopeNavigationRepository } from "./admin-scope-navigation-service.js";
import {
  ADMIN_SCOPE_NAVIGATION_LIMIT,
  AdminScopeNavigationService,
} from "./admin-scope-navigation-service.js";

function createRepository(): AdminScopeNavigationRepository {
  return {
    list: async () => ({
      managementCompanies: [
        {
          id: "company-a",
          name: "한빛관리",
          tenantId: "tenant-a",
          tenantName: "테넌트 A",
        },
      ],
      sites: [
        {
          id: "site-a",
          managementCompanyId: "company-a",
          managementCompanyName: "한빛관리",
          name: "강남 아파트",
          tenantId: "tenant-a",
        },
      ],
    }),
  };
}

describe("AdminScopeNavigationService", () => {
  it("returns no switcher model for non-Super Admin roles", async () => {
    const service = new AdminScopeNavigationService(createRepository());

    await expect(
      service.list({
        actor: {
          mfaVerified: true,
          role: "PLATFORM_OPERATOR",
          scope: { type: "PLATFORM" },
        },
      }),
    ).resolves.toEqual({
      canSwitch: false,
      managementCompanies: [],
      sites: [],
    });
  });

  it("loads the real downstream scopes for a platform Super Admin", async () => {
    const calls: number[] = [];
    const service = new AdminScopeNavigationService({
      list: async ({ limit }) => {
        calls.push(limit);
        return createRepository().list({ limit });
      },
    });

    const model = await service.list({
      actor: {
        mfaVerified: true,
        role: "SUPER_ADMIN",
        scope: { type: "PLATFORM" },
      },
    });

    expect(calls).toEqual([ADMIN_SCOPE_NAVIGATION_LIMIT]);
    expect(model.canSwitch).toBe(true);
    expect(model.managementCompanies[0]?.name).toBe("한빛관리");
    expect(model.sites[0]?.managementCompanyName).toBe("한빛관리");
  });
});
