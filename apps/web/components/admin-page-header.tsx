import { getAdminLandingArea } from "@taptolk/auth";
import { signOutAdmin } from "../auth/actions";
import { loadAdminContext } from "../auth/admin-context";
import { getAdminRoleLabel, getAdminScopeLabel } from "../content/admin-copy";
import { getMessages } from "../content/messages";
import type { AppLocale } from "../i18n/config";
import { LocaleSwitcher } from "./locale-switcher";

interface AdminPageHeaderProps {
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  pathname: string;
}

export async function AdminPageHeader({
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  pathname,
}: AdminPageHeaderProps) {
  const context = await loadAdminContext();

  if (context.status === "AVAILABLE" && context.decision.state === "READY") {
    const copy = getMessages(locale);
    const { membership } = context.decision;
    const isPlatform = getAdminLandingArea(membership.role) === "platform";
    const workspaceHref = `/${locale}/admin/${isPlatform ? "platform" : "dashboard"}`;
    const navigation = isPlatform
      ? [
          { href: `/${locale}/admin/platform`, label: copy["admin.nav.overview"] },
          { href: `/${locale}/admin/platform/tenants`, label: copy["admin.nav.tenants"] },
          {
            href: `/${locale}/admin/platform/management-companies`,
            label: copy["admin.nav.managementCompanies"],
          },
          { href: `/${locale}/admin/sites`, label: copy["admin.nav.sites"] },
          { href: `/${locale}/admin/qr-inventory`, label: copy["admin.nav.qr"] },
          { href: `/${locale}/admin/operations`, label: copy["admin.nav.operations"] },
          { href: `/${locale}/admin/reports`, label: copy["admin.nav.reports"] },
          { href: `/${locale}/admin/platform/revenue`, label: copy["admin.nav.revenue"] },
          ...(membership.role === "SUPER_ADMIN"
            ? [
                {
                  href: `/${locale}/admin/platform/access`,
                  label: copy["admin.nav.access"],
                },
              ]
            : []),
        ]
      : [
          { href: `/${locale}/admin/dashboard`, label: copy["admin.nav.overview"] },
          { href: `/${locale}/admin/sites`, label: copy["admin.nav.sites"] },
          { href: `/${locale}/admin/qr-inventory`, label: copy["admin.nav.qr"] },
          { href: `/${locale}/admin/operations`, label: copy["admin.nav.operations"] },
          { href: `/${locale}/admin/reports`, label: copy["admin.nav.reports"] },
        ];
    const currentItem =
      navigation.find((item) => pathname === item.href) ??
      navigation.find(
        (item) => item.href !== workspaceHref && pathname.startsWith(`${item.href}/`),
      ) ??
      navigation[0];

    return (
      <>
        <aside aria-label={copy["admin.nav.sidebar"]} className="admin-console-sidebar">
          <a className="admin-console-brand" href={workspaceHref}>
            {/* biome-ignore lint/performance/noImgElement: approved logo must bypass image transformation */}
            <img alt={logoAlt} height="405" src="/brand/taptolk-logo.png" width="1000" />
          </a>

          <div className="admin-console-identity">
            <span>{copy["admin.nav.workspace"]}</span>
            <strong>{getAdminRoleLabel(copy, membership.role)}</strong>
            <div className="admin-console-profile">
              <span>{copy["admin.shared.account"]}</span>
              <strong title={context.email ?? undefined}>{context.email ?? "-"}</strong>
              <form action={signOutAdmin}>
                <input aria-label={localeTitle} name="locale" type="hidden" value={locale} />
                <button className="admin-console-signout" type="submit">
                  {copy["admin.shared.signOut"]}
                </button>
              </form>
            </div>
          </div>

          <nav aria-label={copy["admin.nav.label"]} className="admin-console-nav">
            {navigation.map((item) => {
              const isCurrent = currentItem?.href === item.href;
              return (
                <a
                  aria-current={isCurrent ? "page" : undefined}
                  className="admin-console-nav__item"
                  href={item.href}
                  key={item.href}
                >
                  <span aria-hidden="true" />
                  {item.label}
                </a>
              );
            })}
          </nav>

          <dl className="admin-console-session">
            <div>
              <dt>{copy["admin.dashboard.context"]}</dt>
              <dd>{getAdminScopeLabel(copy, membership.scopeType)}</dd>
            </div>
            <div>
              <dt>{copy["admin.dashboard.session"]}</dt>
              <dd>
                {context.mfaLevel === "aal2"
                  ? copy["admin.dashboard.session.aal2"]
                  : copy["admin.dashboard.session.aal1"]}
              </dd>
            </div>
          </dl>
        </aside>

        <header className="admin-console-topbar">
          <div className="admin-console-location">
            <span>{copy["admin.nav.current"]}</span>
            <strong>{currentItem?.label ?? copy["admin.nav.overview"]}</strong>
          </div>
          <div className="admin-console-account-actions">
            <LocaleSwitcher
              currentLocale={locale}
              labels={localeLabels}
              pathname={pathname}
              title={localeTitle}
            />
          </div>
        </header>
      </>
    );
  }

  return (
    <header className="admin-page-header">
      <a className="admin-brand-link" href={`/${locale}`}>
        {/* biome-ignore lint/performance/noImgElement: approved logo must bypass image transformation */}
        <img
          alt={logoAlt}
          className="admin-brand-logo"
          height="405"
          src="/brand/taptolk-logo.png"
          width="1000"
        />
      </a>
      <LocaleSwitcher
        currentLocale={locale}
        labels={localeLabels}
        pathname={pathname}
        title={localeTitle}
      />
    </header>
  );
}
