import { ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH } from "@taptolk/auth";
import { SemanticHeading } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { signUpAdmin } from "../../../../../auth/actions";
import { loadAdminContext } from "../../../../../auth/admin-context";
import { getAdminDecisionPath, getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { AdminAuthAlternatives } from "../../../../../components/admin-auth-alternatives";
import { AdminAuthNotice } from "../../../../../components/admin-auth-notice";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

interface AdminSignupPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string | string[];
    status?: string | string[];
  }>;
}

export default async function AdminSignupPage({ params, searchParams }: AdminSignupPageProps) {
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
  const queryStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  const errorMessage =
    queryError === "invalid_email"
      ? copy["admin.signup.error.invalidEmail"]
      : queryError === "invalid_password"
        ? copy["admin.signup.error.invalidPassword"].replace(
            "{minimum}",
            String(ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH),
          )
        : queryError === "password_mismatch"
          ? copy["admin.signup.error.passwordMismatch"]
          : queryError === "configuration"
            ? copy["admin.auth.error.configuration"]
            : queryError === "oauth_unavailable" || queryError === "unavailable"
              ? copy["admin.auth.error.unavailable"]
              : null;
  const configurationMissing = context.status === "CONFIGURATION_MISSING";
  const serviceUnavailable = context.status === "LOAD_ERROR";
  const controlsDisabled = configurationMissing || serviceUnavailable;

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
        pathname={`/${locale}/admin/signup`}
      />

      <section className="admin-auth-layout">
        <div className="admin-auth-intro">
          <p className="eyebrow">{copy["admin.signup.eyebrow"]}</p>
          <SemanticHeading
            className="admin-auth-title"
            lines={[copy["admin.signup.line1"], copy["admin.signup.line2"]]}
          />
          <p className="admin-auth-description">{copy["admin.signup.description"]}</p>
          <p className="admin-security-note">{copy["admin.signup.approvalNote"]}</p>
        </div>

        <section aria-label={copy["admin.signup.submit"]} className="admin-auth-card">
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
          {queryStatus === "check_email" ? (
            <AdminAuthNotice
              description={copy["admin.signup.checkEmail.description"]}
              title={copy["admin.signup.checkEmail.title"]}
            />
          ) : null}
          {errorMessage ? (
            <p className="admin-form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <form action={signUpAdmin} className="admin-form">
            <input
              aria-label={copy["locale.switcher.label"]}
              name="locale"
              type="hidden"
              value={locale}
            />
            <label className="admin-field" htmlFor="admin-signup-email">
              <span>{copy["admin.signup.email.label"]}</span>
              <input
                autoComplete="email"
                disabled={controlsDisabled}
                id="admin-signup-email"
                name="email"
                placeholder={copy["admin.login.email.placeholder"]}
                required
                type="email"
              />
            </label>
            <label className="admin-field" htmlFor="admin-signup-password">
              <span>{copy["admin.signup.password.label"]}</span>
              <input
                aria-describedby="admin-signup-password-help"
                autoComplete="new-password"
                disabled={controlsDisabled}
                id="admin-signup-password"
                maxLength={128}
                minLength={ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH}
                name="password"
                required
                type="password"
              />
              <small id="admin-signup-password-help">
                {copy["admin.signup.password.help"].replace(
                  "{minimum}",
                  String(ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH),
                )}
              </small>
            </label>
            <label className="admin-field" htmlFor="admin-signup-password-confirmation">
              <span>{copy["admin.signup.passwordConfirmation.label"]}</span>
              <input
                autoComplete="new-password"
                disabled={controlsDisabled}
                id="admin-signup-password-confirmation"
                maxLength={128}
                minLength={ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH}
                name="passwordConfirmation"
                required
                type="password"
              />
            </label>
            <button className="tt-button admin-submit" disabled={controlsDisabled} type="submit">
              {copy["admin.signup.submit"]}
            </button>
          </form>

          <AdminAuthAlternatives
            disabled={controlsDisabled}
            dividerLabel={copy["admin.auth.divider"]}
            flow="signup"
            googleLabel={copy["admin.signup.google"]}
            locale={locale}
            localeTitle={copy["locale.switcher.label"]}
            secondaryAction={copy["admin.signup.loginAction"]}
            secondaryHref={getLocalizedAdminPath(locale, "/login")}
            secondaryPrompt={copy["admin.signup.loginPrompt"]}
          />
        </section>
      </section>
    </main>
  );
}
