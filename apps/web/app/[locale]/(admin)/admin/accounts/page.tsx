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

function readStatus(value: string | string[] | undefined): "updated" | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "updated" ? candidate : null;
}

export default async function AdminAccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();
  const context = await requireReadyAdminContext(locale);
  const sessionClient = await createAdminServerClient();
  const serviceClient = createAdminServiceClient();
  if (!sessionClient || !serviceClient) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  let items: readonly AdminDirectoryItem[] = [];
  let directoryError = false;
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
    directoryError = true;
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
        errorMessage={directoryError ? messages["admin.directory.error.unavailable"] : null}
        items={items}
        locale={locale}
        messages={messages}
        statusMessage={readStatus(query.status) ? ADMIN_DIRECTORY_COPY[locale].updated : null}
      />
    </main>
  );
}
