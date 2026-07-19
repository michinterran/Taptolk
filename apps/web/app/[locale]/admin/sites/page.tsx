import {
  DEFAULT_SITE_TIMEZONE,
  SITE_CONTRACT_VEHICLE_LIMIT_MAX,
  SiteCatalogService,
} from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { roleHasPermission } from "@taptolk/domain";
import { notFound, redirect } from "next/navigation";
import { createSupabaseSiteCatalogRepository } from "../../../../admin/supabase-site-catalog-repository";
import { toAdminAuthorizationContext } from "../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../auth/server-client";
import { SiteCatalogView } from "../../../../components/site-catalog-view";
import { getMessages } from "../../../../content/messages";
import { isAppLocale } from "../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readPage(value: string | string[] | undefined): number {
  const parsed = Number(readValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function SitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string | string[];
    page?: string | string[];
    status?: string | string[];
  }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }

  const membership = context.decision.membership;
  const authorization = toAdminAuthorizationContext(membership, context.mfaLevel === "aal2");
  const catalog = await new SiteCatalogService(createSupabaseSiteCatalogRepository(client)).list({
    actor: authorization,
    page: readPage(query.page),
  });
  const copy = getMessages(locale);
  const errorMessages: Readonly<Record<string, string>> = {
    blocked: copy["admin.sites.error.blocked"],
    conflict: copy["admin.sites.error.conflict"],
    forbidden: copy["admin.sites.error.forbidden"],
    unavailable: copy["admin.sites.error.unavailable"],
    validation: copy["admin.sites.error.validation"],
  };
  const statusMessages: Readonly<Record<string, string>> = {
    contractUpdated: copy["admin.sites.status.contractUpdated"],
    created: copy["admin.sites.status.created"],
    operationalUpdated: copy["admin.sites.status.operationalUpdated"],
    statusChanged: copy["admin.sites.status.statusChanged"],
  };
  const error = readValue(query.error);
  const status = readValue(query.status);
  const isPlatform = getAdminLandingArea(membership.role) === "platform";

  return (
    <main className="admin-dashboard-shell">
      <SiteCatalogView
        backHref={getLocalizedAdminPath(locale, isPlatform ? "/platform" : "/dashboard")}
        canChangeStatus={roleHasPermission(membership.role, "site:suspend-approve")}
        canClose={roleHasPermission(membership.role, "site:archive-approve")}
        canCreate={roleHasPermission(membership.role, "site:create")}
        canUpdateContract={roleHasPermission(membership.role, "site:update-contract")}
        canUpdateOperational={roleHasPermission(membership.role, "site:update-operational")}
        catalog={catalog}
        contractVehicleLimitMax={SITE_CONTRACT_VEHICLE_LIMIT_MAX}
        copy={{
          actions: copy["admin.sites.actions"],
          address: copy["admin.sites.address"],
          back: copy["admin.sites.back"],
          close: copy["admin.sites.close"],
          company: copy["admin.sites.company"],
          contractLimit: copy["admin.sites.contractLimit"],
          contractLimitHelp: copy["admin.sites.contractLimit.help"],
          contractTitle: copy["admin.sites.contract.title"],
          create: copy["admin.sites.create"],
          createDescription: copy["admin.sites.create.description"],
          createTitle: copy["admin.sites.create.title"],
          createdAt: copy["admin.sites.createdAt"],
          description: copy["admin.sites.description"],
          edit: copy["admin.sites.edit"],
          emptyDescription: copy["admin.sites.empty.description"],
          emptyTitle: copy["admin.sites.empty.title"],
          eyebrow: copy["admin.sites.eyebrow"],
          lifecycleRequestOnly: copy["admin.sites.lifecycle.requestOnly"],
          localeLabels: {
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          },
          localeTitle: copy["locale.switcher.label"],
          logoAlt: copy["admin.brand.logoAlt"],
          name: copy["admin.sites.name"],
          next: copy["admin.sites.next"],
          noActiveParent: copy["admin.sites.noActiveParent"],
          notAvailable: copy["admin.sites.notAvailable"],
          operationalDescription: copy["admin.sites.operational.description"],
          operationalTitle: copy["admin.sites.operational.title"],
          page: copy["admin.sites.page"],
          paginationLabel: copy["admin.sites.pagination"],
          parent: copy["admin.sites.parent"],
          previous: copy["admin.sites.previous"],
          reactivate: copy["admin.sites.reactivate"],
          reason: copy["admin.sites.reason"],
          reasonPlaceholder: copy["admin.sites.reason.placeholder"],
          saveContract: copy["admin.sites.contract.save"],
          saveOperational: copy["admin.sites.operational.save"],
          securityNote: copy["admin.sites.securityNote"],
          signOut: copy["admin.shared.signOut"],
          status: copy["admin.sites.status"],
          statusDescription: copy["admin.sites.status.description"],
          statusLabels: {
            ACTIVE: copy["admin.sites.status.active"],
            CLOSED: copy["admin.sites.status.closed"],
            SUSPENDED: copy["admin.sites.status.suspended"],
          },
          suspend: copy["admin.sites.suspend"],
          tenant: copy["admin.sites.tenant"],
          timezone: copy["admin.sites.timezone"],
          titleLines: [copy["admin.sites.line1"], copy["admin.sites.line2"]],
          total: copy["admin.sites.total"],
          type: copy["admin.sites.type"],
          typeLabels: {
            APARTMENT: copy["admin.sites.type.apartment"],
            BUILDING: copy["admin.sites.type.building"],
            OFFICETEL: copy["admin.sites.type.officetel"],
            OTHER: copy["admin.sites.type.other"],
          },
        }}
        defaultTimezone={DEFAULT_SITE_TIMEZONE}
        errorMessage={error ? errorMessages[error] : undefined}
        lifecycleRequestOnly={
          !roleHasPermission(membership.role, "site:suspend-approve") &&
          (roleHasPermission(membership.role, "site:suspend-request") ||
            roleHasPermission(membership.role, "site:archive-request"))
        }
        locale={locale}
        statusMessage={status ? statusMessages[status] : undefined}
      />
    </main>
  );
}
