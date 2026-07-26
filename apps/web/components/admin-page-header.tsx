import {
  BuildingsIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  CirclesFourIcon,
  HouseIcon,
  IdentificationCardIcon,
  MapPinAreaIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { AdminScopeNavigationService } from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { ScopeSwitcher } from "@taptolk/ui";
import type { ReactNode } from "react";
import { createSupabaseAdminScopeNavigationRepository } from "../admin/supabase-admin-scope-navigation-repository";
import { signOutAdmin } from "../auth/actions";
import { loadAdminContext } from "../auth/admin-context";
import { createAdminServerClient } from "../auth/server-client";
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

interface AdminNavigationItem {
  href: string;
  icon: ReactNode;
  label: string;
}

interface AdminNavigationSection {
  label: string;
  items: readonly AdminNavigationItem[];
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
    const navigationSections: readonly AdminNavigationSection[] = isPlatform
      ? [
          {
            label: copy["admin.nav.group.overview"],
            items: [
              {
                href: `/${locale}/admin/platform`,
                icon: <HouseIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.overview"],
              },
            ],
          },
          {
            label: copy["admin.nav.group.customers"],
            items: [
              {
                href: `/${locale}/admin/platform/management-companies`,
                icon: <BuildingsIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.managementCompanies"],
              },
            ],
          },
          {
            label: copy["admin.nav.group.service"],
            items: [
              {
                href: `/${locale}/admin/qr-inventory`,
                icon: <QrCodeIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.qr"],
              },
              {
                href: `/${locale}/admin/operations`,
                icon: <ChartLineUpIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.operations"],
              },
              {
                href: `/${locale}/admin/reports`,
                icon: <ChartBarIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.reports"],
              },
              {
                href: `/${locale}/admin/platform/revenue`,
                icon: <CirclesFourIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.revenue"],
              },
            ],
          },
          ...(membership.role === "SUPER_ADMIN"
            ? [
                {
                  label: copy["admin.nav.group.administration"],
                  items: [
                    {
                      href: `/${locale}/admin/accounts`,
                      icon: <ShieldCheckIcon aria-hidden="true" weight="duotone" />,
                      label: copy["admin.nav.access"],
                    },
                  ],
                },
              ]
            : []),
        ]
      : [
          {
            label: copy["admin.nav.group.overview"],
            items: [
              {
                href: `/${locale}/admin/dashboard`,
                icon: <HouseIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.overview"],
              },
            ],
          },
          {
            label: copy["admin.nav.group.customers"],
            items: [
              {
                href: `/${locale}/admin/sites`,
                icon: <MapPinAreaIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.sites"],
              },
            ],
          },
          {
            label: copy["admin.nav.group.service"],
            items: [
              {
                href: `/${locale}/admin/qr-inventory`,
                icon: <QrCodeIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.qr"],
              },
              {
                href: `/${locale}/admin/operations`,
                icon: <ChartLineUpIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.operations"],
              },
              {
                href: `/${locale}/admin/reports`,
                icon: <ChartBarIcon aria-hidden="true" weight="duotone" />,
                label: copy["admin.nav.reports"],
              },
            ],
          },
          ...(["MANAGEMENT_ADMIN", "SITE_ADMIN"].includes(membership.role)
            ? [
                {
                  label: copy["admin.nav.group.administration"],
                  items: [
                    {
                      href: `/${locale}/admin/accounts`,
                      icon: <ShieldCheckIcon aria-hidden="true" weight="duotone" />,
                      label: copy["admin.nav.access"],
                    },
                  ],
                },
              ]
            : []),
        ];
    const navigation = navigationSections.flatMap((section) => section.items);
    const profileHref = `/${locale}/admin/profile`;
    const isProfile = pathname === profileHref;
    const currentItem =
      navigation.find((item) => pathname === item.href) ??
      navigation.find(
        (item) => item.href !== workspaceHref && pathname.startsWith(`${item.href}/`),
      ) ??
      (isProfile ? undefined : navigation[0]);
    const scopeSwitcher =
      isPlatform && membership.role === "SUPER_ADMIN"
        ? await loadSuperAdminScopeSwitcher({
            copy,
            locale,
            mfaVerified: context.mfaLevel === "aal2",
            pathname,
          })
        : null;

    return (
      <>
        <aside aria-label={copy["admin.nav.sidebar"]} className="admin-console-sidebar">
          <a className="admin-console-brand" href={workspaceHref}>
            {/* biome-ignore lint/performance/noImgElement: approved logo must bypass image transformation */}
            <img alt={logoAlt} height="405" src="/brand/taptolk-logo.png" width="1000" />
          </a>

          <div className="admin-console-identity">
            <span>{copy["admin.nav.workspace"]}</span>
            <strong>
              {isPlatform ? copy["admin.platform.eyebrow"] : copy["admin.dashboard.eyebrow"]}
            </strong>
          </div>

          <nav aria-label={copy["admin.nav.label"]} className="admin-console-nav">
            {navigationSections.map((section) => (
              <section className="admin-console-nav__section" key={section.label}>
                <p>{section.label}</p>
                {section.items.map((item) => {
                  const isCurrent = currentItem?.href === item.href;
                  return (
                    <a
                      aria-current={isCurrent ? "page" : undefined}
                      className="admin-console-nav__item"
                      href={item.href}
                      key={item.href}
                    >
                      {item.icon}
                      {item.label}
                    </a>
                  );
                })}
              </section>
            ))}
          </nav>

          <a
            aria-current={isProfile ? "page" : undefined}
            className="admin-console-profile-link"
            href={profileHref}
          >
            <IdentificationCardIcon aria-hidden="true" weight="duotone" />
            {copy["admin.shared.account"]}
          </a>

          <dl className="admin-console-session">
            <div>
              <dt>{copy["admin.dashboard.context"]}</dt>
              <dd>{getAdminScopeLabel(copy, membership.scopeType)}</dd>
            </div>
            <div>
              <dt>{copy["admin.dashboard.session"]}</dt>
              <dd>{copy["admin.dashboard.session.aal1"]}</dd>
            </div>
          </dl>
        </aside>

        <header className="admin-console-topbar">
          <div className="admin-console-topbar__leading">
            {scopeSwitcher ?? (
              <a className="admin-console-scope" href={workspaceHref}>
                {isPlatform ? (
                  <CirclesFourIcon aria-hidden="true" weight="duotone" />
                ) : (
                  <MapPinAreaIcon aria-hidden="true" weight="duotone" />
                )}
                <span>{getAdminScopeLabel(copy, membership.scopeType)}</span>
              </a>
            )}
            <div className="admin-console-location">
              <span>{copy["admin.nav.current"]}</span>
              <strong>
                {isProfile
                  ? copy["admin.shared.account"]
                  : (currentItem?.label ?? copy["admin.nav.overview"])}
              </strong>
            </div>
          </div>
          <div className="admin-console-account-actions">
            <LocaleSwitcher
              currentLocale={locale}
              labels={localeLabels}
              pathname={pathname}
              title={localeTitle}
            />
            <details className="admin-console-account-menu">
              <summary aria-label={copy["admin.shared.account"]}>
                <UserCircleIcon aria-hidden="true" weight="duotone" />
                <span>
                  <strong>{getAdminRoleLabel(copy, membership.role)}</strong>
                  <small title={context.email ?? undefined}>{context.email ?? "-"}</small>
                </span>
              </summary>
              <div>
                <a href={`/${locale}/admin/profile`}>
                  <IdentificationCardIcon aria-hidden="true" weight="duotone" />
                  {copy["admin.shared.account"]}
                </a>
                <form action={signOutAdmin}>
                  <input aria-label={localeTitle} name="locale" type="hidden" value={locale} />
                  <button type="submit">
                    <SignOutIcon aria-hidden="true" weight="duotone" />
                    {copy["admin.shared.signOut"]}
                  </button>
                </form>
              </div>
            </details>
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

async function loadSuperAdminScopeSwitcher({
  copy,
  locale,
  mfaVerified,
  pathname,
}: {
  copy: ReturnType<typeof getMessages>;
  locale: AppLocale;
  mfaVerified: boolean;
  pathname: string;
}) {
  const client = await createAdminServerClient();
  if (!client) {
    return null;
  }

  const model = await new AdminScopeNavigationService(
    createSupabaseAdminScopeNavigationRepository(client),
  ).list({
    actor: {
      mfaVerified,
      role: "SUPER_ADMIN",
      scope: { type: "PLATFORM" },
    },
  });

  if (!model.canSwitch) {
    return null;
  }

  const platformHref = `/${locale}/admin/platform`;
  const companyBaseHref = `/${locale}/admin/platform/management-companies`;
  const siteBaseHref = `/${locale}/admin/sites`;

  return (
    <ScopeSwitcher
      icon={<CirclesFourIcon aria-hidden="true" weight="duotone" />}
      label={copy["admin.platform.eyebrow"]}
      groups={[
        {
          items: [
            {
              href: platformHref,
              label: copy["admin.platform.eyebrow"],
              selected: pathname === platformHref,
            },
          ],
          label: copy["admin.dashboard.context"],
        },
        {
          items: model.managementCompanies.map((company) => ({
            description: company.tenantName,
            href: `${companyBaseHref}/${company.id}`,
            label: company.name,
            selected: pathname.startsWith(`${companyBaseHref}/${company.id}`),
          })),
          label: copy["admin.nav.managementCompanies"],
        },
        {
          items: model.sites.map((site) => ({
            description: site.managementCompanyName,
            href: `${siteBaseHref}/${site.id}`,
            label: site.name,
            selected: pathname.startsWith(`${siteBaseHref}/${site.id}`),
          })),
          label: copy["admin.nav.sites"],
        },
      ]}
    />
  );
}
