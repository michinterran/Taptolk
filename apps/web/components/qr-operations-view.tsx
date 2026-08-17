import { CheckCircle, DownloadSimple, MapPin, Minus, Plus } from "@phosphor-icons/react/dist/ssr";
import type { QrOperationsReadModel } from "@taptolk/application";
import {
  QR_DIRECT_GENERATION_QUANTITY_MAX,
  QR_DIRECT_GENERATION_QUANTITY_MIN,
} from "@taptolk/application";
import { ConsoleTabs, MeterBar, PageHeader, StatusPill } from "@taptolk/ui";
import Link from "next/link";
import { requestAdminDirectQrGeneration } from "../admin/qr-direct-generation-actions";
import type { AdminQrOperationsCopy } from "../content/admin-qr-operations-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";
import { ConsoleQueryForm } from "./console-query-form";
import { QrGenerationProgressPoller } from "./qr-generation-progress-poller";
import {
  aggregateProgress,
  clampPage,
  clampPageSize,
  clampQuantity,
  formatAddress,
  formatTemplate,
  isTerminalBatchStatus,
  percent,
  quantityHref,
  quantityPlan,
  stepClass,
  withQuery,
} from "./qr-operations-model";
import { QrOperationsTables } from "./qr-operations-tables";
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
  const pageSize = clampPageSize(batchPageSize);
  const totalBatchPages = Math.max(1, Math.ceil(scopedBatches.length / pageSize));
  const currentBatchPage = clampPage(batchPage, totalBatchPages);
  const batchQueryBase = {
    batches: activeBatchIds.join(","),
    company: companyHref,
    confirmed: scopeConfirmed ? 1 : undefined,
    quantity,
    request: activeRequestId,
    site: siteHref,
  };

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

        <QrOperationsTables
          activeBatchIds={activeBatchIds}
          activeRequestId={activeRequestId}
          batchPage={batchPage}
          batchPageSize={batchPageSize}
          companyId={companyHref}
          copy={copy}
          locale={locale}
          number={number}
          operationsModel={operationsModel}
          quantity={quantity}
          scopeConfirmed={scopeConfirmed}
          scopedBatches={scopedBatches}
          selectedSiteId={siteHref}
          sitePage={sitePage}
          sitePageSize={sitePageSize}
        />
      </div>
    </>
  );
}
