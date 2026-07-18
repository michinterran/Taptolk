import { SemanticHeading } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { signInAdmin } from "../../../../auth/actions";
import { loadAdminContext } from "../../../../auth/admin-context";
import { getAdminDecisionPath } from "../../../../auth/admin-routing";
import { AdminAuthNotice } from "../../../../components/admin-auth-notice";
import { AdminPageHeader } from "../../../../components/admin-page-header";
import { getMessages } from "../../../../content/messages";
import { isAppLocale } from "../../../../i18n/locale";

interface AdminLoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}

export default async function AdminLoginPage({ params, searchParams }: AdminLoginPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) {
    notFound();
  }

  const copy = getMessages(locale);
  const context = await loadAdminContext();
  if (context.status === "AVAILABLE" && context.decision.state !== "UNAUTHENTICATED") {
    redirect(getAdminDecisionPath(locale, context.decision));
  }

  const queryError = Array.isArray(query.error) ? query.error[0] : query.error;
  const errorMessage =
    queryError === "invalid_credentials"
      ? copy["admin.auth.error.invalidCredentials"]
      : queryError === "configuration"
        ? copy["admin.auth.error.configuration"]
        : null;
  const configurationMissing = context.status === "CONFIGURATION_MISSING";
  const serviceUnavailable = context.status === "LOAD_ERROR";

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
        pathname={`/${locale}/admin/login`}
      />

      <section className="admin-auth-layout">
        <div className="admin-auth-intro">
          <p className="eyebrow">{copy["admin.login.eyebrow"]}</p>
          <SemanticHeading
            className="admin-auth-title"
            lines={[copy["admin.login.line1"], copy["admin.login.line2"]]}
          />
          <p className="admin-auth-description">{copy["admin.login.description"]}</p>
          <p className="admin-security-note">{copy["admin.auth.securityNote"]}</p>
        </div>

        <section aria-label={copy["admin.login.submit"]} className="admin-auth-card">
          {configurationMissing ? (
            <AdminAuthNotice
              description={copy["admin.auth.configuration.description"]}
              title={copy["admin.auth.configuration.title"]}
            />
          ) : null}
          {serviceUnavailable ? (
            <AdminAuthNotice
              description={copy["admin.auth.error.unavailable"]}
              title={copy["shared.error.title"]}
              tone="danger"
            />
          ) : null}
          {errorMessage ? (
            <p className="admin-form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <form action={signInAdmin} className="admin-form">
            <input
              aria-label={copy["locale.switcher.label"]}
              name="locale"
              type="hidden"
              value={locale}
            />
            <label className="admin-field" htmlFor="admin-email">
              <span>{copy["admin.login.email.label"]}</span>
              <input
                autoComplete="username"
                disabled={configurationMissing || serviceUnavailable}
                id="admin-email"
                name="email"
                placeholder={copy["admin.login.email.placeholder"]}
                required
                type="email"
              />
            </label>
            <label className="admin-field" htmlFor="admin-password">
              <span>{copy["admin.login.password.label"]}</span>
              <input
                autoComplete="current-password"
                disabled={configurationMissing || serviceUnavailable}
                id="admin-password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>
            <button
              className="tt-button admin-submit"
              disabled={configurationMissing || serviceUnavailable}
              type="submit"
            >
              {copy["admin.login.submit"]}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
