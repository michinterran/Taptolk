import { notFound, redirect } from "next/navigation";
import { loadOperationsDashboard } from "../../../../../admin/load-operations-dashboard";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { OperationsDashboardView } from "../../../../../components/operations-dashboard-view";
import { getMessages } from "../../../../../content/messages";
import { OPERATIONS_COPY } from "../../../../../content/operations-copy";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function OperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ company?: string; days?: string; site?: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const context = await requireReadyAdminContext(locale);
  const query = await searchParams;
  const days = query.days ? Number.parseInt(query.days, 10) : 14;
  const model = await loadOperationsDashboard(context, {
    days: Number.isInteger(days) && days >= 7 && days <= 90 ? days : 14,
    ...(query.company ? { managementCompanyId: query.company } : {}),
    ...(query.site ? { siteId: query.site } : {}),
  });
  if (!model) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  const copy = getMessages(locale);
  return (
    <main className="admin-dashboard-shell">
      <AdminPageHeader
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        pathname={`/${locale}/admin/operations`}
      />
      <OperationsDashboardView
        {...(query.company ? { companyId: query.company } : {})}
        copy={OPERATIONS_COPY[locale]}
        locale={locale}
        model={model}
        {...(query.site ? { siteId: query.site } : {})}
      />
    </main>
  );
}
