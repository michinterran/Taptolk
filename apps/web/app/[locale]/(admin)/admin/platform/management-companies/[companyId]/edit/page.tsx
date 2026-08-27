import { ManagementCompanyWorkspaceService } from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { roleHasPermission } from "@taptolk/domain";
import { notFound, redirect } from "next/navigation";
import { createSupabaseManagementCompanyWorkspaceRepository } from "../../../../../../../../admin/supabase-management-company-workspace-repository";
import { getLocalizedAdminPath } from "../../../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../../../auth/server-client";
import { ManagementCompanyEditView } from "../../../../../../../../components/management-company-edit-view";
import { ADMIN_COMPANY_WORKSPACE_COPY } from "../../../../../../../../content/admin-company-workspace-copy";
import { getMessages } from "../../../../../../../../content/messages";
import { isAppLocale } from "../../../../../../../../i18n/locale";

export default async function EditManagementCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string; locale: string }>;
}) {
  const { companyId, locale } = await params;
  if (!isAppLocale(locale)) notFound();

  const context = await requireReadyAdminContext(locale);
  const membership = context.decision.membership;
  if (getAdminLandingArea(membership.role) !== "platform") {
    redirect(getLocalizedAdminPath(locale, "/dashboard"));
  }
  if (!roleHasPermission(membership.role, "management-company:update")) {
    redirect(getLocalizedAdminPath(locale, "/access"));
  }

  const client = await createAdminServerClient();
  if (!client) redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));

  const model = await new ManagementCompanyWorkspaceService(
    createSupabaseManagementCompanyWorkspaceRepository(client),
  ).read({
    actor: {
      mfaVerified: context.mfaLevel === "aal2",
      role: membership.role,
      scope: { type: "PLATFORM" },
    },
    companyId,
  });
  if (!model) notFound();

  const messages = getMessages(locale);
  return (
    <main className="admin-dashboard-shell">
      <ManagementCompanyEditView
        copy={ADMIN_COMPANY_WORKSPACE_COPY[locale]}
        locale={locale}
        localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
        localeTitle={messages["locale.switcher.label"]}
        logoAlt={messages["admin.brand.logoAlt"]}
        model={model}
      />
    </main>
  );
}
