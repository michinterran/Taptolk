import { SemanticHeading } from "@taptolk/ui";
import { redirect } from "next/navigation";
import { signInAdmin } from "../auth/actions";
import { loadAdminContext } from "../auth/admin-context";
import { type AdminLoginArea, getAdminDecisionPath } from "../auth/admin-routing";
import { getAdminRegistrationPath } from "../auth/registration-routing";
import { getMessages } from "../content/messages";
import type { AppLocale } from "../i18n/config";
import { AdminAuthAlternatives } from "./admin-auth-alternatives";
import { AdminAuthNotice } from "./admin-auth-notice";
import { AdminPageHeader } from "./admin-page-header";

interface AdminLoginScreenProps {
  area: AdminLoginArea;
  locale: AppLocale;
  queryError: string | undefined;
}

export async function AdminLoginScreen({ area, locale, queryError }: AdminLoginScreenProps) {
  const copy = getMessages(locale);
  const context = await loadAdminContext();
  if (context.status === "AVAILABLE" && context.decision.state !== "UNAUTHENTICATED") {
    redirect(getAdminDecisionPath(locale, context.decision));
  }

  const isPlatform = area === "platform";
  const intro = isPlatform
    ? {
        description: copy["admin.platformLogin.description"],
        eyebrow: copy["admin.platformLogin.eyebrow"],
        line1: copy["admin.platformLogin.line1"],
        line2: copy["admin.platformLogin.line2"],
        submit: copy["admin.platformLogin.submit"],
      }
    : {
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
          : null;
  const configurationMissing = context.status === "CONFIGURATION_MISSING";
  const serviceUnavailable = context.status === "LOAD_ERROR";
  const pathname = isPlatform ? `/${locale}/admin/platform/login` : `/${locale}/admin/login`;

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

        <section aria-label={intro.submit} className="admin-auth-card">
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
            <input aria-label={intro.submit} name="area" type="hidden" value={area} />
            <input
              aria-label={copy["locale.switcher.label"]}
              name="locale"
              type="hidden"
              value={locale}
            />
            <label className="admin-field" htmlFor={`${area}-admin-email`}>
              <span>{copy["admin.login.email.label"]}</span>
              <input
                autoComplete="username"
                disabled={configurationMissing || serviceUnavailable}
                id={`${area}-admin-email`}
                name="email"
                placeholder={copy["admin.login.email.placeholder"]}
                required
                type="email"
              />
            </label>
            <label className="admin-field" htmlFor={`${area}-admin-password`}>
              <span>{copy["admin.login.password.label"]}</span>
              <input
                autoComplete="current-password"
                disabled={configurationMissing || serviceUnavailable}
                id={`${area}-admin-password`}
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
              {intro.submit}
            </button>
          </form>
          <AdminAuthAlternatives
            disabled={configurationMissing || serviceUnavailable}
            dividerLabel={copy["admin.auth.divider"]}
            flow="login"
            googleLabel={copy["admin.login.google"]}
            locale={locale}
            localeTitle={copy["locale.switcher.label"]}
            loginArea={area}
            secondaryAction={
              isPlatform
                ? copy["admin.platformLogin.customerAction"]
                : copy["admin.login.signupAction"]
            }
            secondaryHref={isPlatform ? `/${locale}/admin/login` : getAdminRegistrationPath(locale)}
            secondaryPrompt={
              isPlatform
                ? copy["admin.platformLogin.customerPrompt"]
                : copy["admin.login.signupPrompt"]
            }
          />
        </section>
      </section>
    </>
  );
}
