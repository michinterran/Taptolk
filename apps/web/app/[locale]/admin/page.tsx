import { redirect } from "next/navigation";
import { loadAdminContext } from "../../../auth/admin-context";
import { getAdminDecisionPath, getLocalizedAdminPath } from "../../../auth/admin-routing";
import { AdminAuthNotice } from "../../../components/admin-auth-notice";
import { getMessages } from "../../../content/messages";
import { isAppLocale } from "../../../i18n/locale";

export default async function AdminEntryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    redirect("/en/admin/login");
  }

  const copy = getMessages(locale);
  const context = await loadAdminContext();

  if (context.status === "CONFIGURATION_MISSING") {
    return (
      <main className="state-page">
        <AdminAuthNotice
          description={copy["admin.auth.configuration.description"]}
          title={copy["admin.auth.configuration.title"]}
        />
        <a className="tt-button" href={getLocalizedAdminPath(locale, "/login")}>
          {copy["admin.shared.backToLogin"]}
        </a>
      </main>
    );
  }
  if (context.status === "LOAD_ERROR") {
    throw new Error("Unable to load the admin entry context.");
  }

  redirect(getAdminDecisionPath(locale, context.decision));
}
