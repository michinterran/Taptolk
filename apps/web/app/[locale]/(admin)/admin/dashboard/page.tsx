import { notFound, redirect } from "next/navigation";
import { loadOperationsDashboard } from "../../../../../admin/load-operations-dashboard";
import { getAdminConsoleArea, getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { AdminDashboardView } from "../../../../../components/admin-dashboard-view";
import { ADMIN_OVERVIEW_COPY } from "../../../../../content/admin-overview-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function TenantAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  const area = getAdminConsoleArea(context.decision.membership);
  if (area === "platform") {
    redirect(getLocalizedAdminPath(locale, "/platform"));
  }
  if (area === "company") {
    redirect(getLocalizedAdminPath(locale, "/company"));
  }

  const copy = getMessages(locale);
  const model = await loadOperationsDashboard(context);
  if (!model) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }

  return (
    <main className="admin-dashboard-shell">
      <AdminDashboardView
        canApproveAccounts={false}
        copy={ADMIN_OVERVIEW_COPY[locale]}
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        model={model}
        pathname={`/${locale}/admin/dashboard`}
        variant="customer"
      />
    </main>
  );
}
