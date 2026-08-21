import { ArrowRight, Funnel, MagnifyingGlass, Plus } from "@phosphor-icons/react/dist/ssr";
import type {
  ManagementCompanyCatalogPage,
  OrganizationStatus,
  SiteCatalogItem,
} from "@taptolk/application";
import { ConsoleTabs, MeterBar, Pagination, StatusPill } from "@taptolk/ui";
import type { AdminCompanyPortfolioCopy } from "../content/admin-company-portfolio-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface ManagementCompanyCopy {
  actions: string;
  address: string;
  addressHelp: string;
  back: string;
  businessNumber: string;
  businessNumberHelp: string;
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
  managementCode: string;
  managementCodeHelp: string;
  name: string;
  platformDirect: string;
  next: string;
  noActiveTenant: string;
  page: string;
  paginationLabel: string;
  previous: string;
  reactivate: string;
  readOnly: string;
  reason: string;
  reasonPlaceholder: string;
  save: string;
  securityNote: string;
  status: string;
  statusDescription: string;
  statusLabels: Readonly<Record<OrganizationStatus, string>>;
  suspend: string;
  tenant: string;
  total: string;
}

interface ManagementCompanyCatalogViewProps {
  canManage: boolean;
  catalog: ManagementCompanyCatalogPage;
  copy: ManagementCompanyCopy;
  errorMessage?: string | undefined;
  locale: AppLocale;
  portfolioCopy: AdminCompanyPortfolioCopy;
  search?: string | undefined;
  selectedCompanyId?: string | undefined;
  selectedSites: readonly SiteCatalogItem[];
  stateFilter?: OrganizationStatus | undefined;
  statusMessage?: string | undefined;
}

type CompanyRow = ManagementCompanyCatalogPage["items"][number];
type RiskLevel = CompanyRow["riskLevel"];
type ResponseQuality = CompanyRow["responseQuality"];

function getPageHref(input: {
  companyId?: string | undefined;
  locale: AppLocale;
  page: number;
  search?: string | undefined;
  stateFilter?: OrganizationStatus | undefined;
}): string {
  const params = new URLSearchParams({ page: String(input.page) });
  if (input.search) params.set("q", input.search);
  if (input.stateFilter) params.set("state", input.stateFilter);
  if (input.companyId) params.set("company", input.companyId);
  return `/${input.locale}/admin/platform/management-companies?${params.toString()}`;
}

function getCompanyHref(input: {
  companyId: string;
  locale: AppLocale;
  page: number;
  search?: string | undefined;
  stateFilter?: OrganizationStatus | undefined;
}): string {
  return getPageHref(input);
}

function percent(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function formatDate(locale: AppLocale, value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

function riskTone(riskLevel: RiskLevel): "danger" | "muted" | "success" | "warning" {
  return riskLevel === "RISK"
    ? "danger"
    : riskLevel === "WATCH"
      ? "warning"
      : riskLevel === "NORMAL"
        ? "muted"
        : "success";
}

function riskLabel(riskLevel: RiskLevel, copy: AdminCompanyPortfolioCopy): string {
  return riskLevel === "RISK"
    ? copy.riskRisk
    : riskLevel === "WATCH"
      ? copy.riskWatch
      : riskLevel === "NORMAL"
        ? copy.riskNormal
        : copy.riskGood;
}

function responseTone(quality: ResponseQuality): "danger" | "muted" | "success" | "warning" {
  return quality === "LOW"
    ? "danger"
    : quality === "GOOD"
      ? "success"
      : quality === "NORMAL"
        ? "warning"
        : "muted";
}

function responseLabel(quality: ResponseQuality, copy: AdminCompanyPortfolioCopy): string {
  return quality === "LOW"
    ? copy.responseLow
    : quality === "GOOD"
      ? copy.responseGood
      : quality === "NORMAL"
        ? copy.responseNormal
        : copy.noResponseData;
}

function planLabel(company: CompanyRow, copy: AdminCompanyPortfolioCopy): string {
  if (!company.contractPlan) {
    return copy.noContract;
  }
  return company.contractPlan
    .toLowerCase()
    .split(/[_-]+/u)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function contractStatusLabel(company: CompanyRow, copy: AdminCompanyPortfolioCopy): string {
  return company.contractStatus === "ACTIVE"
    ? copy.contractStatusActive
    : company.contractStatus === "DRAFT"
      ? copy.contractStatusDraft
      : company.contractStatus === "EXPIRED"
        ? copy.contractStatusExpired
        : company.contractStatus === "SUSPENDED"
          ? copy.contractStatusSuspended
          : company.contractStatus === "TERMINATED"
            ? copy.contractStatusTerminated
            : copy.noContract;
}

function shouldShowPlatformDirectBadge(company: CompanyRow, copy: ManagementCompanyCopy): boolean {
  return company.isPlatformDirect && !company.name.includes(copy.platformDirect);
}

export function ManagementCompanyCatalogView({
  canManage,
  catalog,
  copy,
  errorMessage,
  locale,
  portfolioCopy,
  search,
  selectedCompanyId,
  selectedSites,
  stateFilter,
  statusMessage,
}: ManagementCompanyCatalogViewProps) {
  const totalPages = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));
  const number = new Intl.NumberFormat(locale);
  const hasPrevious = catalog.page > 1;
  const hasNext = catalog.page < totalPages;
  const selectedCompany =
    catalog.items.find((company) => company.id === selectedCompanyId) ?? catalog.items[0];
  const currentPageActive = catalog.items.filter((company) => company.status === "ACTIVE").length;
  const currentPageSites = catalog.items.reduce((total, company) => total + company.siteCount, 0);
  const currentPageQr = catalog.items.reduce((total, company) => total + company.activeQrCount, 0);
  const reviewItems = catalog.items.filter(
    (company) => company.status !== "ACTIVE" || company.riskLevel === "RISK",
  );

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={copy.localeLabels}
        localeTitle={copy.localeTitle}
        logoAlt={copy.logoAlt}
        pathname={`/${locale}/admin/platform/management-companies`}
      />

      <div className="admin-reference-page admin-reference-page--customers">
        <section className="admin-reference-board" aria-labelledby="admin-customer-title">
          <header className="admin-reference-hero">
            <div>
              <p className="admin-reference-kicker">{copy.eyebrow}</p>
              <h1 id="admin-customer-title">{portfolioCopy.portfolioTitle}</h1>
              <p>{portfolioCopy.portfolioDescription}</p>
            </div>
            <div className="admin-reference-hero__meta">
              {canManage ? (
                <a
                  className="tt-button tt-button--compact"
                  href={`/${locale}/admin/platform/management-companies/new`}
                >
                  <Plus aria-hidden="true" size={16} />
                  {copy.createTitle}
                </a>
              ) : null}
            </div>
          </header>

          <section className="admin-reference-metrics" aria-label={portfolioCopy.companyPortfolio}>
            <article>
              <span>{portfolioCopy.totalCompanies}</span>
              <strong>{number.format(catalog.total)}</strong>
            </article>
            <article>
              <span>{portfolioCopy.activeCompanies}</span>
              <strong>{number.format(catalog.activeContractCount)}</strong>
            </article>
            <article>
              <span>{portfolioCopy.sites}</span>
              <strong>{number.format(catalog.siteTotal)}</strong>
            </article>
            <article>
              <span>{portfolioCopy.contractExpiring}</span>
              <strong>{number.format(catalog.expiringContractCount)}</strong>
            </article>
          </section>

          <ConsoleTabs
            ariaLabel={portfolioCopy.companyPortfolio}
            items={[
              {
                count: number.format(catalog.total),
                current: true,
                href: `/${locale}/admin/platform/management-companies`,
                id: "management-companies",
                label: portfolioCopy.companyPortfolio,
              },
              {
                count: number.format(catalog.siteTotal),
                href: `/${locale}/admin/sites`,
                id: "sites",
                label: portfolioCopy.sites,
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

          <form className="admin-reference-filter" method="get">
            <div className="admin-search-control admin-search-control--catalog">
              <MagnifyingGlass aria-hidden="true" size={17} />
              <label className="sr-only" htmlFor="company-search">
                {portfolioCopy.companySearch}
              </label>
              <input
                defaultValue={search}
                id="company-search"
                name="q"
                placeholder={portfolioCopy.companySearch}
                type="search"
              />
            </div>
            <label className="admin-filter-select" htmlFor="company-state-filter">
              <Funnel aria-hidden="true" size={16} />
              <span className="sr-only">{portfolioCopy.statusFilter}</span>
              <select defaultValue={stateFilter ?? ""} id="company-state-filter" name="state">
                <option value="">{portfolioCopy.allStatuses}</option>
                <option value="ACTIVE">{copy.statusLabels.ACTIVE}</option>
                <option value="SUSPENDED">{copy.statusLabels.SUSPENDED}</option>
                <option value="CLOSED">{copy.statusLabels.CLOSED}</option>
              </select>
            </label>
            <button className="tt-button tt-button--compact" type="submit">
              {portfolioCopy.applyFilters}
            </button>
            <a
              className="tt-button tt-button--secondary tt-button--compact"
              href={`/${locale}/admin/platform/management-companies`}
            >
              {portfolioCopy.clearFilters}
            </a>
          </form>

          <section className="admin-customer-workbench" aria-label={portfolioCopy.companyPortfolio}>
            <article className="admin-customer-column">
              <header>
                <span>{portfolioCopy.resultCompanies}</span>
                <strong>{portfolioCopy.companyColumnTitle}</strong>
              </header>
              <div className="admin-customer-list">
                {catalog.items.length > 0 ? (
                  catalog.items.map((company) => {
                    const isSelected = selectedCompany?.id === company.id;
                    return (
                      <a
                        aria-current={isSelected ? "true" : undefined}
                        href={getCompanyHref({
                          companyId: company.id,
                          locale,
                          page: catalog.page,
                          search,
                          stateFilter,
                        })}
                        key={company.id}
                      >
                        <strong>{company.name}</strong>
                        <small>
                          {portfolioCopy.sites} {number.format(company.siteCount)} ·{" "}
                          {planLabel(company, portfolioCopy)}
                        </small>
                        <span>
                          <StatusPill tone={riskTone(company.riskLevel)}>
                            {riskLabel(company.riskLevel, portfolioCopy)}
                          </StatusPill>
                          {shouldShowPlatformDirectBadge(company, copy) ? (
                            <small>{portfolioCopy.directOperation}</small>
                          ) : null}
                        </span>
                      </a>
                    );
                  })
                ) : (
                  <p className="admin-reference-empty">{copy.emptyDescription}</p>
                )}
              </div>
            </article>

            <article className="admin-customer-column">
              <header>
                <span>{portfolioCopy.hierarchyLabel}</span>
                <strong>{portfolioCopy.siteColumnTitle}</strong>
              </header>
              {selectedCompany ? (
                <>
                  <div className="admin-customer-scope-card">
                    <strong>{selectedCompany.name}</strong>
                    <span>
                      {portfolioCopy.sites} {number.format(selectedCompany.siteCount)} ·{" "}
                      {portfolioCopy.activeQr} {number.format(selectedCompany.activeQrCount)}
                    </span>
                    <MeterBar
                      tone={selectedCompany.qrActivationPercent >= 80 ? "success" : "warning"}
                      value={selectedCompany.qrActivationPercent}
                    />
                  </div>
                  <div className="admin-customer-site-list">
                    {selectedSites.length > 0 ? (
                      selectedSites.map((site) => (
                        <a
                          href={`/${locale}/admin/sites?company=${site.managementCompanyId}`}
                          key={site.id}
                        >
                          <span>
                            <strong>{site.name}</strong>
                            <small>{site.address ?? site.type}</small>
                          </span>
                          <span>
                            <StatusPill tone={site.status === "ACTIVE" ? "success" : "warning"}>
                              {copy.statusLabels[site.status]}
                            </StatusPill>
                            <small>
                              {portfolioCopy.siteCapacity}{" "}
                              {number.format(site.contractVehicleLimit)}
                            </small>
                          </span>
                        </a>
                      ))
                    ) : (
                      <p className="admin-reference-empty">{copy.emptyTitle}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="admin-reference-empty">{portfolioCopy.selectedCompanyEmpty}</p>
              )}
            </article>

            <article className="admin-customer-detail">
              <header>
                <span>{portfolioCopy.scopePanelTitle}</span>
                <strong>{portfolioCopy.detailColumnTitle}</strong>
              </header>
              {selectedCompany ? (
                <>
                  <div className="admin-customer-detail__title">
                    <StatusPill tone={selectedCompany.status === "ACTIVE" ? "success" : "warning"}>
                      {copy.statusLabels[selectedCompany.status]}
                    </StatusPill>
                    <h2>{selectedCompany.name}</h2>
                    <p>{selectedCompany.address ?? selectedCompany.tenantName}</p>
                  </div>
                  <dl className="admin-customer-detail__grid">
                    <div>
                      <dt>{portfolioCopy.planStatus}</dt>
                      <dd>
                        {planLabel(selectedCompany, portfolioCopy)} ·{" "}
                        {contractStatusLabel(selectedCompany, portfolioCopy)}
                      </dd>
                    </div>
                    <div>
                      <dt>{portfolioCopy.contractEnd}</dt>
                      <dd>{formatDate(locale, selectedCompany.contractEndsAt)}</dd>
                    </div>
                    <div>
                      <dt>{portfolioCopy.capacityUsage}</dt>
                      <dd>{percent(selectedCompany.capacityUsagePercent, locale)}%</dd>
                    </div>
                    <div>
                      <dt>{portfolioCopy.responseQuality}</dt>
                      <dd>
                        <StatusPill tone={responseTone(selectedCompany.responseQuality)}>
                          {responseLabel(selectedCompany.responseQuality, portfolioCopy)}
                        </StatusPill>
                      </dd>
                    </div>
                    <div>
                      <dt>{portfolioCopy.contractHealth}</dt>
                      <dd>
                        <StatusPill tone={riskTone(selectedCompany.riskLevel)}>
                          {riskLabel(selectedCompany.riskLevel, portfolioCopy)}
                        </StatusPill>
                      </dd>
                    </div>
                    <div>
                      <dt>{portfolioCopy.unresolved}</dt>
                      <dd>{number.format(selectedCompany.unresolvedContactCount)}</dd>
                    </div>
                  </dl>
                  <div className="admin-customer-detail__actions">
                    <a
                      href={`/${locale}/admin/platform/management-companies/${selectedCompany.id}`}
                    >
                      {portfolioCopy.details}
                      <ArrowRight aria-hidden="true" size={14} />
                    </a>
                    <a href={`/${locale}/admin/sites?company=${selectedCompany.id}`}>
                      {portfolioCopy.siteDetailAction}
                      <ArrowRight aria-hidden="true" size={14} />
                    </a>
                  </div>
                </>
              ) : (
                <p className="admin-reference-empty">{portfolioCopy.selectedCompanyEmpty}</p>
              )}
            </article>
          </section>

          <section className="admin-reference-monitor admin-reference-monitor--compact">
            <header>
              <div>
                <h2>{portfolioCopy.decisionQueue}</h2>
                <p>{portfolioCopy.decisionQueueDescription}</p>
              </div>
              <strong>{number.format(reviewItems.length)}</strong>
            </header>
            {reviewItems.length > 0 ? (
              <div className="admin-reference-list admin-reference-list--compact">
                {reviewItems.slice(0, 4).map((company) => (
                  <a
                    href={`/${locale}/admin/platform/management-companies/${company.id}`}
                    key={company.id}
                  >
                    <span>
                      <strong>{company.name}</strong>
                      <small>{portfolioCopy.reviewItemLabel}</small>
                    </span>
                    <StatusPill tone={riskTone(company.riskLevel)}>
                      {riskLabel(company.riskLevel, portfolioCopy)}
                    </StatusPill>
                  </a>
                ))}
              </div>
            ) : (
              <p className="admin-reference-empty">{portfolioCopy.decisionQueueEmptyDescription}</p>
            )}
          </section>

          <footer className="admin-catalog-footer admin-catalog-footer--reference">
            <span>{copy.total.replace("{count}", number.format(catalog.total))}</span>
            <span>
              {portfolioCopy.currentPageActive} {number.format(currentPageActive)} ·{" "}
              {portfolioCopy.currentPageSites} {number.format(currentPageSites)} ·{" "}
              {portfolioCopy.currentPageQr} {number.format(currentPageQr)}
            </span>
            <Pagination
              aria-label={copy.paginationLabel}
              className="admin-pagination admin-pagination--compact"
              next={
                hasNext ? (
                  <a
                    className="tt-button tt-button--secondary tt-button--compact"
                    href={getPageHref({
                      companyId: selectedCompany?.id,
                      locale,
                      page: catalog.page + 1,
                      search,
                      stateFilter,
                    })}
                  >
                    {copy.next}
                  </a>
                ) : (
                  <button
                    className="tt-button tt-button--secondary tt-button--compact"
                    disabled
                    type="button"
                  >
                    {copy.next}
                  </button>
                )
              }
              previous={
                hasPrevious ? (
                  <a
                    className="tt-button tt-button--secondary tt-button--compact"
                    href={getPageHref({
                      companyId: selectedCompany?.id,
                      locale,
                      page: catalog.page - 1,
                      search,
                      stateFilter,
                    })}
                  >
                    {copy.previous}
                  </a>
                ) : (
                  <button
                    className="tt-button tt-button--secondary tt-button--compact"
                    disabled
                    type="button"
                  >
                    {copy.previous}
                  </button>
                )
              }
              summary={copy.page
                .replace("{current}", String(catalog.page))
                .replace("{total}", String(totalPages))}
            />
          </footer>

          {!canManage ? <p className="admin-catalog-read-only">{copy.readOnly}</p> : null}
          <p className="admin-reference-scope-note">{copy.securityNote}</p>
        </section>
      </div>
    </>
  );
}
