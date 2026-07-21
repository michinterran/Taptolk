import { AdminProfileService } from "@taptolk/application";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAdminProfileRepository } from "../../../../../admin/supabase-admin-profile-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { AdminProfileView } from "../../../../../components/admin-profile-view";
import { getAdminRoleLabel, getAdminScopeLabel } from "../../../../../content/admin-copy";
import { ADMIN_PROFILE_COPY } from "../../../../../content/admin-profile-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function AdminProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  const model = await new AdminProfileService(createSupabaseAdminProfileRepository(client)).read({
    actor: {
      authorization: toAdminAuthorizationContext(
        context.decision.membership,
        context.mfaLevel === "aal2",
      ),
      userId: context.userId,
    },
  });
  const messages = getMessages(locale);
  return (
    <main className="admin-dashboard-shell">
      <AdminPageHeader
        locale={locale}
        localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
        localeTitle={messages["locale.switcher.label"]}
        logoAlt={messages["admin.brand.logoAlt"]}
        pathname={`/${locale}/admin/profile`}
      />
      <AdminProfileView
        copy={ADMIN_PROFILE_COPY[locale]}
        email={context.email}
        locale={locale}
        model={model}
        roleLabel={getAdminRoleLabel(messages, context.decision.membership.role)}
        scopeLabel={getAdminScopeLabel(messages, context.decision.membership.scopeType)}
      />
    </main>
  );
}
