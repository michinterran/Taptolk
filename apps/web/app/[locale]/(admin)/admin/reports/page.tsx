import { getAdminLandingArea } from "@taptolk/auth";
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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  const model = await loadOperationsDashboard(context);
  if (!model) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }

  const copy = getMessages(locale);
  const platform = getAdminLandingArea(context.decision.membership.role) === "platform";

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
        backHref={getLocalizedAdminPath(locale, platform ? "/platform" : "/dashboard")}
        copy={ADMIN_ANALYTICS_COPY[locale]}
        locale={locale}
        model={model}
      />
    </main>
  );
}
