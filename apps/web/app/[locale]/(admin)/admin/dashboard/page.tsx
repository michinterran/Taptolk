import { getAdminLandingArea } from "@taptolk/auth";
import { notFound, redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { AdminDashboardView } from "../../../../../components/admin-dashboard-view";
import { getAdminRoleLabel, getAdminScopeLabel } from "../../../../../content/admin-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function TenantAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  if (getAdminLandingArea(context.decision.membership.role) === "platform") {
    redirect(getLocalizedAdminPath(locale, "/platform"));
  }

  const copy = getMessages(locale);
  const { membership } = context.decision;

  return (
    <main className="admin-dashboard-shell">
      <AdminDashboardView
        accountLabel={copy["admin.shared.account"]}
        contextLabel={copy["admin.dashboard.context"]}
        contextValue={getAdminScopeLabel(copy, membership.scopeType)}
        description={copy["admin.dashboard.description"]}
        email={context.email}
        eyebrow={copy["admin.dashboard.eyebrow"]}
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        nextDescription={copy["admin.dashboard.next.description"]}
        nextActions={[
          {
            href: `/${locale}/admin/sites`,
            label: copy["admin.dashboard.sitesAction"],
          },
          {
            href: `/${locale}/admin/qr-inventory`,
            label: copy["admin.dashboard.qrAction"],
          },
          {
            href: `/${locale}/admin/operations`,
            label: copy["admin.dashboard.operationsAction"],
          },
        ]}
        nextTitle={copy["admin.dashboard.next.title"]}
        pathname={`/${locale}/admin/dashboard`}
        roleLabel={getAdminRoleLabel(copy, membership.role)}
        roleTitle={copy["admin.dashboard.role"]}
        securityLabel={copy["admin.dashboard.session"]}
        securityValue={
          context.mfaLevel === "aal2"
            ? copy["admin.dashboard.session.aal2"]
            : copy["admin.dashboard.session.aal1"]
        }
        signOutLabel={copy["admin.shared.signOut"]}
        titleLines={[copy["admin.dashboard.line1"], copy["admin.dashboard.line2"]]}
      />
    </main>
  );
}
