import type { AppLocale } from "../i18n/config";
import { LocaleSwitcher } from "./locale-switcher";

/**
 * Header for the public introduction surface.
 *
 * Deliberately carries no sign-in, sign-up, or administrator link. The administrator
 * portal has its own address and its own header; access there is decided by the server
 * from the approved profile, membership, role/scope, and MFA state rather than by
 * whether a link was shown here.
 */
interface PublicSiteHeaderProps {
  currentLocale: AppLocale;
  labels: Readonly<{
    en: string;
    faq: string;
    ko: string;
    navigation: string;
    privacy: string;
    usage: string;
  }>;
  localeTitle: string;
  logoAlt: string;
  pathname: string;
}

export function PublicSiteHeader({
  currentLocale,
  labels,
  localeTitle,
  logoAlt,
  pathname,
}: PublicSiteHeaderProps) {
  return (
    <header className="public-site-header">
      <a className="public-site-brand" href={`/${currentLocale}`}>
        {/* biome-ignore lint/performance/noImgElement: approved logo must bypass image transformation */}
        <img alt={logoAlt} height="405" src="/brand/taptolk-logo.png" width="1000" />
      </a>
      <div className="public-site-header__controls">
        <nav aria-label={labels.navigation} className="public-site-nav">
          <a href="#how-it-works">{labels.usage}</a>
          <a href="#privacy">{labels.privacy}</a>
          <a href="#faq">{labels.faq}</a>
        </nav>
        <LocaleSwitcher
          currentLocale={currentLocale}
          labels={{ en: labels.en, ko: labels.ko }}
          pathname={pathname}
          title={localeTitle}
        />
      </div>
    </header>
  );
}
