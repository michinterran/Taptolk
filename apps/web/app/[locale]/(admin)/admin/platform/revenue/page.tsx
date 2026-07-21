import { RevenueCommandCenterService } from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { notFound, redirect } from "next/navigation";
import { createSupabaseRevenueCommandCenterRepository } from "../../../../../../admin/supabase-revenue-command-center-repository";
import { toAdminAuthorizationContext } from "../../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../auth/server-client";
import { AdminPageHeader } from "../../../../../../components/admin-page-header";
import { AdminRevenueView } from "../../../../../../components/admin-revenue-view";
import { ADMIN_REVENUE_COPY } from "../../../../../../content/admin-revenue-copy";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

export default async function PlatformRevenuePage({
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

  const client = await createAdminServerClient();
  if (!client) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  const model = await new RevenueCommandCenterService(
    createSupabaseRevenueCommandCenterRepository(client),
  ).read({
    actor: {
      authorization: toAdminAuthorizationContext(
        context.decision.membership,
        context.mfaLevel === "aal2",
      ),
      userId: context.userId,
    },
  });

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
        pathname={`/${locale}/admin/platform/revenue`}
      />
      <AdminRevenueView
        canEdit={context.decision.membership.role === "SUPER_ADMIN"}
        copy={ADMIN_REVENUE_COPY[locale]}
        locale={locale}
        model={model}
      />
    </main>
  );
}
