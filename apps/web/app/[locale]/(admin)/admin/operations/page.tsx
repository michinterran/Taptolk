import { getAdminLandingArea } from "@taptolk/auth";
import { notFound, redirect } from "next/navigation";
import { loadOperationsDashboard } from "../../../../../admin/load-operations-dashboard";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { OperationsDashboardView } from "../../../../../components/operations-dashboard-view";
import { getMessages } from "../../../../../content/messages";
import { OPERATIONS_COPY } from "../../../../../content/operations-copy";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function OperationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const context = await requireReadyAdminContext(locale);
  const membership = context.decision.membership;
  const model = await loadOperationsDashboard(context);
  if (!model) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  const platform = getAdminLandingArea(membership.role) === "platform";
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
        backHref={getLocalizedAdminPath(locale, platform ? "/platform" : "/dashboard")}
        copy={OPERATIONS_COPY[locale]}
        locale={locale}
        model={model}
      />
    </main>
  );
}
