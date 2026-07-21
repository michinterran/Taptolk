import { notFound, redirect } from "next/navigation";
import { loadOperationsDashboard } from "../../../../../admin/load-operations-dashboard";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { AdminAnalyticsView } from "../../../../../components/admin-analytics-view";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { ADMIN_ANALYTICS_COPY } from "../../../../../content/admin-analytics-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function AdminReportsPage({
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
  const reportScope = new URLSearchParams();
  if (query.company) reportScope.set("company", query.company);
  if (query.site) reportScope.set("site", query.site);
  reportScope.set("days", String(model.windowDays));

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
        pathname={`/${locale}/admin/reports`}
      />
      <AdminAnalyticsView
        backHref={`/${locale}/admin/operations?${reportScope.toString()}`}
        copy={ADMIN_ANALYTICS_COPY[locale]}
        locale={locale}
        model={model}
      />
    </main>
  );
}
