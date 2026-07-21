import { OperationsDashboardService } from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { notFound, redirect } from "next/navigation";
import { createSupabaseOperationsDashboardRepository } from "../../../../../admin/supabase-operations-dashboard-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { OperationsDashboardView } from "../../../../../components/operations-dashboard-view";
import { OPERATIONS_COPY } from "../../../../../content/operations-copy";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function OperationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  const membership = context.decision.membership;
  const model = await new OperationsDashboardService(
    createSupabaseOperationsDashboardRepository(client),
  ).read({
    actor: {
      authorization: toAdminAuthorizationContext(membership, context.mfaLevel === "aal2"),
      userId: context.userId,
    },
  });
  const platform = getAdminLandingArea(membership.role) === "platform";
  return (
    <main>
      <OperationsDashboardView
        backHref={getLocalizedAdminPath(locale, platform ? "/platform" : "/dashboard")}
        copy={OPERATIONS_COPY[locale]}
        locale={locale}
        model={model}
      />
    </main>
  );
}
