import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  CaretLeft,
  CaretRight,
  Funnel,
  IdentificationCard,
  MagnifyingGlass,
  QrCode,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type {
  ManagementCompanyWorkspace,
  OrganizationStatus,
  SiteType,
} from "@taptolk/application";
import {
  ConsoleTabs,
  DataTable,
  type DataTableColumn,
  EmptyState,
  MeterBar,
  PageHeader,
  Pagination,
  StatStrip,
  StatTile,
  StatusPill,
} from "@taptolk/ui";
import { changeManagementCompanyStatus } from "../admin/management-company-actions";
import type { QrOperationsScopeSummary } from "../admin/qr-operations-scope-summary";
import type { AdminCompanyWorkspaceCopy } from "../content/admin-company-workspace-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface ManagementCompanyWorkspaceViewProps {
  accessHref?: string | undefined;
  backHref?: string | undefined;
  canManage: boolean;
  copy: AdminCompanyWorkspaceCopy;
  errorMessage?: string | undefined;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: ManagementCompanyWorkspace;
  page: number;
  pageSize: number;
  qrOperations: QrOperationsScopeSummary;
  siteSearch?: string | undefined;
  siteTypeLabels: Readonly<Record<SiteType, string>>;
  statusMessage?: string | undefined;
  statusLabels: Readonly<Record<OrganizationStatus, string>>;
  showBackLink?: boolean | undefined;
  workspaceBasePath?: string | undefined;
}

type SiteRow = ManagementCompanyWorkspace["sites"][number];

function registeredLabel(value: boolean, copy: AdminCompanyWorkspaceCopy): string {
  return value ? copy.registered : copy.notRegistered;
}

function headingLine(value: string): readonly [string] {
  return [value];
}

function statusTone(status: OrganizationStatus): "success" | "warning" {
  return status === "ACTIVE" ? "success" : "warning";
}

function hasContactInformation(model: ManagementCompanyWorkspace): boolean {
  return (
    model.representativePhoneRegistered ||
    model.contactName !== null ||
    model.contactPhoneRegistered ||
    model.contactEmail !== null ||
    model.operationsManagerName !== null ||
    model.operationsManagerPhoneRegistered ||
    model.operationsManagerEmail !== null
  );
}

function workspaceHref(basePath: string, page: number, pageSize: number, search?: string): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("q", search);
  return `${basePath}?${params.toString()}`;
}

export function ManagementCompanyWorkspaceView({
  accessHref: accessHrefProp,
  backHref: backHrefProp,
  canManage,
  copy,
  errorMessage,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
  page,
  pageSize,
  qrOperations,
  siteSearch,
  siteTypeLabels,
  statusMessage,
  statusLabels,
  showBackLink: showBackLinkProp,
  workspaceBasePath: workspaceBasePathProp,
}: ManagementCompanyWorkspaceViewProps) {
  const number = new Intl.NumberFormat(locale);
  const prefix = `/${locale}/admin`;
  const workspaceBasePath =
    workspaceBasePathProp ?? `${prefix}/platform/management-companies/${model.id}`;
  const accessHref = accessHrefProp ?? `${prefix}/platform/access?company=${model.id}`;
  const backHref = backHrefProp ?? `${prefix}/platform/management-companies`;
  const showBackLink = showBackLinkProp ?? true;
  const returnTo = workspaceBasePath;
  const normalizedSearch = siteSearch?.trim().toLocaleLowerCase(locale) ?? "";
  const filteredSites = normalizedSearch
    ? model.sites.filter((site) =>
        `${site.name} ${site.address ?? ""}`.toLocaleLowerCase(locale).includes(normalizedSearch),
      )
    : model.sites;
  const totalPages = Math.max(1, Math.ceil(filteredSites.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const visibleSites = filteredSites.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const sitePageHref = (nextPage: number) =>
    workspaceHref(workspaceBasePath, nextPage, pageSize, siteSearch);

  const siteColumns = [
    {
      cell: (site) => (
        <span className="tt-table-entity">
          <strong>{site.name}</strong>
          <small>{siteTypeLabels[site.type]}</small>
        </span>
      ),
      header: copy.locationName,
      key: "location",
    },
    {
      align: "right",
      cell: (site) => number.format(site.contractVehicleLimit),
      header: copy.capacity,
      key: "capacity",
    },
    {
      align: "right",
      cell: (site) => number.format(site.totalQrCount),
      header: copy.totalQr,
      key: "totalQr",
    },
    {
      cell: (site) => {
        const activation =
          site.totalQrCount > 0 ? Math.round((site.activeQrCount / site.totalQrCount) * 100) : 0;
        return (
          <div className="tt-table-meter">
            <MeterBar value={activation} />
            <span>{activation}%</span>
          </div>
        );
      },
      header: copy.qrActivation,
      key: "activation",
    },
    {
      align: "right",
      cell: (site) => number.format(site.batchCount),
      header: copy.batches,
      key: "batches",
    },
    {
      align: "center",
      cell: (site) => (
        <StatusPill tone={statusTone(site.status)}>{statusLabels[site.status]}</StatusPill>
      ),
      header: copy.status,
      key: "status",
    },
    {
      align: "right",
      cell: (site) => (
        <a className="admin-row-primary" href={`${prefix}/sites/${site.id}`}>
          {copy.viewLocation}
          <ArrowRight aria-hidden="true" size={15} />
        </a>
      ),
      header: <span className="sr-only">{copy.viewLocation}</span>,
      key: "actions",
    },
  ] satisfies Array<DataTableColumn<SiteRow>>;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={workspaceBasePath}
      />
      <div className="admin-workspace-canvas">
        {showBackLink ? (
          <a className="admin-inline-back" href={backHref}>
            <ArrowLeft aria-hidden="true" size={15} />
            {copy.allCompanies}
          </a>
        ) : null}
        <PageHeader
          actions={
            canManage ? (
              <a className="tt-button tt-button--compact" href={`${returnTo}/edit`}>
                {copy.editCompany}
              </a>
            ) : null
          }
          className="admin-compact-heading admin-compact-heading--workspace"
          description={copy.workspaceDescription}
          eyebrow={copy.companyWorkspace}
          lines={headingLine(model.name)}
        />

        <ConsoleTabs
          ariaLabel={copy.companyWorkspace}
          items={[
            {
              count: number.format(model.sites.length),
              current: true,
              href: returnTo,
              id: "company-overview",
              label: copy.companyWorkspace,
            },
            {
              count: number.format(qrOperations.totalQr),
              href: `${prefix}/qr-inventory?company=${model.id}`,
              id: "company-qr",
              label: copy.manageQr,
            },
            {
              href: `${prefix}/operations?company=${model.id}`,
              id: "company-operations",
              label: copy.operations,
            },
            {
              href: `${prefix}/reports?company=${model.id}`,
              id: "company-reports",
              label: copy.reports,
            },
            {
              href: accessHref,
              id: "company-access",
              label: copy.manageAccounts,
            },
          ]}
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

        <StatStrip className="admin-stat-strip admin-stat-strip--workspace" columns={4}>
          <StatTile
            icon={<Buildings aria-hidden="true" size={24} />}
            label={copy.locations}
            value={number.format(model.sites.length)}
          />
          <StatTile
            icon={<QrCode aria-hidden="true" size={24} />}
            label={copy.activeQr}
            value={number.format(qrOperations.activeQr)}
          />
          <StatTile
            icon={<IdentificationCard aria-hidden="true" size={24} />}
            label={copy.activeContracts}
            value={number.format(model.activeContractCount)}
          />
          <StatTile
            icon={<UsersThree aria-hidden="true" size={24} />}
            label={copy.administrators}
            value={number.format(model.adminCount)}
          />
        </StatStrip>

        <div className="admin-workspace-grid">
          <section className="admin-portfolio-panel admin-workspace-locations">
            <header className="admin-portfolio-panel__header">
              <div>
                <h2>{copy.locationHealth}</h2>
                <p>{copy.locationHealthDescription}</p>
              </div>
            </header>
            <form
              aria-label={copy.searchSites}
              className="admin-workspace-site-toolbar"
              method="get"
            >
              <div className="admin-search-control admin-search-control--catalog">
                <MagnifyingGlass aria-hidden="true" size={17} />
                <label className="sr-only" htmlFor="workspace-site-search">
                  {copy.searchSites}
                </label>
                <input
                  defaultValue={siteSearch}
                  id="workspace-site-search"
                  name="q"
                  placeholder={copy.searchSites}
                  type="search"
                />
              </div>
              <input
                id="workspace-filter-page-size"
                name="pageSize"
                type="hidden"
                value={pageSize}
              />
              <button className="tt-button tt-button--compact" type="submit">
                <Funnel aria-hidden="true" size={15} />
                {copy.applyFilters}
              </button>
              {siteSearch ? (
                <a className="tt-button tt-button--secondary tt-button--compact" href={returnTo}>
                  {copy.clearFilters}
                </a>
              ) : null}
            </form>
            <DataTable
              columns={siteColumns}
              empty={
                <EmptyState description={copy.locationHealthDescription} title={copy.noLocations} />
              }
              getRowKey={(site) => site.id}
              rows={visibleSites}
            />
            <footer className="admin-workspace-table-footer">
              <span>
                {copy.showing
                  .replace(
                    "{from}",
                    filteredSites.length === 0 ? "0" : String((currentPage - 1) * pageSize + 1),
                  )
                  .replace("{to}", String(Math.min(currentPage * pageSize, filteredSites.length)))
                  .replace("{total}", String(filteredSites.length))}
              </span>
              <Pagination
                aria-label={copy.paginationLabel}
                className="admin-pagination admin-pagination--compact"
                next={
                  currentPage < totalPages ? (
                    <a
                      className="tt-button tt-button--secondary tt-button--compact"
                      href={sitePageHref(currentPage + 1)}
                    >
                      <CaretRight aria-hidden="true" size={15} />
                      {copy.next}
                    </a>
                  ) : (
                    <span />
                  )
                }
                pages={Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <a
                      aria-current={pageNumber === currentPage ? "page" : undefined}
                      href={sitePageHref(pageNumber)}
                      key={pageNumber}
                    >
                      {pageNumber}
                    </a>
                  ),
                )}
                previous={
                  currentPage > 1 ? (
                    <a
                      className="tt-button tt-button--secondary tt-button--compact"
                      href={sitePageHref(currentPage - 1)}
                    >
                      <CaretLeft aria-hidden="true" size={15} />
                      {copy.previous}
                    </a>
                  ) : (
                    <span />
                  )
                }
                summary={copy.page
                  .replace("{current}", String(currentPage))
                  .replace("{total}", String(totalPages))}
              />
              <form
                aria-label={copy.pageSizeLabel}
                className="admin-workspace-page-size"
                method="get"
              >
                {siteSearch ? (
                  <input
                    id="workspace-page-size-search"
                    name="q"
                    type="hidden"
                    value={siteSearch}
                  />
                ) : null}
                <label htmlFor="workspace-page-size">{copy.pageSizeLabel}</label>
                <select defaultValue={String(pageSize)} id="workspace-page-size" name="pageSize">
                  {[10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </form>
            </footer>
          </section>

          <aside className="admin-workspace-rail">
            <section className="admin-workspace-rail__section">
              <div className="admin-workspace-rail__header">
                <h2>{copy.companyInformation}</h2>
                <StatusPill tone={statusTone(model.status)}>
                  {statusLabels[model.status]}
                </StatusPill>
              </div>
              <p>{copy.companyInformationDescription}</p>
              <dl>
                <div>
                  <dt>{copy.companyWorkspace}</dt>
                  <dd>{model.name}</dd>
                </div>
                <div>
                  <dt>{copy.address}</dt>
                  <dd>{model.address ?? "—"}</dd>
                </div>
                <div>
                  <dt>{copy.capacity}</dt>
                  <dd>{number.format(model.contractVehicleLimit)}</dd>
                </div>
                <div>
                  <dt>{copy.businessNumber}</dt>
                  <dd>{registeredLabel(model.businessNumber !== null, copy)}</dd>
                </div>
              </dl>
              <p className="admin-workspace-rail__note">{copy.scopeNote}</p>
            </section>

            <section className="admin-workspace-rail__section">
              <div className="admin-workspace-rail__header">
                <h2>{copy.manageQr}</h2>
                <a
                  className="admin-row-primary"
                  href={`${prefix}/qr-inventory?company=${model.id}`}
                >
                  {copy.viewQr}
                  <ArrowRight aria-hidden="true" size={15} />
                </a>
              </div>
              <dl>
                <div>
                  <dt>{copy.totalQr}</dt>
                  <dd>{number.format(qrOperations.totalQr)}</dd>
                </div>
                <div>
                  <dt>{copy.generatedQr}</dt>
                  <dd>{number.format(qrOperations.generatedQr)}</dd>
                </div>
                <div>
                  <dt>{copy.activeQr}</dt>
                  <dd>{number.format(qrOperations.activeQr)}</dd>
                </div>
                <div>
                  <dt>{copy.pendingActivation}</dt>
                  <dd>{number.format(qrOperations.pendingActivationQr)}</dd>
                </div>
                <div>
                  <dt>{copy.batches}</dt>
                  <dd>{number.format(qrOperations.totalBatches)}</dd>
                </div>
                <div>
                  <dt>{copy.outputReadyBatches}</dt>
                  <dd>{number.format(qrOperations.outputReadyBatches)}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-workspace-rail__section">
              <div className="admin-workspace-rail__header">
                <h2>{copy.contactInformation}</h2>
                {canManage ? (
                  <a
                    className="admin-row-primary"
                    href={`${returnTo}/edit#company-contact-information`}
                  >
                    {hasContactInformation(model) ? copy.edit : copy.addInformation}
                    <ArrowRight aria-hidden="true" size={15} />
                  </a>
                ) : null}
              </div>
              <p>{copy.contactInformationDescription}</p>
              <dl>
                <div>
                  <dt>{copy.representativePhone}</dt>
                  <dd>{registeredLabel(model.representativePhoneRegistered, copy)}</dd>
                </div>
                <div>
                  <dt>{copy.contactName}</dt>
                  <dd>{model.contactName ?? "—"}</dd>
                </div>
                <div>
                  <dt>{copy.contactPhoneRegistered}</dt>
                  <dd>{registeredLabel(model.contactPhoneRegistered, copy)}</dd>
                </div>
                <div>
                  <dt>{copy.contactEmail}</dt>
                  <dd>{model.contactEmail ?? "—"}</dd>
                </div>
                <div>
                  <dt>{copy.operationsManagerName}</dt>
                  <dd>{model.operationsManagerName ?? "—"}</dd>
                </div>
                <div>
                  <dt>{copy.operationsManagerPhone}</dt>
                  <dd>{registeredLabel(model.operationsManagerPhoneRegistered, copy)}</dd>
                </div>
                <div>
                  <dt>{copy.operationsManagerEmail}</dt>
                  <dd>{model.operationsManagerEmail ?? "—"}</dd>
                </div>
              </dl>
            </section>

            {canManage && model.status !== "CLOSED" ? (
              <section className="admin-workspace-rail__section">
                <h2>{copy.statusActions}</h2>
                <p>{copy.statusActionsDescription}</p>
                <form
                  action={changeManagementCompanyStatus}
                  aria-label={copy.statusActions}
                  className="admin-workspace-status-form"
                >
                  <input id="company-status-locale" name="locale" type="hidden" value={locale} />
                  <input id="company-status-id" name="companyId" type="hidden" value={model.id} />
                  <input
                    id="company-status-current"
                    name="currentStatus"
                    type="hidden"
                    value={model.status}
                  />
                  <input
                    id="company-status-version"
                    name="expectedVersion"
                    type="hidden"
                    value={model.version}
                  />
                  <input
                    id="company-status-tenant"
                    name="tenantId"
                    type="hidden"
                    value={model.tenantId}
                  />
                  <input
                    id="company-status-return"
                    name="returnTo"
                    type="hidden"
                    value={returnTo}
                  />
                  <label htmlFor="company-status-reason">{copy.reason}</label>
                  <textarea
                    id="company-status-reason"
                    name="reason"
                    placeholder={copy.reasonPlaceholder}
                    required
                  />
                  <div className="admin-workspace-status-form__actions">
                    {model.status === "SUSPENDED" ? (
                      <button
                        className="tt-button tt-button--compact"
                        name="nextStatus"
                        type="submit"
                        value="ACTIVE"
                      >
                        {copy.reactivate}
                      </button>
                    ) : null}
                    <button
                      className="tt-button tt-button--secondary tt-button--compact"
                      name="nextStatus"
                      type="submit"
                      value="SUSPENDED"
                    >
                      {copy.suspend}
                    </button>
                    <button
                      className="tt-button tt-button--danger tt-button--compact"
                      name="nextStatus"
                      type="submit"
                      value="CLOSED"
                    >
                      {copy.close}
                    </button>
                  </div>
                </form>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
