import { ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH } from "@taptolk/auth";
import { SemanticHeading } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { loadAdminContext } from "../../../../../auth/admin-context";
import { getAdminDecisionPath, getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { AdminAuthNotice } from "../../../../../components/admin-auth-notice";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { AdminSignupControls } from "../../../../../components/admin-signup-controls";
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

          <AdminSignupControls
            controlsDisabled={controlsDisabled}
            dividerLabel={copy["admin.auth.divider"]}
            emailLabel={copy["admin.signup.email.label"]}
            emailPlaceholder={copy["admin.login.email.placeholder"]}
            googleLabel={copy["admin.signup.google"]}
            locale={locale}
            localeTitle={copy["locale.switcher.label"]}
            passwordConfirmationLabel={copy["admin.signup.passwordConfirmation.label"]}
            passwordHelp={copy["admin.signup.password.help"].replace(
              "{minimum}",
              String(ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH),
            )}
            passwordLabel={copy["admin.signup.password.label"]}
            passwordMinLength={ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH}
            secondaryAction={copy["admin.signup.loginAction"]}
            secondaryHref={getLocalizedAdminPath(locale, "/login")}
            secondaryPrompt={copy["admin.signup.loginPrompt"]}
            submitLabel={copy["admin.signup.submit"]}
            workingLabel={copy["admin.shared.working"]}
          />
        </section>
      </section>
    </main>
  );
}
