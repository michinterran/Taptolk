import type { TenantCatalogPage, TenantStatus } from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import { signOutAdmin } from "../auth/actions";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface TenantCatalogViewProps {
  catalog: TenantCatalogPage;
  copy: {
    back: string;
    createdAt: string;
    description: string;
    emptyDescription: string;
    emptyTitle: string;
    eyebrow: string;
    localeLabels: Readonly<Record<AppLocale, string>>;
    localeTitle: string;
    logoAlt: string;
    name: string;
    next: string;
    page: string;
    paginationLabel: string;
    previous: string;
    securityNote: string;
    signOut: string;
    slug: string;
    status: string;
    statusLabels: Readonly<Record<TenantStatus, string>>;
    titleLines: readonly [string, ...string[]];
    total: string;
  };
  locale: AppLocale;
}

function getPageHref(locale: AppLocale, page: number): string {
  return `/${locale}/admin/platform/tenants?page=${page}`;
}

export function TenantCatalogView({ catalog, copy, locale }: TenantCatalogViewProps) {
  const totalPages = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));
  const hasPrevious = catalog.page > 1;
  const hasNext = catalog.page < totalPages;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={copy.localeLabels}
        localeTitle={copy.localeTitle}
        logoAlt={copy.logoAlt}
        pathname={`/${locale}/admin/platform/tenants`}
      />

      <section className="admin-section-hero">
        <div>
          <a className="admin-back-link" href={`/${locale}/admin/platform`}>
            {copy.back}
          </a>
          <p className="eyebrow">{copy.eyebrow}</p>
          <SemanticHeading className="admin-section-title" lines={copy.titleLines} />
          <p className="admin-dashboard-description">{copy.description}</p>
        </div>
        <form action={signOutAdmin}>
          <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
          <button className="tt-button tt-button--secondary" type="submit">
            {copy.signOut}
          </button>
        </form>
      </section>

      <section className="admin-catalog-summary" aria-live="polite">
        <strong>{copy.total.replace("{count}", String(catalog.total))}</strong>
        <span>{copy.securityNote}</span>
      </section>

      {catalog.items.length === 0 ? (
        <section className="admin-catalog-empty">
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyDescription}</p>
        </section>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th scope="col">{copy.name}</th>
                <th scope="col">{copy.slug}</th>
                <th scope="col">{copy.status}</th>
                <th scope="col">{copy.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {catalog.items.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <strong>{tenant.name}</strong>
                  </td>
                  <td>
                    <code>{tenant.slug}</code>
                  </td>
                  <td>
                    <span
                      className={`admin-status-badge admin-status-badge--${tenant.status.toLowerCase()}`}
                    >
                      {copy.statusLabels[tenant.status]}
                    </span>
                  </td>
                  <td>
                    <time dateTime={tenant.createdAt}>
                      {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
                        dateStyle: "medium",
                      }).format(new Date(tenant.createdAt))}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label={copy.paginationLabel} className="admin-pagination">
        {hasPrevious ? (
          <a
            className="tt-button tt-button--secondary"
            href={getPageHref(locale, catalog.page - 1)}
          >
            {copy.previous}
          </a>
        ) : (
          <span />
        )}
        <span>
          {copy.page
            .replace("{current}", String(catalog.page))
            .replace("{total}", String(totalPages))}
        </span>
        {hasNext ? (
          <a
            className="tt-button tt-button--secondary"
            href={getPageHref(locale, catalog.page + 1)}
          >
            {copy.next}
          </a>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
