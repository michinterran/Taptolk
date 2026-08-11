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

const REVENUE_PAGE_SIZES = [10, 25, 50] as const;

function readPositiveInt(value: string | string[] | undefined, fallback: number): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = candidate ? Number.parseInt(candidate, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readRevenuePageSize(value: string | string[] | undefined): number {
  const parsed = readPositiveInt(value, 10);
  return REVENUE_PAGE_SIZES.includes(parsed as (typeof REVENUE_PAGE_SIZES)[number]) ? parsed : 10;
}

export default async function PlatformRevenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  const query = await searchParams;
  const page = readPositiveInt(query.page, 1);
  const pageSize = readRevenuePageSize(query.pageSize);
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
        page={page}
        pageSize={pageSize}
      />
    </main>
  );
}
