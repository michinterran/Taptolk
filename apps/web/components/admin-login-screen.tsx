import { AuthCard, SemanticHeading } from "@taptolk/ui";
import { redirect } from "next/navigation";
import { loadAdminContext } from "../auth/admin-context";
import { getAdminDecisionPath } from "../auth/admin-routing";
import { getAdminRegistrationPath } from "../auth/registration-routing";
import { getMessages } from "../content/messages";
import type { AppLocale } from "../i18n/config";
import { AdminAuthNotice } from "./admin-auth-notice";
import { AdminLoginControls } from "./admin-login-controls";
import { AdminPageHeader } from "./admin-page-header";

interface AdminLoginScreenProps {
  locale: AppLocale;
  queryError: string | undefined;
}

export async function AdminLoginScreen({ locale, queryError }: AdminLoginScreenProps) {
  const copy = getMessages(locale);
  const context = await loadAdminContext();
  if (context.status === "AVAILABLE" && context.decision.state !== "UNAUTHENTICATED") {
    redirect(getAdminDecisionPath(locale, context.decision));
  }

  const intro = {
    description: copy["admin.login.description"],
    eyebrow: copy["admin.login.eyebrow"],
    line1: copy["admin.login.line1"],
    line2: copy["admin.login.line2"],
    submit: copy["admin.login.submit"],
  };
  const errorMessage =
    queryError === "invalid_credentials"
      ? copy["admin.auth.error.invalidCredentials"]
      : queryError === "configuration"
        ? copy["admin.auth.error.configuration"]
        : queryError === "oauth_unavailable"
          ? copy["admin.auth.error.unavailable"]
          : queryError === "session"
            ? copy["admin.auth.error.session"]
            : null;
  const configurationMissing = context.status === "CONFIGURATION_MISSING";
  const serviceUnavailable = context.status === "LOAD_ERROR";
  const pathname =
    queryError === "session" ? `/${locale}/admin/login?error=session` : `/${locale}/admin/login`;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        pathname={pathname}
      />

      <section className="admin-auth-layout">
        <div className="admin-auth-intro">
          <a className="admin-entry-back" href={`/${locale}/onboarding`}>
            {copy["admin.login.backToOnboarding"]}
          </a>
          <p className="eyebrow">{intro.eyebrow}</p>
          <SemanticHeading className="admin-auth-title" lines={[intro.line1, intro.line2]} />
          <p className="admin-auth-description">{intro.description}</p>
          <p className="admin-security-note">{copy["admin.auth.securityNote"]}</p>
        </div>

        <AuthCard
          aria-label={intro.submit}
          className="admin-auth-card admin-auth-card--login"
          description={copy["admin.auth.securityNote"]}
          title={intro.submit}
        >
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

          <AdminLoginControls
            controlsDisabled={configurationMissing || serviceUnavailable}
            dividerLabel={copy["admin.auth.divider"]}
            emailLabel={copy["admin.login.email.label"]}
            emailPlaceholder={copy["admin.login.email.placeholder"]}
            googleLabel={copy["admin.login.google"]}
            locale={locale}
            localeTitle={copy["locale.switcher.label"]}
            passwordLabel={copy["admin.login.password.label"]}
            secondaryAction={copy["admin.login.signupAction"]}
            secondaryHref={getAdminRegistrationPath(locale)}
            secondaryPrompt={copy["admin.login.signupPrompt"]}
            submitLabel={intro.submit}
            workingLabel={copy["admin.shared.working"]}
          />
        </AuthCard>
      </section>
    </>
  );
}
