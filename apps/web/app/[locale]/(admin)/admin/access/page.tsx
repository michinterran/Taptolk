import { SemanticHeading } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { signOutAdmin } from "../../../../../auth/actions";
import { loadAdminContext } from "../../../../../auth/admin-context";
import { getAdminDecisionPath, getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

export default async function AdminAccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const copy = getMessages(locale);
  const context = await loadAdminContext();
  if (context.status === "CONFIGURATION_MISSING") {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  if (context.status === "LOAD_ERROR") {
    throw new Error("Unable to load admin access state.");
  }
  if (context.decision.state !== "ACCESS_DENIED") {
    redirect(getAdminDecisionPath(locale, context.decision));
  }

  const reason =
    context.decision.reason === "PROFILE_INACTIVE"
      ? copy["admin.access.profileInactive"]
      : copy["admin.access.membershipInactive"];

  return (
    <main className="admin-auth-shell">
      <AdminPageHeader
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        pathname={`/${locale}/admin/access`}
      />
      <section className="admin-centered-state">
        <p className="eyebrow">{copy["admin.access.eyebrow"]}</p>
        <SemanticHeading
          className="admin-auth-title"
          lines={[copy["admin.access.line1"], copy["admin.access.line2"]]}
        />
        <p>{copy["admin.access.description"]}</p>
        <strong className="admin-access-reason">{reason}</strong>
        {context.email ? (
          <p className="admin-account-line">
            <span>{copy["admin.shared.account"]}</span>
            <strong>{context.email}</strong>
          </p>
        ) : null}
        <form action={signOutAdmin}>
          <input
            aria-label={copy["locale.switcher.label"]}
            name="locale"
            type="hidden"
            value={locale}
          />
          <button className="tt-button" type="submit">
            {copy["admin.shared.signOut"]}
          </button>
        </form>
      </section>
    </main>
  );
}
