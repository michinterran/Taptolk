import { getAdminLandingArea } from "@taptolk/auth";
import { notFound, redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../auth/page-guard";
import { AdminDashboardView } from "../../../../components/admin-dashboard-view";
import { getAdminRoleLabel, getAdminScopeLabel } from "../../../../content/admin-copy";
import { getMessages } from "../../../../content/messages";
import { isAppLocale } from "../../../../i18n/locale";

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

  return (
    <main className="admin-dashboard-shell">
      <AdminDashboardView
        accountLabel={copy["admin.shared.account"]}
        contextLabel={copy["admin.dashboard.context"]}
        contextValue={getAdminScopeLabel(copy, membership.scopeType)}
        description={copy["admin.platform.description"]}
        email={context.email}
        eyebrow={copy["admin.platform.eyebrow"]}
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        nextDescription={copy["admin.platform.next.description"]}
        nextActions={[
          {
            href: `/${locale}/admin/platform/tenants`,
            label: copy["admin.platform.tenantsAction"],
          },
          ...(membership.role === "SUPER_ADMIN"
            ? [
                {
                  href: `/${locale}/admin/platform/access`,
                  label: copy["admin.platform.accessAction"],
                },
              ]
            : []),
        ]}
        nextTitle={copy["admin.platform.next.title"]}
        pathname={`/${locale}/admin/platform`}
        roleLabel={getAdminRoleLabel(copy, membership.role)}
        roleTitle={copy["admin.dashboard.role"]}
        securityLabel={copy["admin.dashboard.session"]}
        securityValue={
          context.mfaLevel === "aal2"
            ? copy["admin.dashboard.session.aal2"]
            : copy["admin.dashboard.session.aal1"]
        }
        signOutLabel={copy["admin.shared.signOut"]}
        titleLines={[copy["admin.platform.line1"], copy["admin.platform.line2"]]}
      />
    </main>
  );
}
