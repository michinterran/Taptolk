import { ManagementCompanyCatalogService } from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { notFound, redirect } from "next/navigation";
import { loadOperationsDashboard } from "../../../../../admin/load-operations-dashboard";
import { createSupabaseManagementCompanyCatalogRepository } from "../../../../../admin/supabase-management-company-catalog-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { AdminDashboardView } from "../../../../../components/admin-dashboard-view";
import { getAdminRoleLabel, getAdminScopeLabel } from "../../../../../content/admin-copy";
import { ADMIN_OVERVIEW_COPY } from "../../../../../content/admin-overview-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function PlatformAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  if (getAdminLandingArea(context.decision.membership.role) !== "platform") {
    redirect(getLocalizedAdminPath(locale, "/dashboard"));
  }

  const copy = getMessages(locale);
  const { membership } = context.decision;
  const client = await createAdminServerClient();
  if (!client) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  const [model, companyPortfolio] = await Promise.all([
    loadOperationsDashboard(context),
    new ManagementCompanyCatalogService(
      createSupabaseManagementCompanyCatalogRepository(client),
    ).list({
      actor: toAdminAuthorizationContext(membership, context.mfaLevel === "aal2"),
      page: 1,
    }),
  ]);
  if (!model) redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));

  return (
    <main className="admin-dashboard-shell">
      <AdminDashboardView
        canApproveAccounts={membership.role === "SUPER_ADMIN"}
        companyPortfolio={companyPortfolio.items}
        context={{
          contextLabel: copy["admin.dashboard.context"],
          contextValue: getAdminScopeLabel(copy, membership.scopeType),
          roleLabel: getAdminRoleLabel(copy, membership.role),
          roleTitle: copy["admin.dashboard.role"],
          securityLabel: copy["admin.dashboard.session"],
          securityValue:
            context.mfaLevel === "aal2"
              ? copy["admin.dashboard.session.aal2"]
              : copy["admin.dashboard.session.aal1"],
        }}
        copy={ADMIN_OVERVIEW_COPY[locale]}
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        model={model}
        pathname={`/${locale}/admin/platform`}
        variant="platform"
      />
    </main>
  );
}
