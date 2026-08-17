import { CaretDown, CaretLeft, CaretRight, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { QrOperationsBatch, QrOperationsReadModel } from "@taptolk/application";
import { DataTable, type DataTableColumn, EmptyState, MeterBar, StatusPill } from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import type { AdminQrOperationsCopy } from "../content/admin-qr-operations-copy";
import type { AppLocale } from "../i18n/config";
import { ConsoleQueryForm } from "./console-query-form";
import {
  batchProgress,
  clampPage,
  clampPageSize,
  formatTemplate,
  statusTone,
  visiblePages,
  withQuery,
} from "./qr-operations-model";

interface QrOperationsTablesProps {
  activeBatchIds: readonly string[];
  activeRequestId?: string | undefined;
  batchPage: number;
  batchPageSize: number;
  companyId?: string | undefined;
  copy: AdminQrOperationsCopy;
  locale: AppLocale;
  number: Intl.NumberFormat;
  operationsModel: QrOperationsReadModel;
  quantity: number;
  scopeConfirmed: boolean;
  scopedBatches: readonly QrOperationsBatch[];
  selectedSiteId?: string | undefined;
  sitePage: number;
  sitePageSize: number;
}

export function QrOperationsTables({
  activeBatchIds,
  activeRequestId,
  batchPage,
  batchPageSize,
  companyId,
  copy,
  locale,
  number,
  operationsModel,
  quantity,
  scopeConfirmed,
  scopedBatches,
  selectedSiteId,
  sitePage,
  sitePageSize,
}: QrOperationsTablesProps) {
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
    company: companyId,
    confirmed: scopeConfirmed ? 1 : undefined,
    quantity,
    request: activeRequestId,
    site: selectedSiteId,
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
    company: companyId,
    confirmed: scopeConfirmed ? 1 : undefined,
    page: currentBatchPage,
    pageSize,
    quantity,
    request: activeRequestId,
    site: selectedSiteId,
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
                href={withQuery(locale, { ...batchQueryBase, page, pageSize })}
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
            <input aria-label="company" name="company" type="hidden" value={companyId ?? ""} />
            <input aria-label="site" name="site" type="hidden" value={selectedSiteId ?? ""} />
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
    </>
  );
}
