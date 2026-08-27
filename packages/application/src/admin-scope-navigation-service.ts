import type { AdminAuthorizationContext } from "@taptolk/domain";

export const ADMIN_SCOPE_NAVIGATION_LIMIT = 50;

export interface AdminScopeNavigationCompany {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
}

export interface AdminScopeNavigationSite {
  id: string;
  managementCompanyId: string;
  managementCompanyName: string;
  name: string;
  tenantId: string;
}

export interface AdminScopeNavigationModel {
  canSwitch: boolean;
  managementCompanies: readonly AdminScopeNavigationCompany[];
  sites: readonly AdminScopeNavigationSite[];
}

export interface AdminScopeNavigationRepository {
  list(input: { limit: number }): Promise<{
    managementCompanies: readonly AdminScopeNavigationCompany[];
    sites: readonly AdminScopeNavigationSite[];
  }>;
}

export class AdminScopeNavigationService {
  constructor(private readonly repository: AdminScopeNavigationRepository) {}

  async list(input: { actor: AdminAuthorizationContext }): Promise<AdminScopeNavigationModel> {
    if (input.actor.role !== "SUPER_ADMIN" || input.actor.scope.type !== "PLATFORM") {
      return {
        canSwitch: false,
        managementCompanies: [],
        sites: [],
      };
    }

    const result = await this.repository.list({ limit: ADMIN_SCOPE_NAVIGATION_LIMIT });

    return {
      canSwitch: true,
      managementCompanies: result.managementCompanies,
      sites: result.sites,
    };
  }
}
