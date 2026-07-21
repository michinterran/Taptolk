import { redirect } from "next/navigation";
import { loadAdminContext } from "../../../../auth/admin-context";
import { getAdminDecisionPath } from "../../../../auth/admin-routing";
import { AdminAuthNotice } from "../../../../components/admin-auth-notice";
import { AdminPortalIntro } from "../../../../components/admin-portal-intro";
import { getMessages } from "../../../../content/messages";
import { isAppLocale } from "../../../../i18n/locale";

/**
 * Administrator portal entry.
 *
 * A visitor who is not signed in sees the management-company introduction with the
 * canonical sign-in and sign-up entries. An authenticated administrator is routed by
 * the server from the approved profile, active membership, role/scope, and MFA state,
 * exactly as before: the customer and platform workspaces stay separate and the browser
 * never selects between them.
 */
export default async function AdminEntryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    redirect("/en/admin");
  }

  const copy = getMessages(locale);
  const context = await loadAdminContext();

  // The introduction stays readable even when the administrator authentication provider
  // is not configured, so the portal explains itself while sign-in remains unavailable.
  if (context.status === "CONFIGURATION_MISSING") {
    return (
      <main className="admin-portal-shell">
        <AdminPortalIntro
          copy={copy}
          locale={locale}
          notice={
            <AdminAuthNotice
              description={copy["admin.auth.configuration.description"]}
              title={copy["admin.auth.configuration.title"]}
            />
          }
        />
      </main>
    );
  }

  if (context.status === "LOAD_ERROR") {
    throw new Error("Unable to load the admin entry context.");
  }

  if (context.decision.state === "UNAUTHENTICATED") {
    return (
      <main className="admin-portal-shell">
        <AdminPortalIntro copy={copy} locale={locale} />
      </main>
    );
  }

  redirect(getAdminDecisionPath(locale, context.decision));
}
