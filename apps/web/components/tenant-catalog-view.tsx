import type { TenantCatalogPage, TenantStatus } from "@taptolk/application";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
  Pagination,
  StatusPill,
} from "@taptolk/ui";
import { changeTenantStatus, createTenant, updateTenant } from "../admin/tenant-management-actions";
import { signOutAdmin } from "../auth/actions";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface TenantCatalogCopy {
  actions: string;
  back: string;
  close: string;
  create: string;
  createDescription: string;
  createTitle: string;
  createdAt: string;
  description: string;
  edit: string;
  editDescription: string;
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
  reactivate: string;
  reason: string;
  reasonPlaceholder: string;
  readOnly: string;
  save: string;
  securityNote: string;
  signOut: string;
  slug: string;
  slugHelp: string;
  status: string;
  statusDescription: string;
  statusLabels: Readonly<Record<TenantStatus, string>>;
  suspend: string;
  titleLines: readonly [string, ...string[]];
  total: string;
}

interface TenantCatalogViewProps {
  canManage: boolean;
  catalog: TenantCatalogPage;
  copy: TenantCatalogCopy;
  errorMessage?: string | undefined;
  locale: AppLocale;
  statusMessage?: string | undefined;
}

type TenantRow = TenantCatalogPage["items"][number];

function getPageHref(locale: AppLocale, page: number): string {
  return `/${locale}/admin/platform/tenants?page=${page}`;
}

function getFormatterLocale(locale: AppLocale): string {
  return locale === "ko" ? "ko-KR" : "en";
}

function getTenantStatusTone(status: TenantStatus): "success" | "warning" | "danger" {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "CLOSED") {
    return "danger";
  }

  return "warning";
}

function HiddenCommandFields({
  copy,
  locale,
  tenant,
}: {
  copy: TenantCatalogCopy;
  locale: AppLocale;
  tenant: TenantCatalogPage["items"][number];
}) {
  return (
    <>
      <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
      <input aria-label={copy.name} name="tenantId" type="hidden" value={tenant.id} />
      <input
        aria-label={copy.actions}
        name="expectedVersion"
        type="hidden"
        value={tenant.version}
      />
    </>
  );
}

function TenantRowActions({
  copy,
  locale,
  tenant,
}: {
  copy: TenantCatalogCopy;
  locale: AppLocale;
  tenant: TenantRow;
}) {
  const fieldPrefix = `tenant-${tenant.id}`;

  if (tenant.status === "CLOSED") {
    return <span className="admin-table-closed">{copy.statusLabels.CLOSED}</span>;
  }

  return (
    <details className="admin-tenant-row-actions">
      <summary>{copy.edit}</summary>
      <div className="admin-tenant-row-actions__body">
        <form action={updateTenant} className="admin-tenant-form">
          <HiddenCommandFields copy={copy} locale={locale} tenant={tenant} />
          <p>{copy.editDescription}</p>
          <label className="admin-field" htmlFor={`${fieldPrefix}-name`}>
            <span>{copy.name}</span>
            <input
              defaultValue={tenant.name}
              id={`${fieldPrefix}-name`}
              maxLength={200}
              name="name"
              required
            />
          </label>
          <label className="admin-field" htmlFor={`${fieldPrefix}-slug`}>
            <span>{copy.slug}</span>
            <input
              defaultValue={tenant.slug}
              id={`${fieldPrefix}-slug`}
              maxLength={63}
              minLength={2}
              name="slug"
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              required
            />
          </label>
          <label className="admin-field" htmlFor={`${fieldPrefix}-edit-reason`}>
            <span>{copy.reason}</span>
            <textarea
              id={`${fieldPrefix}-edit-reason`}
              maxLength={500}
              minLength={3}
              name="reason"
              placeholder={copy.reasonPlaceholder}
              required
            />
          </label>
          <button className="tt-button tt-button--compact" type="submit">
            {copy.save}
          </button>
        </form>

        <form action={changeTenantStatus} className="admin-tenant-status-form">
          <HiddenCommandFields copy={copy} locale={locale} tenant={tenant} />
          <input
            aria-label={copy.status}
            name="currentStatus"
            type="hidden"
            value={tenant.status}
          />
          <p>{copy.statusDescription}</p>
          <label className="admin-field" htmlFor={`${fieldPrefix}-status-reason`}>
            <span>{copy.reason}</span>
            <textarea
              id={`${fieldPrefix}-status-reason`}
              maxLength={500}
              minLength={3}
              name="reason"
              placeholder={copy.reasonPlaceholder}
              required
            />
          </label>
          <div className="admin-tenant-status-actions">
            {tenant.status === "ACTIVE" ? (
              <button
                className="tt-button tt-button--secondary tt-button--compact"
                name="nextStatus"
                type="submit"
                value="SUSPENDED"
              >
                {copy.suspend}
              </button>
            ) : (
              <button
                className="tt-button tt-button--secondary tt-button--compact"
                name="nextStatus"
                type="submit"
                value="ACTIVE"
              >
                {copy.reactivate}
              </button>
            )}
            <button
              className="tt-button tt-button--compact admin-danger-button"
              name="nextStatus"
              type="submit"
              value="CLOSED"
            >
              {copy.close}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}

export function TenantCatalogView({
  canManage,
  catalog,
  copy,
  errorMessage,
  locale,
  statusMessage,
}: TenantCatalogViewProps) {
  const totalPages = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));
  const hasPrevious = catalog.page > 1;
  const hasNext = catalog.page < totalPages;
  const pageSummary = copy.page
    .replace("{current}", String(catalog.page))
    .replace("{total}", String(totalPages));
  const columns: Array<DataTableColumn<TenantRow>> = [
    {
      cell: (tenant) => (
        <div className="tt-table-entity">
          <strong>{tenant.name}</strong>
        </div>
      ),
      header: copy.name,
      key: "name",
    },
    {
      cell: (tenant) => <code>{tenant.slug}</code>,
      header: copy.slug,
      key: "slug",
    },
    {
      cell: (tenant) => (
        <StatusPill tone={getTenantStatusTone(tenant.status)}>
          {copy.statusLabels[tenant.status]}
        </StatusPill>
      ),
      header: copy.status,
      key: "status",
    },
    {
      cell: (tenant) => (
        <time dateTime={tenant.createdAt}>
          {new Intl.DateTimeFormat(getFormatterLocale(locale), {
            dateStyle: "medium",
          }).format(new Date(tenant.createdAt))}
        </time>
      ),
      header: copy.createdAt,
      key: "createdAt",
    },
    ...(canManage
      ? [
          {
            cell: (tenant) => <TenantRowActions copy={copy} locale={locale} tenant={tenant} />,
            header: copy.actions,
            key: "actions",
          } satisfies DataTableColumn<TenantRow>,
        ]
      : []),
  ];

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={copy.localeLabels}
        localeTitle={copy.localeTitle}
        logoAlt={copy.logoAlt}
        pathname={`/${locale}/admin/platform/tenants`}
      />

      <PageHeader
        actions={
          <>
            <a className="tt-button tt-button--secondary" href={`/${locale}/admin/platform`}>
              {copy.back}
            </a>
            <form action={signOutAdmin}>
              <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
              <button className="tt-button tt-button--secondary" type="submit">
                {copy.signOut}
              </button>
            </form>
          </>
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        lines={copy.titleLines}
      />

      {statusMessage ? (
        <aside aria-live="polite" className="admin-notice admin-notice--success">
          <strong>{statusMessage}</strong>
        </aside>
      ) : null}
      {errorMessage ? (
        <aside aria-live="assertive" className="admin-notice admin-notice--danger">
          <strong>{errorMessage}</strong>
        </aside>
      ) : null}

      {canManage ? (
        <details className="admin-tenant-create">
          <summary>
            <span>{copy.createTitle}</span>
            <small>{copy.createDescription}</small>
          </summary>
          <form action={createTenant} className="admin-tenant-form">
            <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
            <div className="admin-tenant-field-grid">
              <label className="admin-field" htmlFor="tenant-create-name">
                <span>{copy.name}</span>
                <input id="tenant-create-name" maxLength={200} name="name" required />
              </label>
              <label className="admin-field" htmlFor="tenant-create-slug">
                <span>{copy.slug}</span>
                <input
                  id="tenant-create-slug"
                  maxLength={63}
                  minLength={2}
                  name="slug"
                  pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                  required
                />
                <small>{copy.slugHelp}</small>
              </label>
            </div>
            <label className="admin-field" htmlFor="tenant-create-reason">
              <span>{copy.reason}</span>
              <textarea
                id="tenant-create-reason"
                maxLength={500}
                minLength={3}
                name="reason"
                placeholder={copy.reasonPlaceholder}
                required
              />
            </label>
            <button className="tt-button" type="submit">
              {copy.create}
            </button>
          </form>
        </details>
      ) : (
        <p className="admin-catalog-read-only">{copy.readOnly}</p>
      )}

      <section className="admin-catalog-summary" aria-live="polite">
        <strong>{copy.total.replace("{count}", String(catalog.total))}</strong>
        <span>{copy.securityNote}</span>
      </section>

      <DataTable
        aria-label={copy.paginationLabel}
        columns={columns}
        empty={<EmptyState description={copy.emptyDescription} title={copy.emptyTitle} />}
        getRowKey={(tenant) => tenant.id}
        rows={catalog.items}
      />

      <Pagination
        aria-label={copy.paginationLabel}
        next={
          hasNext ? (
            <a
              className="tt-button tt-button--secondary"
              href={getPageHref(locale, catalog.page + 1)}
            >
              {copy.next}
            </a>
          ) : null
        }
        previous={
          hasPrevious ? (
            <a
              className="tt-button tt-button--secondary"
              href={getPageHref(locale, catalog.page - 1)}
            >
              {copy.previous}
            </a>
          ) : null
        }
        summary={pageSummary}
      />
    </>
  );
}
