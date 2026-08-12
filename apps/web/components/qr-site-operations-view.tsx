import type {
  QrInventoryAssignmentReadModel,
  QrOperationsBatch,
  QrOperationsSite,
} from "@taptolk/application";
import { DataTable, type DataTableColumn, EmptyState, PageHeader, StatusPill } from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import type { AdminQrSiteOperationsCopy } from "../content/admin-qr-site-operations-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";
import {
  type InventoryAssignmentCopy,
  QrInventoryAssignmentView,
} from "./qr-inventory-assignment-view";

interface QrSiteOperationsViewProps {
  assignmentCopy: InventoryAssignmentCopy;
  canAssign: boolean;
  canRevoke: boolean;
  copy: AdminQrSiteOperationsCopy;
  errorMessage?: string | undefined;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: QrInventoryAssignmentReadModel;
  site: QrOperationsSite;
  batches: readonly QrOperationsBatch[];
  statusMessage?: string | undefined;
}

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "COMPLETED" || status === "DELIVERED" || status === "GENERATED") {
    return "success";
  }
  if (status === "PARTIALLY_COMPLETED") return "warning";
  return "info";
}

export function QrSiteOperationsView({
  assignmentCopy,
  canAssign,
  canRevoke,
  copy,
  errorMessage,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
  site,
  batches,
  statusMessage,
}: QrSiteOperationsViewProps) {
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const batchColumns = [
    {
      cell: (batch) => (
        <span className="tt-table-entity">
          <strong>{batch.batchCode}</strong>
          <small>{date.format(new Date(batch.createdAt))}</small>
        </span>
      ),
      header: copy.batchCount,
      key: "batch",
    },
    {
      align: "right",
      cell: (batch) => number.format(batch.requestedQuantity),
      header: copy.totalQr,
      key: "quantity",
    },
    {
      cell: (batch) => (
        <StatusPill tone={statusTone(batch.status)}>
          {copy.batchStatusLabels[batch.status] ?? batch.status}
        </StatusPill>
      ),
      header: assignmentCopy.status,
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
            {copy.svgDownload}
          </a>
        ) : (
          <span className="admin-catalog-read-only">—</span>
        ),
      header: copy.svgDownload,
      key: "download",
    },
  ] satisfies Array<DataTableColumn<QrOperationsBatch>>;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`/${locale}/admin/qr-inventory/sites/${site.id}`}
      />
      <div className="admin-workspace-canvas console-page">
        <Link className="admin-inline-back" href={`/${locale}/admin/qr-inventory` as Route}>
          {copy.back}
        </Link>
        <PageHeader
          className="admin-compact-heading admin-compact-heading--workspace"
          description={copy.description}
          eyebrow={copy.eyebrow}
          lines={[site.name]}
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

        <div className="qr-console-v2-progress-actions">
          <Link
            className="tt-button"
            href={
              `/${locale}/admin/qr-inventory?company=${site.managementCompanyId}&confirmed=1&quantity=100&site=${site.id}` as Route
            }
          >
            {copy.generate}
          </Link>
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
        </div>

        <section aria-label={copy.title} className="qr-console-v2-summary-grid">
          <div>
            <span>{copy.totalQr}</span>
            <strong>{number.format(site.totalQr)}</strong>
          </div>
          <div>
            <span>{copy.activeQr}</span>
            <strong>{number.format(site.activeQr)}</strong>
          </div>
          <div>
            <span>{copy.pendingActivation}</span>
            <strong>{number.format(site.pendingActivationQr)}</strong>
          </div>
          <div>
            <span>{copy.batchCount}</span>
            <strong>{number.format(site.batchCount)}</strong>
          </div>
        </section>

        <section className="console-list-surface qr-console-v2-table-panel">
          <header className="console-section-heading">
            <div>
              <span className="admin-hierarchy-label">{copy.eyebrow}</span>
              <h2>{copy.batchCount}</h2>
            </div>
          </header>
          <DataTable
            className="admin-table-scroll admin-table-scroll--catalog qr-operations-table"
            columns={batchColumns}
            empty={<EmptyState description={copy.description} title={copy.batchCount} />}
            getRowKey={(batch) => batch.id}
            rows={batches}
          />
        </section>

        <section className="console-list-surface" aria-labelledby="qr-site-inventory-title">
          <header className="console-section-heading">
            <div>
              <span className="admin-hierarchy-label">{copy.eyebrow}</span>
              <h2 id="qr-site-inventory-title">{copy.inventoryTitle}</h2>
              <p>{copy.inventoryDescription}</p>
            </div>
          </header>
          <QrInventoryAssignmentView
            canAssign={canAssign}
            canRevoke={canRevoke}
            copy={assignmentCopy}
            locale={locale}
            model={model}
          />
        </section>
      </div>
    </>
  );
}
