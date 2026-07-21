import { type AdminDirectoryItem, AdminDirectoryService } from "@taptolk/application";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAdminDirectoryRepository } from "../../../../../admin/supabase-admin-directory-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { createAdminServiceClient } from "../../../../../auth/service-client";
import { AdminDirectoryView } from "../../../../../components/admin-directory-view";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { ADMIN_DIRECTORY_COPY } from "../../../../../content/admin-directory-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function AdminAccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const context = await requireReadyAdminContext(locale);
  const sessionClient = await createAdminServerClient();
  const serviceClient = createAdminServiceClient();
  if (!sessionClient || !serviceClient) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  let items: readonly AdminDirectoryItem[];
  try {
    items = await new AdminDirectoryService(
      createSupabaseAdminDirectoryRepository(sessionClient, serviceClient),
    ).list({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
    });
  } catch {
    redirect(getLocalizedAdminPath(locale, "/dashboard"));
  }
  const messages = getMessages(locale);
  return (
    <main className="admin-dashboard-shell">
      <AdminPageHeader
        locale={locale}
        localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
        localeTitle={messages["locale.switcher.label"]}
        logoAlt={messages["admin.brand.logoAlt"]}
        pathname={`/${locale}/admin/accounts`}
      />
      <AdminDirectoryView
        actorIsSuperAdmin={context.decision.membership.role === "SUPER_ADMIN"}
        canApprove={context.decision.membership.role === "SUPER_ADMIN"}
        copy={ADMIN_DIRECTORY_COPY[locale]}
        currentUserId={context.userId}
        items={items}
        locale={locale}
        messages={messages}
      />
    </main>
  );
}
