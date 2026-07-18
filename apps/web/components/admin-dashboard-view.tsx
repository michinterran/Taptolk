import { SemanticHeading } from "@taptolk/ui";
import { signOutAdmin } from "../auth/actions";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface AdminDashboardViewProps {
  accountLabel: string;
  contextLabel: string;
  contextValue: string;
  description: string;
  email: string | null;
  eyebrow: string;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  nextDescription: string;
  nextActions?: readonly {
    href: string;
    label: string;
  }[];
  nextTitle: string;
  pathname: string;
  roleLabel: string;
  roleTitle: string;
  securityLabel: string;
  securityValue: string;
  signOutLabel: string;
  titleLines: readonly [string, ...string[]];
}

export function AdminDashboardView({
  accountLabel,
  contextLabel,
  contextValue,
  description,
  email,
  eyebrow,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  nextDescription,
  nextActions = [],
  nextTitle,
  pathname,
  roleLabel,
  roleTitle,
  securityLabel,
  securityValue,
  signOutLabel,
  titleLines,
}: AdminDashboardViewProps) {
  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={pathname}
      />
      <section className="admin-dashboard-hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <SemanticHeading className="admin-dashboard-title" lines={titleLines} />
          <p className="admin-dashboard-description">{description}</p>
        </div>
        <form action={signOutAdmin}>
          <input aria-label={localeTitle} name="locale" type="hidden" value={locale} />
          <button className="tt-button tt-button--secondary" type="submit">
            {signOutLabel}
          </button>
        </form>
      </section>

      <section className="admin-context-grid">
        <article className="admin-context-card">
          <span>{roleTitle}</span>
          <strong>{roleLabel}</strong>
        </article>
        <article className="admin-context-card">
          <span>{contextLabel}</span>
          <strong>{contextValue}</strong>
        </article>
        <article className="admin-context-card">
          <span>{securityLabel}</span>
          <strong>{securityValue}</strong>
        </article>
        <article className="admin-context-card">
          <span>{accountLabel}</span>
          <strong>{email ?? "-"}</strong>
        </article>
      </section>

      <section className="admin-next-card">
        <span aria-hidden="true" className="admin-next-marker" />
        <div>
          <h2>{nextTitle}</h2>
          <p>{nextDescription}</p>
          {nextActions.length > 0 ? (
            <div className="admin-next-actions">
              {nextActions.map((action, index) => (
                <a
                  className={`tt-button admin-next-action${
                    index > 0 ? " tt-button--secondary" : ""
                  }`}
                  href={action.href}
                  key={action.href}
                >
                  {action.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
