import type { AppLocale } from "../i18n/config";
import { adminRoute } from "../routing/app-routes";
import { LocaleSwitcher } from "./locale-switcher";

/**
 * Header for the administrator portal introduction.
 *
 * The brand link stays inside `/{locale}/admin` so an administrator is never bounced
 * into the public introduction while working. Both calls to action point at the single
 * canonical sign-in and sign-up paths; the browser never selects customer or platform.
 */
interface AdminPortalHeaderProps {
  currentLocale: AppLocale;
  labels: Readonly<{
    approval: string;
    en: string;
    features: string;
    flow: string;
    ko: string;
    login: string;
    navigation: string;
    portal: string;
    signup: string;
  }>;
  localeTitle: string;
  logoAlt: string;
}

export function AdminPortalHeader({
  currentLocale,
  labels,
  localeTitle,
  logoAlt,
}: AdminPortalHeaderProps) {
  return (
    <header className="admin-portal-header">
      <a className="admin-portal-brand" href={adminRoute(currentLocale)}>
        {/* biome-ignore lint/performance/noImgElement: approved logo must bypass image transformation */}
        <img alt={logoAlt} height="405" src="/brand/taptolk-logo.png" width="1000" />
        <span>{labels.portal}</span>
      </a>

      <div className="admin-portal-header__controls">
        <nav aria-label={labels.navigation} className="admin-portal-nav">
          <a href="#workflow">{labels.flow}</a>
          <a href="#features">{labels.features}</a>
          <a href="#approval">{labels.approval}</a>
        </nav>
        <LocaleSwitcher
          currentLocale={currentLocale}
          labels={{ en: labels.en, ko: labels.ko }}
          pathname={adminRoute(currentLocale)}
          title={localeTitle}
        />
        <div className="admin-portal-header__actions">
          <a className="admin-portal-ghost" href={adminRoute(currentLocale, "/signup")}>
            {labels.signup}
          </a>
          <a className="tt-button admin-portal-primary" href={adminRoute(currentLocale, "/login")}>
            {labels.login}
          </a>
        </div>
      </div>
    </header>
  );
}
