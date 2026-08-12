import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  DownloadSimple,
  MapPin,
  Minus,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import type { QrBatchStatus, QrOperationsBatch, QrOperationsReadModel } from "@taptolk/application";
import {
  QR_DIRECT_GENERATION_QUANTITY_MAX,
  QR_DIRECT_GENERATION_QUANTITY_MIN,
} from "@taptolk/application";
import {
  ConsoleTabs,
  DataTable,
  type DataTableColumn,
  EmptyState,
  MeterBar,
  PageHeader,
  StatusPill,
} from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import { requestAdminDirectQrGeneration } from "../admin/qr-direct-generation-actions";
import type { AdminQrOperationsCopy } from "../content/admin-qr-operations-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";
import { ConsoleQueryForm } from "./console-query-form";
import { QrGenerationProgressPoller } from "./qr-generation-progress-poller";
import { QrScopeSelector } from "./qr-scope-selector";

interface QrOperationsViewProps {
  activeBatchIds?: readonly string[] | undefined;
  activeRequestId?: string | undefined;
  batchPage: number;
  batchPageSize: number;
  confirmed: boolean;
  copy: AdminQrOperationsCopy;
  errorMessage?: string | undefined;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  operationsModel: QrOperationsReadModel;
  selectedCompanyId?: string | undefined;
  selectedQuantity: number;
  selectedSiteId?: string | undefined;
  sitePage: number;
  sitePageSize: number;
  statusMessage?: string | undefined;
}

function headingLine(value: string): readonly [string] {
  return [value];
}

function statusTone(status: QrBatchStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "COMPLETED" || status === "DELIVERED" || status === "GENERATED") return "success";
  if (status === "PARTIALLY_COMPLETED") return "warning";
  if (status === "DRAFT") return "neutral";
  return "info";
}

function percent(done: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
}

function clampQuantity(value: number): number {
  if (!Number.isInteger(value)) return 100;
  return Math.min(
    QR_DIRECT_GENERATION_QUANTITY_MAX,
    Math.max(QR_DIRECT_GENERATION_QUANTITY_MIN, value),
  );
}

function formatAddress(value: string | null, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function withQuery(locale: AppLocale, params: Record<string, string | number | undefined>): Route {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return `/${locale}/admin/qr-inventory?${search.toString()}` as Route;
}

function batchProgress(batch: QrOperationsBatch): number {
  return percent(batch.generatedQuantity, batch.requestedQuantity);
}

function formatTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    template,
  );
}

function quantityPlan(quantity: number) {
  const batchSize = 100;
  const batches = Math.ceil(quantity / batchSize);
  const last = quantity % batchSize || batchSize;
  return { batches, last };
}

function aggregateProgress(batches: readonly QrOperationsBatch[]) {
  return batches.reduce(
    (memo, batch) => {
      memo.failed += batch.failedQuantity;
      memo.generated += batch.generatedQuantity;
      memo.passed += batch.passedQuantity;
      memo.ready = memo.ready && batch.downloadReady;
      memo.rendered += batch.renderedQuantity;
      memo.requested += batch.requestedQuantity;
      return memo;
    },
    { failed: 0, generated: 0, passed: 0, ready: batches.length > 0, rendered: 0, requested: 0 },
  );
}

function stepClass(index: number, activeStep: number): string {
  if (index < activeStep) return "is-complete";
  if (index === activeStep) return "is-active";
  return "is-locked";
}

function isTerminalBatchStatus(status: QrBatchStatus): boolean {
  return ["CANCELLED", "COMPLETED", "DELIVERED", "FAILED", "PARTIALLY_COMPLETED"].includes(status);
}

function clampPage(value: number, totalPages: number): number {
  if (!Number.isInteger(value)) return 1;
  return Math.min(Math.max(value, 1), totalPages);
}

function clampPageSize(value: number): 10 | 20 | 50 {
  return value === 20 || value === 50 ? value : 10;
}

function visiblePages(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function quantityHref(
  locale: AppLocale,
  company: string | undefined,
  site: string | undefined,
  quantity: number,
): Route {
  return withQuery(locale, {
    company,
    confirmed: 1,
    quantity: clampQuantity(quantity),
    site,
  });
}

export function QrOperationsView({
  activeBatchIds = [],
  activeRequestId,
  batchPage,
  batchPageSize,
  confirmed,
  copy,
  errorMessage,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  operationsModel,
  selectedCompanyId,
  selectedQuantity,
  selectedSiteId,
  sitePage,
  sitePageSize,
  statusMessage,
}: QrOperationsViewProps) {
  const number = new Intl.NumberFormat(locale);
  const companiesWithSites = operationsModel.companies.filter((company) =>
    operationsModel.sites.some((site) => site.managementCompanyId === company.id),
  );
  const company =
    companiesWithSites.find((item) => item.id === selectedCompanyId) ?? companiesWithSites[0];
  const companySites = company
    ? operationsModel.sites.filter((site) => site.managementCompanyId === company.id)
    : [];
  const selectedSite =
    companySites.find((site) => site.id === selectedSiteId) ?? companySites[0] ?? null;
  const quantity = clampQuantity(selectedQuantity);
  const scopeConfirmed = Boolean(confirmed && company && selectedSite);
  const scopedBatches = selectedSite
    ? operationsModel.batches.filter((batch) => batch.siteId === selectedSite.id)
    : operationsModel.batches;
  const companyHref = company?.id;
  const siteHref = selectedSite?.id;
  const activeBatchIdSet = new Set(activeBatchIds);
  const trackedBatches = activeRequestId
    ? scopedBatches.filter((batch) => batch.directGenerationRequestId === activeRequestId)
    : activeBatchIdSet.size > 0
      ? scopedBatches.filter((batch) => activeBatchIdSet.has(batch.id))
      : [];
  const trackedProgress = aggregateProgress(trackedBatches);
  const hasTrackedRequest = Boolean(activeRequestId || activeBatchIds.length > 0);
  const hasTrackedBatches = trackedBatches.length > 0;
  const progressRequested = trackedProgress.requested || (hasTrackedRequest ? quantity : 0);
  const trackedProgressPercent = percent(trackedProgress.generated, progressRequested);
  const downloadReady = hasTrackedBatches && trackedProgress.ready;
  const allTrackedBatchesTerminal =
    hasTrackedBatches && trackedBatches.every((batch) => isTerminalBatchStatus(batch.status));
  const shouldPollProgress = hasTrackedRequest && !downloadReady && !allTrackedBatchesTerminal;
  const activeStep = hasTrackedRequest ? (downloadReady ? 3 : 2) : scopeConfirmed ? 1 : 0;
  const plan = quantityPlan(quantity);
  const idempotencyKey = crypto.randomUUID();
  const companyById = new Map(operationsModel.companies.map((item) => [item.id, item]));
  const pageSize = clampPageSize(batchPageSize);
  const totalBatchPages = Math.max(1, Math.ceil(scopedBatches.length / pageSize));
  const currentBatchPage = clampPage(batchPage, totalBatchPages);
  const batchPageStart = (currentBatchPage - 1) * pageSize;
  const pagedBatches = scopedBatches.slice(batchPageStart, batchPageStart + pageSize);
  const batchRangeStart = scopedBatches.length === 0 ? 0 : batchPageStart + 1;
  const batchRangeEnd = Math.min(scopedBatches.length, batchPageStart + pagedBatches.length);
  const batchQueryBase = {
    batches: activeBatchIds.join(","),
    company: companyHref,
    confirmed: scopeConfirmed ? 1 : undefined,
    quantity,
    request: activeRequestId,
    site: siteHref,
  };

  const sitePageSizeValue = clampPageSize(sitePageSize);
  const totalSitePages = Math.max(1, Math.ceil(operationsModel.sites.length / sitePageSizeValue));
  const currentSitePage = clampPage(sitePage, totalSitePages);
  const sitePageStart = (currentSitePage - 1) * sitePageSizeValue;
  const pagedSites = operationsModel.sites.slice(sitePageStart, sitePageStart + sitePageSizeValue);
  const siteRangeStart = operationsModel.sites.length === 0 ? 0 : sitePageStart + 1;
  const siteRangeEnd = Math.min(operationsModel.sites.length, sitePageStart + pagedSites.length);
  const siteQueryBase = {
    batches: activeBatchIds.join(","),
    company: companyHref,
    confirmed: scopeConfirmed ? 1 : undefined,
    page: currentBatchPage,
    pageSize,
    quantity,
    request: activeRequestId,
    site: siteHref,
  };

  const columns = [
    {
      cell: (batch) => (
        <span className="tt-table-entity">
          <strong>{batch.batchCode}</strong>
          <small>
            {companyById.get(batch.managementCompanyId)?.name ?? copy.company} · {batch.siteName}
          </small>
        </span>
      ),
      header: copy.batch,
      key: "batch",
    },
    {
      align: "right",
      cell: (batch) => number.format(batch.requestedQuantity),
      header: copy.totalQr,
      key: "requested",
    },
    {
      cell: (batch) => {
        const progress = batchProgress(batch);
        return (
          <div className="admin-meter-cell">
            <strong>
              {number.format(batch.generatedQuantity)} / {number.format(batch.requestedQuantity)}
            </strong>
            <MeterBar
              tone={progress >= 100 ? "success" : progress > 0 ? "warning" : "muted"}
              value={progress}
            />
          </div>
        );
      },
      header: copy.generatedQr,
      key: "generated",
    },
    {
      cell: (batch) => (
        <span className="qr-operations-output-cell">
          <strong>{batch.downloadReady ? copy.readyDownload : copy.downloadPending}</strong>
          <small>
            {copy.progressRendered} {number.format(batch.renderedQuantity)} · {copy.progressQuality}{" "}
            {number.format(batch.passedQuantity)}
          </small>
          {batch.failedQuantity > 0 ? (
            <small>
              {copy.progressFailed} {number.format(batch.failedQuantity)}
            </small>
          ) : null}
        </span>
      ),
      header: copy.progressOutput,
      key: "output",
    },
    {
      cell: (batch) => (
        <StatusPill tone={statusTone(batch.status)}>{copy.statusLabels[batch.status]}</StatusPill>
      ),
      header: copy.status,
      key: "status",
    },
    {
      align: "right",
      cell: (batch) =>
        batch.downloadReady ? (
          <a
            className="tt-button tt-button--secondary tt-button--compact"
            href={`/api/admin/qr-batches/${batch.id}/svg-bundle`}
          >
            <DownloadSimple aria-hidden="true" size={14} />
            {copy.downloadSvg}
          </a>
        ) : (
          <span className="admin-catalog-read-only">{copy.downloadPending}</span>
        ),
      header: copy.downloadSvg,
      key: "download",
    },
  ] satisfies Array<DataTableColumn<QrOperationsBatch>>;

  const siteColumns = [
    {
      cell: (site) => (
        <span className="tt-table-entity">
          <strong>{site.name}</strong>
          <small>{companyById.get(site.managementCompanyId)?.name ?? copy.company}</small>
        </span>
      ),
      header: copy.site,
      key: "site",
    },
    {
      align: "right",
      cell: (site) => number.format(site.totalQr),
      header: copy.siteTotal,
      key: "total",
    },
    {
      align: "right",
      cell: (site) => number.format(site.activeQr),
      header: copy.siteActiveQr,
      key: "active",
    },
    {
      align: "right",
      cell: (site) => number.format(site.pendingActivationQr),
      header: copy.sitePendingActivation,
      key: "pending",
    },
    {
      align: "right",
      cell: (site) => number.format(site.batchCount),
      header: copy.siteBatches,
      key: "batches",
    },
    {
      cell: (site) => (
        <StatusPill
          tone={
            site.status === "ACTIVE"
              ? "success"
              : site.status === "SUSPENDED"
                ? "warning"
                : "danger"
          }
        >
          {copy.siteStatusLabels[site.status] ?? site.status}
        </StatusPill>
      ),
      header: copy.status,
      key: "status",
    },
    {
      align: "right",
      cell: (site) => (
        <Link
          className="tt-button tt-button--secondary tt-button--compact"
          href={`/${locale}/admin/qr-inventory/sites/${site.id}` as Route}
        >
          {copy.siteOpenOperations}
        </Link>
      ),
      header: copy.operationsPanel,
      key: "operations",
    },
  ] satisfies Array<DataTableColumn<(typeof operationsModel.sites)[number]>>;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`/${locale}/admin/qr-inventory`}
      />

      <div className="admin-catalog-canvas qr-console-v2-canvas console-page">
        <PageHeader
          className="admin-compact-heading admin-catalog-heading qr-console-v2-page-heading"
          description={copy.description}
          eyebrow={copy.eyebrow}
          lines={headingLine(copy.title)}
        />
        <div className="qr-console-v2-progress-actions">
          <span className="qr-console-v2-help">{copy.siteOperationsDescription}</span>
        </div>

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

        <ConsoleTabs
          ariaLabel={copy.operationsPanel}
          className="qr-console-v2-tabs"
          items={[
            { current: true, href: "#qr-generation", id: "generation", label: copy.issue },
            {
              count: operationsModel.totals.totalBatches,
              href: "#qr-batches",
              id: "batches",
              label: copy.batchOperations,
            },
            {
              count: operationsModel.totals.completedBatches,
              href: "#qr-batches",
              id: "download",
              label: copy.downloadSvg,
            },
            { href: "#qr-batches", id: "failed", label: copy.progressFailed },
          ]}
        />

        <section className="qr-console-v2-workbench" id="qr-generation">
          <div className="qr-console-v2-workbench__main">
            <header className="qr-console-v2-toolbar">
              <span className="qr-console-v2-chip is-active">{copy.flowEyebrow}</span>
              <span className="qr-console-v2-chip">
                {copy.quantityLimit} {number.format(QR_DIRECT_GENERATION_QUANTITY_MIN)}-
                {number.format(QR_DIRECT_GENERATION_QUANTITY_MAX)}
              </span>
              <span className="qr-console-v2-chip">{copy.generationPolicy}</span>
            </header>

            <ol className="qr-console-v2-steps" aria-label={copy.flowTitle}>
              <li
                className={`qr-console-v2-step ${stepClass(0, activeStep)}`}
                aria-labelledby="qr-scope-title"
              >
                <span className="qr-console-v2-step__marker">1</span>
                <div className="qr-console-v2-step__body">
                  <div className="qr-console-v2-step__head">
                    <div>
                      <span className="admin-hierarchy-label">{copy.stepScope}</span>
                      <h3 id="qr-scope-title">{copy.scopePanel}</h3>
                    </div>
                    {scopeConfirmed ? (
                      <StatusPill tone="success">{copy.confirmed}</StatusPill>
                    ) : null}
                  </div>

                  {activeStep === 0 ? (
                    <>
                      <QrScopeSelector
                        companies={companiesWithSites}
                        companyLabel={copy.company}
                        initialCompanyId={company?.id ?? ""}
                        initialSiteId={selectedSite?.id ?? ""}
                        key={`${company?.id ?? ""}:${selectedSite?.id ?? ""}`}
                        locale={locale}
                        quantity={quantity}
                        reviewLabel={copy.selectScope}
                        siteLabel={copy.site}
                        sites={operationsModel.sites}
                      />

                      <div className="qr-console-v2-summary-grid">
                        <div>
                          <span>{copy.selectedCompany}</span>
                          <strong>{company?.name ?? copy.emptyCompany}</strong>
                          <small>
                            <MapPin aria-hidden="true" size={13} />
                            {formatAddress(company?.address ?? null, copy.addressEmpty)}
                          </small>
                        </div>
                        <div>
                          <span>{copy.selectedSite}</span>
                          <strong>{selectedSite?.name ?? copy.emptySite}</strong>
                          <small>
                            <MapPin aria-hidden="true" size={13} />
                            {formatAddress(selectedSite?.address ?? null, copy.addressEmpty)}
                          </small>
                        </div>
                      </div>

                      {companyHref && siteHref ? (
                        <Link
                          className="tt-button"
                          href={withQuery(locale, {
                            company: companyHref,
                            confirmed: 1,
                            quantity,
                            site: siteHref,
                          })}
                        >
                          <CheckCircle aria-hidden="true" size={16} />
                          {copy.confirmSelection}
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <div className="qr-console-v2-compact-summary">
                      <strong>
                        {company?.name ?? copy.emptyCompany} ·{" "}
                        {selectedSite?.name ?? copy.emptySite}
                      </strong>
                      <Link
                        className="tt-button tt-button--ghost tt-button--compact"
                        href={withQuery(locale, {
                          company: companyHref,
                          quantity,
                          site: siteHref,
                        })}
                      >
                        {copy.editSelection}
                      </Link>
                    </div>
                  )}
                </div>
              </li>

              <li
                className={`qr-console-v2-step ${stepClass(1, activeStep)}`}
                aria-labelledby="qr-quantity-title"
              >
                <span className="qr-console-v2-step__marker">2</span>
                <div className="qr-console-v2-step__body">
                  <div className="qr-console-v2-step__head">
                    <div>
                      <span className="admin-hierarchy-label">{copy.stepQuantity}</span>
                      <h3 id="qr-quantity-title">{copy.quantity}</h3>
                    </div>
                    <StatusPill tone={scopeConfirmed ? "info" : "neutral"}>
                      {number.format(quantity)}
                    </StatusPill>
                  </div>

                  {activeStep === 1 ? (
                    <>
                      <ConsoleQueryForm className="qr-console-v2-quantity">
                        <input
                          aria-label="company"
                          name="company"
                          type="hidden"
                          value={companyHref ?? ""}
                        />
                        <input aria-label="site" name="site" type="hidden" value={siteHref ?? ""} />
                        <input aria-label="confirmed" name="confirmed" type="hidden" value="1" />
                        <div className="qr-console-v2-quantity-control">
                          <Link
                            aria-label={copy.quantityDecrease}
                            className="tt-button tt-button--secondary tt-button--compact"
                            href={quantityHref(locale, companyHref, siteHref, quantity - 10)}
                          >
                            <Minus aria-hidden="true" size={14} />
                          </Link>
                          <label className="admin-field" htmlFor="qr-quantity">
                            <span>{copy.directQuantity}</span>
                            <input
                              defaultValue={quantity}
                              id="qr-quantity"
                              key={`qr-quantity-${quantity}`}
                              max={QR_DIRECT_GENERATION_QUANTITY_MAX}
                              min={QR_DIRECT_GENERATION_QUANTITY_MIN}
                              name="quantity"
                              type="number"
                            />
                          </label>
                          <Link
                            aria-label={copy.quantityIncrease}
                            className="tt-button tt-button--secondary tt-button--compact"
                            href={quantityHref(locale, companyHref, siteHref, quantity + 10)}
                          >
                            <Plus aria-hidden="true" size={14} />
                          </Link>
                          <button
                            className="tt-button tt-button--secondary tt-button--compact"
                            type="submit"
                          >
                            {copy.applyQuantity}
                          </button>
                        </div>
                        <fieldset className="qr-console-v2-adjustments">
                          <legend>{copy.quantityFastAdjust}</legend>
                          {[
                            { label: copy.quantityMin, value: QR_DIRECT_GENERATION_QUANTITY_MIN },
                            { label: "-1,000", value: quantity - 1000 },
                            { label: "-100", value: quantity - 100 },
                            { label: "+100", value: quantity + 100 },
                            { label: "+1,000", value: quantity + 1000 },
                            { label: copy.quantityMax, value: QR_DIRECT_GENERATION_QUANTITY_MAX },
                          ].map((item) => (
                            <Link
                              className="tt-button tt-button--secondary tt-button--compact"
                              href={quantityHref(locale, companyHref, siteHref, item.value)}
                              key={item.label}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </fieldset>
                        <fieldset className="qr-console-v2-presets">
                          <legend>{copy.quantityPresets}</legend>
                          {[10, 50, 100, 500, 1000, 5000, 10000].map((value) => (
                            <Link
                              aria-current={quantity === value ? "true" : undefined}
                              className="tt-button tt-button--secondary tt-button--compact qr-console-v2-chip"
                              href={quantityHref(locale, companyHref, siteHref, value)}
                              key={value}
                            >
                              {number.format(value)}
                            </Link>
                          ))}
                        </fieldset>
                        <p className="qr-console-v2-help">{copy.quantityHelp}</p>
                      </ConsoleQueryForm>

                      <form
                        action={requestAdminDirectQrGeneration}
                        className="qr-console-v2-review"
                      >
                        <input aria-label="locale" name="locale" type="hidden" value={locale} />
                        <input
                          aria-label="company"
                          name="companyId"
                          type="hidden"
                          value={company?.id ?? ""}
                        />
                        <input
                          aria-label="site"
                          name="siteId"
                          type="hidden"
                          value={selectedSite?.id ?? ""}
                        />
                        <input
                          aria-label="site version"
                          name="expectedSiteVersion"
                          type="hidden"
                          value={selectedSite?.version ?? 0}
                        />
                        <input
                          aria-label="idempotency key"
                          name="idempotencyKey"
                          type="hidden"
                          value={idempotencyKey}
                        />
                        <input
                          aria-label="quantity"
                          name="quantity"
                          type="hidden"
                          value={quantity}
                        />
                        <input
                          aria-label="reason"
                          name="reason"
                          type="hidden"
                          value={copy.hiddenReason}
                        />
                        <div className="qr-console-v2-review-summary">
                          <span>{copy.finalReview}</span>
                          <strong>
                            {company?.name ?? copy.emptyCompany} ·{" "}
                            {selectedSite?.name ?? copy.emptySite}
                          </strong>
                          <small>
                            {formatTemplate(copy.requestQuantity, {
                              count: number.format(quantity),
                            })}
                          </small>
                          <small>
                            {formatTemplate(copy.splitPlan, {
                              batches: number.format(plan.batches),
                              count: number.format(quantity),
                              last: number.format(plan.last),
                            })}
                          </small>
                        </div>
                        <button className="tt-button" disabled={!scopeConfirmed} type="submit">
                          {copy.reviewAndGenerate}
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="qr-console-v2-compact-summary">
                      <strong>
                        {formatTemplate(copy.splitPlan, {
                          batches: number.format(plan.batches),
                          count: number.format(quantity),
                          last: number.format(plan.last),
                        })}
                      </strong>
                    </div>
                  )}
                </div>
              </li>

              <li
                className={`qr-console-v2-step ${stepClass(2, activeStep)}`}
                aria-labelledby="qr-progress-title"
              >
                <span className="qr-console-v2-step__marker">3</span>
                <div className="qr-console-v2-step__body">
                  <div className="qr-console-v2-step__head">
                    <div>
                      <span className="admin-hierarchy-label">{copy.stepProgress}</span>
                      <h3 id="qr-progress-title">{copy.progressTitle}</h3>
                    </div>
                    <StatusPill
                      tone={downloadReady ? "success" : hasTrackedRequest ? "warning" : "neutral"}
                    >
                      {downloadReady
                        ? copy.readyDownload
                        : hasTrackedRequest
                          ? copy.stepProgress
                          : copy.stepLocked}
                    </StatusPill>
                  </div>
                  <div className="qr-console-v2-progress">
                    <p className="qr-console-v2-help">
                      {hasTrackedBatches
                        ? copy.progressDescription
                        : hasTrackedRequest
                          ? copy.progressPending
                          : copy.progressEmpty}
                    </p>
                    {hasTrackedRequest ? (
                      <>
                        <div className="qr-console-v2-progress__meter">
                          <strong>
                            {trackedProgressPercent}% · {number.format(trackedProgress.generated)} /{" "}
                            {number.format(progressRequested)}
                          </strong>
                          <MeterBar
                            tone={trackedProgressPercent >= 100 ? "success" : "warning"}
                            value={trackedProgressPercent}
                          />
                        </div>
                        <dl className="qr-console-v2-progress-grid">
                          <div>
                            <dt>{copy.generatedQr}</dt>
                            <dd>{number.format(trackedProgress.generated)}</dd>
                          </div>
                          <div>
                            <dt>{copy.progressRendered}</dt>
                            <dd>{number.format(trackedProgress.rendered)}</dd>
                          </div>
                          <div>
                            <dt>{copy.progressQuality}</dt>
                            <dd>{number.format(trackedProgress.passed)}</dd>
                          </div>
                          <div>
                            <dt>{copy.progressFailed}</dt>
                            <dd>{number.format(trackedProgress.failed)}</dd>
                          </div>
                        </dl>
                        <QrGenerationProgressPoller
                          active={shouldPollProgress}
                          label={copy.progressAutoRefresh}
                        />
                        <div className="qr-console-v2-progress-actions">
                          <Link
                            className="tt-button tt-button--secondary tt-button--compact"
                            href={withQuery(locale, {
                              ...batchQueryBase,
                              page: currentBatchPage,
                              pageSize,
                            })}
                          >
                            {copy.refreshProgress}
                          </Link>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>

              <li
                className={`qr-console-v2-step ${stepClass(3, activeStep)}`}
                aria-labelledby="qr-download-title"
              >
                <span className="qr-console-v2-step__marker">4</span>
                <div className="qr-console-v2-step__body">
                  <div className="qr-console-v2-step__head">
                    <div>
                      <span className="admin-hierarchy-label">{copy.downloadSvg}</span>
                      <h3 id="qr-download-title">{copy.downloadSvg}</h3>
                    </div>
                    <StatusPill
                      tone={downloadReady ? "success" : hasTrackedRequest ? "warning" : "neutral"}
                    >
                      {downloadReady
                        ? copy.readyDownload
                        : hasTrackedRequest
                          ? copy.downloadPending
                          : copy.stepLocked}
                    </StatusPill>
                  </div>
                  {downloadReady ? (
                    <div className="qr-console-v2-progress-actions">
                      {trackedBatches.length <= 3 ? (
                        trackedBatches
                          .filter((batch) => batch.downloadReady)
                          .map((batch) => (
                            <a
                              className="tt-button tt-button--compact"
                              href={`/api/admin/qr-batches/${batch.id}/svg-bundle`}
                              key={batch.id}
                            >
                              <DownloadSimple aria-hidden="true" size={14} />
                              {batch.batchCode}
                            </a>
                          ))
                      ) : (
                        <Link
                          className="tt-button tt-button--secondary tt-button--compact"
                          href="#qr-batches"
                        >
                          {copy.batchOperations}
                        </Link>
                      )}
                    </div>
                  ) : hasTrackedRequest ? (
                    <p className="qr-console-v2-help">{copy.downloadPendingDescription}</p>
                  ) : null}
                </div>
              </li>
            </ol>
          </div>

          <aside className="qr-console-v2-rail" aria-label={copy.reviewSummary}>
            <div>
              <span className="admin-hierarchy-label">{copy.workflowState}</span>
              <h3>{copy.steps[activeStep] ?? copy.stepLocked}</h3>
            </div>
            <dl>
              <div>
                <dt>{copy.company}</dt>
                <dd>{company?.name ?? copy.emptyCompany}</dd>
              </div>
              <div>
                <dt>{copy.site}</dt>
                <dd>{selectedSite?.name ?? copy.emptySite}</dd>
              </div>
              <div>
                <dt>{copy.quantity}</dt>
                <dd>{number.format(quantity)}</dd>
              </div>
              <div>
                <dt>{copy.batchPlan}</dt>
                <dd>
                  {formatTemplate(copy.splitPlan, {
                    batches: number.format(plan.batches),
                    count: number.format(quantity),
                    last: number.format(plan.last),
                  })}
                </dd>
              </div>
              <div>
                <dt>{copy.progressOutput}</dt>
                <dd>{downloadReady ? copy.readyDownload : copy.downloadPending}</dd>
              </div>
            </dl>
            <div className="qr-console-v2-progress-actions">
              {downloadReady && trackedBatches.length <= 3 ? (
                trackedBatches
                  .filter((batch) => batch.downloadReady)
                  .map((batch) => (
                    <a
                      className="tt-button tt-button--compact"
                      href={`/api/admin/qr-batches/${batch.id}/svg-bundle`}
                      key={batch.id}
                    >
                      <DownloadSimple aria-hidden="true" size={14} />
                      {batch.batchCode}
                    </a>
                  ))
              ) : (
                <span className="qr-console-v2-chip">{copy.downloadPending}</span>
              )}
            </div>
          </aside>
        </section>

        <section className="console-list-surface qr-console-v2-table-panel" id="qr-batches">
          <header className="console-section-heading">
            <div>
              <span className="admin-hierarchy-label">{copy.operationsPanel}</span>
              <h2>{copy.batchOperations}</h2>
              <p>{copy.operationsPanelDescription}</p>
            </div>
          </header>
          <DataTable
            className="admin-table-scroll admin-table-scroll--catalog qr-operations-table"
            columns={columns}
            empty={<EmptyState description={copy.empty} title={copy.batchOperations} />}
            getRowKey={(batch) => batch.id}
            rows={pagedBatches}
          />
          <footer className="qr-console-v2-table-footer">
            <span>
              {formatTemplate(copy.tableRange, {
                end: number.format(batchRangeEnd),
                start: number.format(batchRangeStart),
                total: number.format(scopedBatches.length),
              })}
            </span>
            <nav className="qr-console-v2-pagination" aria-label={copy.batchOperations}>
              {currentBatchPage > 1 ? (
                <Link
                  aria-label={copy.previous}
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={withQuery(locale, {
                    ...batchQueryBase,
                    page: currentBatchPage - 1,
                    pageSize,
                  })}
                  title={copy.previous}
                >
                  <CaretLeft aria-hidden="true" size={15} />
                </Link>
              ) : (
                <button
                  aria-label={copy.previous}
                  className="tt-button tt-button--secondary tt-button--compact is-disabled"
                  disabled
                  title={copy.previous}
                  type="button"
                >
                  <CaretLeft aria-hidden="true" size={15} />
                </button>
              )}
              {visiblePages(currentBatchPage, totalBatchPages).map((page) => (
                <Link
                  aria-current={page === currentBatchPage ? "page" : undefined}
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={withQuery(locale, {
                    ...batchQueryBase,
                    page,
                    pageSize,
                  })}
                  key={page}
                >
                  {number.format(page)}
                </Link>
              ))}
              {currentBatchPage < totalBatchPages ? (
                <Link
                  aria-label={copy.next}
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={withQuery(locale, {
                    ...batchQueryBase,
                    page: currentBatchPage + 1,
                    pageSize,
                  })}
                  title={copy.next}
                >
                  <CaretRight aria-hidden="true" size={15} />
                </Link>
              ) : (
                <button
                  aria-label={copy.next}
                  className="tt-button tt-button--secondary tt-button--compact is-disabled"
                  disabled
                  title={copy.next}
                  type="button"
                >
                  <CaretRight aria-hidden="true" size={15} />
                </button>
              )}
            </nav>
            <ConsoleQueryForm className="qr-console-v2-page-size">
              <input aria-label="company" name="company" type="hidden" value={companyHref ?? ""} />
              <input aria-label="site" name="site" type="hidden" value={siteHref ?? ""} />
              <input
                aria-label="confirmed"
                name="confirmed"
                type="hidden"
                value={scopeConfirmed ? "1" : ""}
              />
              <input aria-label="quantity" name="quantity" type="hidden" value={quantity} />
              <input
                aria-label="batches"
                name="batches"
                type="hidden"
                value={activeBatchIds.join(",")}
              />
              <input
                aria-label="request"
                name="request"
                type="hidden"
                value={activeRequestId ?? ""}
              />
              <label className="admin-field" htmlFor="qr-batch-page-size">
                <span>{copy.pageSize}</span>
                <span className="qr-console-v2-select">
                  <select defaultValue={pageSize} id="qr-batch-page-size" name="pageSize">
                    {[10, 20, 50].map((value) => (
                      <option key={value} value={value}>
                        {number.format(value)}
                      </option>
                    ))}
                  </select>
                  <CaretDown aria-hidden="true" size={14} />
                </span>
              </label>
              <button className="tt-button tt-button--secondary tt-button--compact" type="submit">
                {copy.applyPageSize}
              </button>
            </ConsoleQueryForm>
          </footer>
        </section>

        <section className="console-list-surface qr-console-v2-table-panel" id="qr-sites">
          <header className="console-section-heading">
            <div>
              <span className="admin-hierarchy-label">{copy.siteOperations}</span>
              <h2>{copy.siteOperations}</h2>
              <p>{copy.siteOperationsDescription}</p>
            </div>
          </header>
          <DataTable
            className="admin-table-scroll admin-table-scroll--catalog qr-operations-table"
            columns={siteColumns}
            empty={<EmptyState description={copy.empty} title={copy.siteOperations} />}
            getRowKey={(site) => site.id}
            rows={pagedSites}
          />
          <footer className="qr-console-v2-table-footer">
            <span>
              {formatTemplate(copy.tableRange, {
                end: number.format(siteRangeEnd),
                start: number.format(siteRangeStart),
                total: number.format(operationsModel.sites.length),
              })}
            </span>
            <nav className="qr-console-v2-pagination" aria-label={copy.siteOperations}>
              {currentSitePage > 1 ? (
                <Link
                  aria-label={copy.previous}
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={withQuery(locale, {
                    ...siteQueryBase,
                    sitePage: currentSitePage - 1,
                    sitePageSize: sitePageSizeValue,
                  })}
                  title={copy.previous}
                >
                  <CaretLeft aria-hidden="true" size={15} />
                </Link>
              ) : (
                <button
                  aria-label={copy.previous}
                  className="tt-button tt-button--secondary tt-button--compact is-disabled"
                  disabled
                  title={copy.previous}
                  type="button"
                >
                  <CaretLeft aria-hidden="true" size={15} />
                </button>
              )}
              {visiblePages(currentSitePage, totalSitePages).map((page) => (
                <Link
                  aria-current={page === currentSitePage ? "page" : undefined}
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={withQuery(locale, {
                    ...siteQueryBase,
                    sitePage: page,
                    sitePageSize: sitePageSizeValue,
                  })}
                  key={page}
                >
                  {number.format(page)}
                </Link>
              ))}
              {currentSitePage < totalSitePages ? (
                <Link
                  aria-label={copy.next}
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={withQuery(locale, {
                    ...siteQueryBase,
                    sitePage: currentSitePage + 1,
                    sitePageSize: sitePageSizeValue,
                  })}
                  title={copy.next}
                >
                  <CaretRight aria-hidden="true" size={15} />
                </Link>
              ) : (
                <button
                  aria-label={copy.next}
                  className="tt-button tt-button--secondary tt-button--compact is-disabled"
                  disabled
                  title={copy.next}
                  type="button"
                >
                  <CaretRight aria-hidden="true" size={15} />
                </button>
              )}
            </nav>
          </footer>
        </section>
      </div>
    </>
  );
}
