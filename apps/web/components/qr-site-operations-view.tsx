import type {
  QrInventoryAssignmentReadModel,
  QrOperationsBatch,
  QrOperationsSite,
} from "@taptolk/application";
import {
  CellEntity,
  ConsolePanel,
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
  StatStrip,
  StatTile,
  StatusPill,
} from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import { advanceQrBatchDelivery } from "../admin/qr-inventory-assignment-actions";
import type { AdminQrSiteOperationsCopy } from "../content/admin-qr-site-operations-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";
import {
  type InventoryAssignmentCopy,
  QrInventoryAssignmentView,
} from "./qr-inventory-assignment-view";
import { QrOperationConfirmButton } from "./qr-operation-confirm-button";
import {
  getManagedAssets,
  getNextQrDeliveryStatus,
  getQrActivationSummary,
  type QrActivationReadiness,
  type QrSiteOperationsSection,
} from "./qr-site-operations-model";

interface QrSiteOperationsViewProps {
  assetListState: QrSiteAssetListState;
  assignmentCopy: InventoryAssignmentCopy;
  canAdvanceDelivery: boolean;
  canAssign: boolean;
  canRevoke: boolean;
  copy: AdminQrSiteOperationsCopy;
  errorMessage?: string | undefined;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: QrInventoryAssignmentReadModel;
  section: QrSiteOperationsSection;
  selectedAssetId?: string | undefined;
  selectedBatchId?: string | undefined;
  site: QrOperationsSite;
  batches: readonly QrOperationsBatch[];
  statusMessage?: string | undefined;
}

export type QrSiteAssetSort = "batch" | "code" | "readiness" | "status";

export interface QrSiteAssetListState {
  page: number;
  pageSize: number;
  query: string;
  sort: QrSiteAssetSort;
}

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "COMPLETED" || status === "DELIVERED" || status === "GENERATED") {
    return "success";
  }
  if (status === "PARTIALLY_COMPLETED") return "warning";
  return "info";
}

function sectionHref(locale: AppLocale, siteId: string, section: QrSiteOperationsSection): Route {
  return `/${locale}/admin/qr-inventory/sites/${siteId}?view=${section}` as Route;
}

function refreshHref(
  locale: AppLocale,
  siteId: string,
  section: QrSiteOperationsSection,
  assetListState: QrSiteAssetListState,
): Route {
  const query = new URLSearchParams({
    page: String(assetListState.page),
    pageSize: String(assetListState.pageSize),
    refreshed: String(Date.now()),
    sort: assetListState.sort,
    view: section,
  });
  if (assetListState.query) query.set("q", assetListState.query);
  return `/${locale}/admin/qr-inventory/sites/${siteId}?${query.toString()}` as Route;
}

export function QrSiteOperationsView({
  assetListState,
  assignmentCopy,
  canAdvanceDelivery,
  canAssign,
  canRevoke,
  copy,
  errorMessage,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
  section,
  selectedAssetId,
  selectedBatchId,
  site,
  batches,
  statusMessage,
}: QrSiteOperationsViewProps) {
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const managedAssets = getManagedAssets(model);
  const activationSummary = getQrActivationSummary(model);
  const activationSteps = [
    "WAITING_FOR_RECEIPT",
    "READY",
    "PENDING",
    "ACTIVE",
  ] as const satisfies readonly QrActivationReadiness[];
  const activationCounts: Readonly<Record<QrActivationReadiness, number>> = {
    ACTIVE: activationSummary.active,
    BLOCKED: activationSummary.blocked,
    PENDING: activationSummary.pending,
    READY: activationSummary.ready,
    WAITING_FOR_RECEIPT: activationSummary.waitingForReceipt,
  };
  const batchColumns = [
    {
      cell: (batch) => (
        <CellEntity meta={date.format(new Date(batch.createdAt))} name={batch.batchCode} />
      ),
      header: copy.batchCode,
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
      header: copy.currentStatus,
      key: "status",
    },
    {
      align: "right",
      cell: (batch) =>
        batch.downloadReady ? (
          <a
            className="tt-button tt-button--secondary tt-button--compact qr-site-table-action"
            href={`/api/admin/qr-batches/${batch.id}/svg-bundle`}
          >
            {copy.svgDownload}
          </a>
        ) : (
          <span className="qr-site-unavailable">{copy.notAvailable}</span>
        ),
      header: copy.svgDownload,
      key: "download",
    },
    {
      align: "right",
      cell: (batch) => {
        const targetStatus = getNextQrDeliveryStatus(batch.status);
        return canAdvanceDelivery && targetStatus ? (
          <form action={advanceQrBatchDelivery} className="qr-site-row-form">
            <input aria-label="batch" name="batchId" type="hidden" value={batch.id} />
            <input
              aria-label="batch version"
              name="expectedVersion"
              type="hidden"
              value={batch.version}
            />
            <input aria-label="locale" name="locale" type="hidden" value={locale} />
            <input
              aria-label="management company"
              name="managementCompanyId"
              type="hidden"
              value={batch.managementCompanyId}
            />
            <input aria-label="reason" name="reason" type="hidden" value={copy.deliveryReason} />
            <input aria-label="site" name="siteId" type="hidden" value={batch.siteId} />
            <input
              aria-label="target status"
              name="targetStatus"
              type="hidden"
              value={targetStatus}
            />
            <input aria-label="tenant" name="tenantId" type="hidden" value={site.tenantId} />
            <input aria-label="work area" name="view" type="hidden" value="production" />
            <QrOperationConfirmButton
              cancelLabel={copy.cancel}
              confirmLabel={copy.confirmAction}
              description={copy.confirmDescriptions.delivery}
              label={copy.deliveryActionLabels[targetStatus]}
              title={copy.confirmTitles.delivery}
            />
          </form>
        ) : (
          <span className={targetStatus ? "qr-site-unavailable" : "qr-site-completed"}>
            {targetStatus ? copy.notAvailable : copy.completed}
          </span>
        );
      },
      header: copy.deliveryAction,
      key: "delivery-action",
    },
  ] satisfies Array<DataTableColumn<QrOperationsBatch>>;

  const sectionCounts: Readonly<Record<QrSiteOperationsSection, number>> = {
    assignment: model.assets.length,
    exceptions: managedAssets.length,
    inventory: model.assets.length,
    production: batches.length,
  };

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`/${locale}/admin/qr-inventory/sites/${site.id}`}
      />
      <div className="admin-workspace-canvas console-page qr-site-operations-page">
        <Link className="admin-inline-back" href={`/${locale}/admin/qr-inventory` as Route}>
          {copy.back}
        </Link>
        <PageHeader
          actions={
            <div className="qr-site-header-actions">
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
              <Link
                className="tt-button tt-button--secondary tt-button--compact"
                href={refreshHref(locale, site.id, section, assetListState)}
                prefetch={false}
              >
                {copy.refresh}
              </Link>
              <Link
                className="tt-button tt-button--compact"
                href={
                  `/${locale}/admin/qr-inventory?company=${site.managementCompanyId}&confirmed=1&quantity=1&site=${site.id}` as Route
                }
              >
                {copy.generate}
              </Link>
            </div>
          }
          className="admin-compact-heading admin-compact-heading--workspace"
          description={copy.description}
          eyebrow={site.name}
          lines={[copy.title]}
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

        <StatStrip aria-label={copy.title} className="qr-site-stat-strip" columns={4}>
          <StatTile label={copy.totalQr} value={number.format(site.totalQr)} />
          <StatTile
            label={copy.activationStepLabels.READY}
            value={number.format(activationSummary.ready)}
          />
          <StatTile
            label={copy.activationStepLabels.PENDING}
            value={number.format(activationSummary.pending)}
          />
          <StatTile
            label={copy.activationStepLabels.ACTIVE}
            value={number.format(activationSummary.active)}
          />
        </StatStrip>

        <section aria-labelledby="qr-activation-guide-title" className="qr-site-activation-guide">
          <div className="qr-site-activation-guide__header">
            <div>
              <h2 id="qr-activation-guide-title">{copy.activationGuideTitle}</h2>
              <p>{copy.activationGuideDescription}</p>
            </div>
            {activationSummary.blocked > 0 ? (
              <StatusPill tone="warning">
                {copy.activationStepLabels.BLOCKED} · {number.format(activationSummary.blocked)}
              </StatusPill>
            ) : null}
          </div>
          <ol className="qr-site-activation-guide__steps">
            {activationSteps.map((step, index) => (
              <li key={step}>
                <span className="qr-site-activation-guide__index">{index + 1}</span>
                <div>
                  <strong>{copy.activationStepLabels[step]}</strong>
                  <small>{copy.activationStepDescriptions[step]}</small>
                </div>
                <b>{number.format(activationCounts[step])}</b>
              </li>
            ))}
          </ol>
        </section>

        <nav aria-label={copy.sectionAriaLabel} className="tt-console-tabs qr-site-section-tabs">
          {(
            [
              "production",
              "inventory",
              "assignment",
              "exceptions",
            ] as const satisfies readonly QrSiteOperationsSection[]
          ).map((item) => (
            <Link
              aria-current={section === item ? "page" : undefined}
              href={sectionHref(locale, site.id, item)}
              key={item}
            >
              <span>{copy.sectionLabels[item]}</span>
              <small>{number.format(sectionCounts[item])}</small>
            </Link>
          ))}
        </nav>

        {section === "production" ? (
          <ConsolePanel
            description={copy.sectionDescriptions.production}
            title={copy.sectionLabels.production}
          >
            <DataTable
              columns={batchColumns}
              empty={
                <EmptyState
                  description={copy.deliveryDescription}
                  title={copy.sectionLabels.production}
                />
              }
              getRowKey={(batch) => batch.id}
              rows={batches}
            />
          </ConsolePanel>
        ) : (
          <QrInventoryAssignmentView
            assignmentCopy={assignmentCopy}
            assetListState={assetListState}
            canAssign={canAssign}
            canRevoke={canRevoke}
            copy={copy}
            locale={locale}
            model={model}
            section={section}
            selectedAssetId={selectedAssetId}
            selectedBatchId={selectedBatchId}
            siteId={site.id}
          />
        )}
      </div>
    </>
  );
}
