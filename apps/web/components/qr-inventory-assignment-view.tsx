import type {
  QrAssetStatus,
  QrInventoryAssignmentAssetItem,
  QrInventoryAssignmentBatchItem,
  QrInventoryAssignmentReadModel,
  VehicleImportItem,
} from "@taptolk/application";
import {
  CellEntity,
  ConsolePanel,
  DataTable,
  type DataTableColumn,
  EmptyState,
  PanelBody,
  StatusPill,
} from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  assignQrAsset,
  commitVehicleImport,
  receiveQrBatch,
  receiveQrBatchQuantity,
  replaceQrAsset,
  revokeQrAsset,
  validateVehicleImport,
} from "../admin/qr-inventory-assignment-actions";
import type { AdminQrSiteOperationsCopy } from "../content/admin-qr-site-operations-copy";
import type { AppLocale } from "../i18n/config";
import { QrOperationConfirmButton } from "./qr-operation-confirm-button";
import {
  getManagedAssets,
  getQrActivationReadiness,
  getStockAssets,
  type QrActivationReadiness,
  type QrSiteOperationsSection,
} from "./qr-site-operations-model";

export interface InventoryAssignmentCopy {
  assign: string;
  assignDescription: string;
  assignTitle: string;
  batchReceive: string;
  batchReceiveDescription: string;
  batchReceiveTitle: string;
  commit: string;
  csvFile: string;
  empty: string;
  humanCode: string;
  importDescription: string;
  importTitle: string;
  originalDeleted: string;
  reason: string;
  reasonPlaceholder: string;
  replace: string;
  replacement: string;
  revoke: string;
  securityNote: string;
  site: string;
  status: string;
  statusLabels: Readonly<Record<QrAssetStatus, string>>;
  vehicleLast4: string;
  vehiclePlate: string;
}

interface InventoryAssignmentViewProps {
  assignmentCopy: InventoryAssignmentCopy;
  assetListState: QrSiteAssetListState;
  canAssign: boolean;
  canRevoke: boolean;
  copy: AdminQrSiteOperationsCopy;
  locale: AppLocale;
  model: QrInventoryAssignmentReadModel;
  section: Exclude<QrSiteOperationsSection, "production">;
  selectedAssetId?: string | undefined;
  selectedBatchId?: string | undefined;
  siteId: string;
}

type QrSiteAssetSort = "batch" | "code" | "readiness" | "status";

interface QrSiteAssetListState {
  page: number;
  pageSize: number;
  query: string;
  sort: QrSiteAssetSort;
}

interface AssetTableState {
  currentPage: number;
  pageRows: readonly QrInventoryAssignmentAssetItem[];
  totalPages: number;
  totalRows: number;
}

function ScopeFields({
  item,
  locale,
  view,
}: {
  item: { managementCompanyId: string; siteId: string; tenantId: string };
  locale: AppLocale;
  view: Exclude<QrSiteOperationsSection, "production">;
}) {
  return (
    <>
      <input aria-label="locale" name="locale" type="hidden" value={locale} />
      <input aria-label="tenant" name="tenantId" type="hidden" value={item.tenantId} />
      <input
        aria-label="management company"
        name="managementCompanyId"
        type="hidden"
        value={item.managementCompanyId}
      />
      <input aria-label="site" name="siteId" type="hidden" value={item.siteId} />
      <input aria-label="work area" name="view" type="hidden" value={view} />
    </>
  );
}

function ReasonField({
  copy,
  id,
  label,
}: {
  copy: InventoryAssignmentCopy;
  id: string;
  label?: string | undefined;
}) {
  return (
    <label className="admin-field" htmlFor={id}>
      <span>{label ?? copy.reason}</span>
      <input
        id={id}
        maxLength={500}
        minLength={3}
        name="reason"
        placeholder={copy.reasonPlaceholder}
        required
      />
    </label>
  );
}

function getQrAssetStatusTone(
  status: QrAssetStatus,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "ACTIVE" || status === "IN_STOCK") return "success";
  if (status === "REVOKED" || status === "EXPIRED" || status === "LOST" || status === "DAMAGED") {
    return "danger";
  }
  if (status === "SUSPENDED" || status === "REPLACED") return "warning";
  if (status === "GENERATED" || status === "PRINT_READY" || status === "PRINTED") return "neutral";
  return "info";
}

function getQrActivationReadinessTone(
  readiness: QrActivationReadiness,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (readiness === "ACTIVE" || readiness === "READY") return "success";
  if (readiness === "PENDING") return "info";
  if (readiness === "WAITING_FOR_RECEIPT") return "neutral";
  return "danger";
}

function sectionHref(
  locale: AppLocale,
  siteId: string,
  section: QrSiteOperationsSection,
  selection?: { asset?: string; batch?: string },
  assetListState?: Partial<QrSiteAssetListState>,
): Route {
  const query = new URLSearchParams({ view: section });
  if (selection?.asset) query.set("asset", selection.asset);
  if (selection?.batch) query.set("batch", selection.batch);
  if (assetListState?.query) query.set("q", assetListState.query);
  if (assetListState?.sort) query.set("sort", assetListState.sort);
  if (assetListState?.page) query.set("page", String(assetListState.page));
  if (assetListState?.pageSize) query.set("pageSize", String(assetListState.pageSize));
  return `/${locale}/admin/qr-inventory/sites/${siteId}?${query.toString()}` as Route;
}

function siteHref(locale: AppLocale, siteId: string): Route {
  return `/${locale}/admin/qr-inventory/sites/${siteId}` as Route;
}

function formatTemplate(template: string, values: Readonly<Record<string, string | number>>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    template,
  );
}

function getAssetBatchCode(
  asset: QrInventoryAssignmentAssetItem,
  batchCodeById: ReadonlyMap<string, string>,
  fallback: string,
): string {
  return batchCodeById.get(asset.batchId) ?? fallback;
}

function getAssetSearchText({
  asset,
  assignmentCopy,
  batchCode,
  copy,
}: {
  asset: QrInventoryAssignmentAssetItem;
  assignmentCopy: InventoryAssignmentCopy;
  batchCode: string;
  copy: AdminQrSiteOperationsCopy;
}): string {
  const readiness = getQrActivationReadiness(asset.status);
  return [
    asset.humanCode,
    batchCode,
    asset.status,
    assignmentCopy.statusLabels[asset.status],
    copy.scanStatusLabels[readiness],
    asset.currentVehicleLast4 ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase();
}

function sortAssets({
  assetListState,
  assets,
  assignmentCopy,
  batchCodeById,
  copy,
}: {
  assetListState: QrSiteAssetListState;
  assets: readonly QrInventoryAssignmentAssetItem[];
  assignmentCopy: InventoryAssignmentCopy;
  batchCodeById: ReadonlyMap<string, string>;
  copy: AdminQrSiteOperationsCopy;
}): readonly QrInventoryAssignmentAssetItem[] {
  const needle = assetListState.query.toLocaleLowerCase();
  const filtered = assets.filter((asset) => {
    if (!needle) return true;
    return getAssetSearchText({
      asset,
      assignmentCopy,
      batchCode: getAssetBatchCode(asset, batchCodeById, copy.notAvailable),
      copy,
    }).includes(needle);
  });
  return [...filtered].sort((left, right) => {
    if (assetListState.sort === "batch") {
      return getAssetBatchCode(left, batchCodeById, "").localeCompare(
        getAssetBatchCode(right, batchCodeById, ""),
      );
    }
    if (assetListState.sort === "status") {
      return assignmentCopy.statusLabels[left.status].localeCompare(
        assignmentCopy.statusLabels[right.status],
      );
    }
    if (assetListState.sort === "readiness") {
      return copy.scanStatusLabels[getQrActivationReadiness(left.status)].localeCompare(
        copy.scanStatusLabels[getQrActivationReadiness(right.status)],
      );
    }
    return left.humanCode.localeCompare(right.humanCode);
  });
}

function paginateAssets(
  assets: readonly QrInventoryAssignmentAssetItem[],
  assetListState: QrSiteAssetListState,
): AssetTableState {
  const totalPages = Math.max(1, Math.ceil(assets.length / assetListState.pageSize));
  const currentPage = Math.min(Math.max(assetListState.page, 1), totalPages);
  const start = (currentPage - 1) * assetListState.pageSize;
  return {
    currentPage,
    pageRows: assets.slice(start, start + assetListState.pageSize),
    totalPages,
    totalRows: assets.length,
  };
}

function AssetTableControls({
  assetListState,
  copy,
  locale,
  section,
  siteId,
  tableState,
}: {
  assetListState: QrSiteAssetListState;
  copy: AdminQrSiteOperationsCopy;
  locale: AppLocale;
  section: Exclude<QrSiteOperationsSection, "production">;
  siteId: string;
  tableState: AssetTableState;
}) {
  const number = new Intl.NumberFormat(locale);
  const shown = tableState.pageRows.length;
  const summary = formatTemplate(copy.resultsSummary, {
    page: number.format(tableState.currentPage),
    pages: number.format(tableState.totalPages),
    shown: number.format(shown),
    total: number.format(tableState.totalRows),
  });
  return (
    <>
      <aside className="qr-site-workflow-note">
        <strong>{copy.assetCodeTitle}</strong>
        <p>{copy.assetCodeDescription}</p>
      </aside>
      <form action={siteHref(locale, siteId)} className="qr-site-filter" method="get">
        <input aria-label="work area" name="view" type="hidden" value={section} />
        <input aria-label="page" name="page" type="hidden" value="1" />
        <label className="admin-field" htmlFor={`qr-site-search-${section}`}>
          <span>{copy.filterLabel}</span>
          <input
            defaultValue={assetListState.query}
            id={`qr-site-search-${section}`}
            name="q"
            placeholder={copy.filterPlaceholder}
            type="search"
          />
        </label>
        <label className="admin-field" htmlFor={`qr-site-sort-${section}`}>
          <span>{copy.sortLabel}</span>
          <select defaultValue={assetListState.sort} id={`qr-site-sort-${section}`} name="sort">
            <option value="code">{copy.sortCode}</option>
            <option value="batch">{copy.sortBatch}</option>
            <option value="status">{copy.sortStatus}</option>
            <option value="readiness">{copy.sortReadiness}</option>
          </select>
        </label>
        <label className="admin-field" htmlFor={`qr-site-page-size-${section}`}>
          <span>{copy.pageSize}</span>
          <select
            defaultValue={String(assetListState.pageSize)}
            id={`qr-site-page-size-${section}`}
            name="pageSize"
          >
            {[20, 50, 100].map((value) => (
              <option key={value} value={value}>
                {number.format(value)}
              </option>
            ))}
          </select>
        </label>
        <button className="tt-button tt-button--compact" type="submit">
          {copy.applyFilter}
        </button>
        <Link
          className="tt-button tt-button--secondary tt-button--compact"
          href={sectionHref(locale, siteId, section)}
        >
          {copy.resetFilter}
        </Link>
      </form>
      <div className="qr-site-results-bar">
        <span>{summary}</span>
      </div>
    </>
  );
}

function AssetTablePagination({
  assetListState,
  copy,
  locale,
  section,
  siteId,
  tableState,
}: {
  assetListState: QrSiteAssetListState;
  copy: AdminQrSiteOperationsCopy;
  locale: AppLocale;
  section: Exclude<QrSiteOperationsSection, "production">;
  siteId: string;
  tableState: AssetTableState;
}) {
  const number = new Intl.NumberFormat(locale);
  return (
    <nav aria-label={copy.pageSize} className="qr-site-pagination">
      <Link
        aria-disabled={tableState.currentPage <= 1}
        className={`tt-button tt-button--secondary tt-button--compact${
          tableState.currentPage <= 1 ? " tt-button--disabled" : ""
        }`}
        href={sectionHref(locale, siteId, section, undefined, {
          ...assetListState,
          page: tableState.currentPage <= 1 ? tableState.currentPage : tableState.currentPage - 1,
        })}
      >
        {copy.pagePrevious}
      </Link>
      <span aria-current="page">
        {number.format(tableState.currentPage)} / {number.format(tableState.totalPages)}
      </span>
      <Link
        aria-disabled={tableState.currentPage >= tableState.totalPages}
        className={`tt-button tt-button--secondary tt-button--compact${
          tableState.currentPage >= tableState.totalPages ? " tt-button--disabled" : ""
        }`}
        href={sectionHref(locale, siteId, section, undefined, {
          ...assetListState,
          page:
            tableState.currentPage >= tableState.totalPages
              ? tableState.currentPage
              : tableState.currentPage + 1,
        })}
      >
        {copy.pageNext}
      </Link>
    </nav>
  );
}

function assetColumns({
  action,
  actionLabel,
  assignmentCopy,
  batchCodeById,
  copy,
}: {
  action?: ((asset: QrInventoryAssignmentAssetItem) => ReactNode) | undefined;
  actionLabel: string;
  assignmentCopy: InventoryAssignmentCopy;
  batchCodeById: ReadonlyMap<string, string>;
  copy: AdminQrSiteOperationsCopy;
}): Array<DataTableColumn<QrInventoryAssignmentAssetItem>> {
  const columns: Array<DataTableColumn<QrInventoryAssignmentAssetItem>> = [
    {
      cell: (asset) => (
        <CellEntity
          meta={
            asset.currentVehicleLast4
              ? `${assignmentCopy.vehicleLast4} · ${asset.currentVehicleLast4}`
              : undefined
          }
          name={asset.humanCode}
        />
      ),
      header: assignmentCopy.humanCode,
      key: "asset",
    },
    {
      cell: (asset) => getAssetBatchCode(asset, batchCodeById, copy.notAvailable),
      header: copy.batchCode,
      key: "batch",
    },
    {
      cell: (asset) => (
        <StatusPill tone={getQrAssetStatusTone(asset.status)}>
          {assignmentCopy.statusLabels[asset.status]}
        </StatusPill>
      ),
      header: assignmentCopy.status,
      key: "status",
    },
    {
      cell: (asset) => {
        const readiness = getQrActivationReadiness(asset.status);
        return (
          <StatusPill tone={getQrActivationReadinessTone(readiness)}>
            {copy.scanStatusLabels[readiness]}
          </StatusPill>
        );
      },
      header: copy.scanReadiness,
      key: "scan-readiness",
    },
  ];
  if (action) {
    columns.push({ align: "right", cell: action, header: actionLabel, key: "action" });
  }
  return columns;
}

function InventoryWorkspace({
  assignmentCopy,
  assetListState,
  canAssign,
  copy,
  locale,
  model,
  selectedBatchId,
  siteId,
}: Omit<InventoryAssignmentViewProps, "canRevoke" | "section" | "selectedAssetId">) {
  const batchCodeById = new Map(model.batches.map((batch) => [batch.id, batch.batchCode]));
  const inventoryAssets = paginateAssets(
    sortAssets({ assetListState, assets: model.assets, assignmentCopy, batchCodeById, copy }),
    assetListState,
  );
  const deliveredBatches = model.batches.filter(
    (batch) => batch.status === "DELIVERED" || batch.status === "PARTIALLY_RECEIVED",
  );
  const selectedBatch = deliveredBatches.find((batch) => batch.id === selectedBatchId);
  const batchColumns: Array<DataTableColumn<QrInventoryAssignmentBatchItem>> = [
    {
      cell: (batch) => <CellEntity meta={batch.siteName} name={batch.batchCode} />,
      header: copy.batchCode,
      key: "batch",
    },
    {
      align: "right",
      cell: (batch) => new Intl.NumberFormat(locale).format(batch.requestedQuantity),
      header: copy.totalQr,
      key: "quantity",
    },
    {
      cell: () => <StatusPill tone="success">{copy.batchStatusLabels.DELIVERED}</StatusPill>,
      header: assignmentCopy.status,
      key: "status",
    },
    {
      align: "right",
      cell: (batch) => (
        <Link
          className="tt-button tt-button--secondary tt-button--compact qr-site-table-action"
          href={sectionHref(locale, siteId, "inventory", { batch: batch.id })}
        >
          {copy.receiptAction}
        </Link>
      ),
      header: copy.action,
      key: "action",
    },
  ];

  return (
    <div className="qr-site-workspace-stack">
      <ConsolePanel description={copy.receiptDescription} title={copy.receiptTitle}>
        <DataTable
          columns={batchColumns}
          empty={
            <EmptyState
              actions={
                <Link
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={sectionHref(locale, siteId, "production")}
                >
                  {copy.goToProduction}
                </Link>
              }
              className="qr-site-empty-state"
              description={copy.noDelivery}
              title={copy.receiptTitle}
            />
          }
          getRowKey={(batch) => batch.id}
          rows={deliveredBatches}
        />
        {canAssign && selectedBatch ? (
          <PanelBody className="qr-site-receipt-workspace">
            <div className="qr-site-receipt-summary">
              <div>
                <span>{copy.batchCode}</span>
                <strong>{selectedBatch.batchCode}</strong>
              </div>
              <div>
                <span>{copy.receiptExpectedQuantity}</span>
                <strong>
                  {new Intl.NumberFormat(locale).format(selectedBatch.requestedQuantity)}
                </strong>
              </div>
              <div>
                <span>{assignmentCopy.status}</span>
                <StatusPill
                  tone={selectedBatch.status === "PARTIALLY_RECEIVED" ? "warning" : "success"}
                >
                  {copy.batchStatusLabels[selectedBatch.status] ?? selectedBatch.status}
                </StatusPill>
              </div>
            </div>
            <div className="qr-site-receipt-actions">
              {selectedBatch.status === "DELIVERED" ? (
                <form action={receiveQrBatch} className="qr-site-inline-form">
                  <ScopeFields item={selectedBatch} locale={locale} view="inventory" />
                  <input aria-label="batch" name="batchId" type="hidden" value={selectedBatch.id} />
                  <input
                    aria-label="batch version"
                    name="expectedVersion"
                    type="hidden"
                    value={selectedBatch.version}
                  />
                  <ReasonField
                    copy={assignmentCopy}
                    id={`receive-reason-${selectedBatch.id}`}
                    label={copy.receiptReason}
                  />
                  <QrOperationConfirmButton
                    cancelLabel={copy.cancel}
                    confirmLabel={copy.confirmAction}
                    description={copy.confirmDescriptions.receive}
                    label={copy.receiveAll}
                    title={copy.confirmTitles.receive}
                  />
                </form>
              ) : null}
              <form action={receiveQrBatchQuantity} className="qr-site-inline-form">
                <ScopeFields item={selectedBatch} locale={locale} view="inventory" />
                <input aria-label="batch" name="batchId" type="hidden" value={selectedBatch.id} />
                <input
                  aria-label="batch version"
                  name="expectedVersion"
                  type="hidden"
                  value={selectedBatch.version}
                />
                <label className="admin-field" htmlFor={`receipt-quantity-${selectedBatch.id}`}>
                  <span>{copy.receiptQuantity}</span>
                  <input
                    defaultValue={selectedBatch.requestedQuantity}
                    id={`receipt-quantity-${selectedBatch.id}`}
                    max={selectedBatch.requestedQuantity}
                    min={1}
                    name="receivedQuantity"
                    required
                    type="number"
                  />
                </label>
                <ReasonField
                  copy={assignmentCopy}
                  id={`partial-receive-reason-${selectedBatch.id}`}
                  label={copy.receiptReason}
                />
                <QrOperationConfirmButton
                  cancelLabel={copy.cancel}
                  confirmLabel={copy.confirmAction}
                  description={copy.confirmDescriptions.receive}
                  label={copy.receiptPartial}
                  title={copy.confirmTitles.receive}
                  tone="secondary"
                />
              </form>
            </div>
          </PanelBody>
        ) : null}
      </ConsolePanel>

      <ConsolePanel description={copy.inventoryAssetDescription} title={copy.inventoryAssetTitle}>
        <AssetTableControls
          assetListState={assetListState}
          copy={copy}
          locale={locale}
          section="inventory"
          siteId={siteId}
          tableState={inventoryAssets}
        />
        <DataTable
          columns={assetColumns({ actionLabel: copy.action, assignmentCopy, batchCodeById, copy })}
          empty={
            <EmptyState
              actions={
                <Link
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={sectionHref(locale, siteId, "production")}
                >
                  {copy.goToProduction}
                </Link>
              }
              className="qr-site-empty-state"
              description={copy.noInventory}
              title={copy.inventoryAssetTitle}
            />
          }
          getRowKey={(asset) => asset.id}
          rows={inventoryAssets.pageRows}
        />
        <AssetTablePagination
          assetListState={assetListState}
          copy={copy}
          locale={locale}
          section="inventory"
          siteId={siteId}
          tableState={inventoryAssets}
        />
      </ConsolePanel>
    </div>
  );
}

function AssignmentWorkspace({
  assignmentCopy,
  assetListState,
  canAssign,
  copy,
  locale,
  model,
  selectedAssetId,
  siteId,
}: Omit<InventoryAssignmentViewProps, "canRevoke" | "section" | "selectedBatchId">) {
  const batchCodeById = new Map(model.batches.map((batch) => [batch.id, batch.batchCode]));
  const assignmentAssets = paginateAssets(
    sortAssets({ assetListState, assets: model.assets, assignmentCopy, batchCodeById, copy }),
    assetListState,
  );
  const stockAssets = getStockAssets(model);
  const selectedAsset = stockAssets.find((asset) => asset.id === selectedAssetId);
  const site = model.batches[0] ?? selectedAsset;
  const validatedImports = model.imports.filter((item) => item.status === "VALIDATED");
  const importColumns: Array<DataTableColumn<VehicleImportItem>> = [
    {
      cell: (item) => <CellEntity meta={item.createdAt} name={item.rowCount} />,
      header: assignmentCopy.importTitle,
      key: "import",
    },
    {
      cell: () => <StatusPill tone="info">{assignmentCopy.originalDeleted}</StatusPill>,
      header: assignmentCopy.status,
      key: "status",
    },
    {
      align: "right",
      cell: (item) => (
        <form action={commitVehicleImport} className="qr-site-row-form">
          <ScopeFields item={item} locale={locale} view="assignment" />
          <input aria-label="import" name="importId" type="hidden" value={item.id} />
          <input
            aria-label="import version"
            name="expectedVersion"
            type="hidden"
            value={item.version}
          />
          <input
            aria-label={assignmentCopy.reason}
            name="reason"
            type="hidden"
            value={assignmentCopy.importTitle}
          />
          <QrOperationConfirmButton
            cancelLabel={copy.cancel}
            confirmLabel={copy.confirmAction}
            description={copy.confirmDescriptions.import}
            label={assignmentCopy.commit}
            title={copy.confirmTitles.import}
          />
        </form>
      ),
      header: copy.action,
      key: "action",
    },
  ];

  return (
    <div className="qr-site-workspace-stack">
      <ConsolePanel
        description={copy.sectionDescriptions.assignment}
        title={copy.sectionLabels.assignment}
      >
        <AssetTableControls
          assetListState={assetListState}
          copy={copy}
          locale={locale}
          section="assignment"
          siteId={siteId}
          tableState={assignmentAssets}
        />
        <DataTable
          columns={assetColumns({
            action: (asset) =>
              asset.status === "IN_STOCK" ? (
                <Link
                  className="tt-button tt-button--secondary tt-button--compact qr-site-table-action"
                  href={sectionHref(
                    locale,
                    siteId,
                    "assignment",
                    { asset: asset.id },
                    assetListState,
                  )}
                >
                  {copy.assignmentAction}
                </Link>
              ) : (
                <span className="qr-site-unavailable">{copy.notAvailable}</span>
              ),
            actionLabel: copy.action,
            assignmentCopy,
            batchCodeById,
            copy,
          })}
          empty={
            <EmptyState
              actions={
                <Link
                  className="tt-button tt-button--secondary tt-button--compact"
                  href={sectionHref(locale, siteId, "inventory")}
                >
                  {copy.goToInventory}
                </Link>
              }
              className="qr-site-empty-state"
              description={copy.noInventory}
              title={copy.sectionLabels.assignment}
            />
          }
          getRowKey={(asset) => asset.id}
          rows={assignmentAssets.pageRows}
        />
        <AssetTablePagination
          assetListState={assetListState}
          copy={copy}
          locale={locale}
          section="assignment"
          siteId={siteId}
          tableState={assignmentAssets}
        />
      </ConsolePanel>

      {canAssign && selectedAsset ? (
        <ConsolePanel description={copy.preassignmentDescription} title={copy.preassignmentTitle}>
          <PanelBody className="qr-site-action-workspace">
            <div className="qr-site-action-workspace__intro">
              <span>{assignmentCopy.humanCode}</span>
              <strong>{selectedAsset.humanCode}</strong>
              <StatusPill tone="success">
                {assignmentCopy.statusLabels[selectedAsset.status]}
              </StatusPill>
            </div>
            <form
              action={assignQrAsset}
              className="qr-site-inline-form qr-site-inline-form--two-fields"
            >
              <ScopeFields item={selectedAsset} locale={locale} view="assignment" />
              <input
                aria-label="QR asset"
                name="qrAssetId"
                type="hidden"
                value={selectedAsset.id}
              />
              <input
                aria-label="QR asset version"
                name="expectedVersion"
                type="hidden"
                value={selectedAsset.version}
              />
              <label className="admin-field" htmlFor={`vehicle-plate-${selectedAsset.id}`}>
                <span>{assignmentCopy.vehiclePlate}</span>
                <input
                  autoComplete="off"
                  id={`vehicle-plate-${selectedAsset.id}`}
                  maxLength={16}
                  name="vehiclePlate"
                  required
                />
              </label>
              <ReasonField copy={assignmentCopy} id={`assignment-reason-${selectedAsset.id}`} />
              <QrOperationConfirmButton
                cancelLabel={copy.cancel}
                confirmLabel={copy.confirmAction}
                description={copy.confirmDescriptions.assign}
                label={assignmentCopy.assign}
                title={copy.confirmTitles.assign}
              />
            </form>
          </PanelBody>
        </ConsolePanel>
      ) : null}

      {canAssign && site ? (
        <ConsolePanel
          description={assignmentCopy.importDescription}
          title={assignmentCopy.importTitle}
        >
          <PanelBody>
            <details className="qr-site-disclosure">
              <summary>{assignmentCopy.importTitle}</summary>
              <form
                action={validateVehicleImport}
                className="qr-site-inline-form qr-site-inline-form--two-fields"
              >
                <input aria-label="locale" name="locale" type="hidden" value={locale} />
                <input
                  aria-label="site scope"
                  name="siteScope"
                  type="hidden"
                  value={`${site.tenantId}|${site.managementCompanyId}|${site.siteId}`}
                />
                <input aria-label="site" name="siteId" type="hidden" value={site.siteId} />
                <input aria-label="work area" name="view" type="hidden" value="assignment" />
                <label className="admin-field" htmlFor="vehicle-import-file">
                  <span>{assignmentCopy.csvFile}</span>
                  <input
                    accept=".csv,text/csv"
                    id="vehicle-import-file"
                    name="csvFile"
                    required
                    type="file"
                  />
                </label>
                <ReasonField copy={assignmentCopy} id="vehicle-import-reason" />
                <p className="qr-site-security-note">{assignmentCopy.securityNote}</p>
                <button className="tt-button tt-button--compact" type="submit">
                  {assignmentCopy.importTitle}
                </button>
              </form>
            </details>
          </PanelBody>
          {validatedImports.length > 0 ? (
            <DataTable
              columns={importColumns}
              getRowKey={(item) => item.id}
              rows={validatedImports}
            />
          ) : null}
        </ConsolePanel>
      ) : null}
    </div>
  );
}

function ExceptionsWorkspace({
  assignmentCopy,
  assetListState,
  canRevoke,
  copy,
  locale,
  model,
  selectedAssetId,
  siteId,
}: Omit<InventoryAssignmentViewProps, "canAssign" | "section" | "selectedBatchId">) {
  const batchCodeById = new Map(model.batches.map((batch) => [batch.id, batch.batchCode]));
  const stockAssets = getStockAssets(model);
  const managedAssets = getManagedAssets(model);
  const exceptionAssets = paginateAssets(
    sortAssets({ assetListState, assets: managedAssets, assignmentCopy, batchCodeById, copy }),
    assetListState,
  );
  const selectedAsset = managedAssets.find((asset) => asset.id === selectedAssetId);
  const replacements = selectedAsset
    ? stockAssets.filter((asset) => asset.siteId === selectedAsset.siteId)
    : [];

  return (
    <ConsolePanel
      description={copy.sectionDescriptions.exceptions}
      title={copy.sectionLabels.exceptions}
    >
      <aside className="qr-site-workflow-note">
        <strong>{copy.exceptionWorkflowTitle}</strong>
        <p>{copy.exceptionWorkflowDescription}</p>
      </aside>
      <AssetTableControls
        assetListState={assetListState}
        copy={copy}
        locale={locale}
        section="exceptions"
        siteId={siteId}
        tableState={exceptionAssets}
      />
      <DataTable
        columns={assetColumns({
          action: (asset) => (
            <Link
              className="tt-button tt-button--secondary tt-button--compact qr-site-table-action"
              href={sectionHref(locale, siteId, "exceptions", { asset: asset.id }, assetListState)}
            >
              {copy.exceptionAction}
            </Link>
          ),
          actionLabel: copy.action,
          assignmentCopy,
          batchCodeById,
          copy,
        })}
        empty={
          <EmptyState
            actions={
              <Link
                className="tt-button tt-button--secondary tt-button--compact"
                href={sectionHref(locale, siteId, "assignment")}
              >
                {copy.goToAssignment}
              </Link>
            }
            className="qr-site-empty-state"
            description={copy.noExceptions}
            title={copy.sectionLabels.exceptions}
          />
        }
        getRowKey={(asset) => asset.id}
        rows={exceptionAssets.pageRows}
      />
      <AssetTablePagination
        assetListState={assetListState}
        copy={copy}
        locale={locale}
        section="exceptions"
        siteId={siteId}
        tableState={exceptionAssets}
      />
      {canRevoke && selectedAsset ? (
        <PanelBody className="qr-site-action-workspace qr-site-action-workspace--exceptions">
          <div className="qr-site-action-workspace__intro">
            <span>{assignmentCopy.humanCode}</span>
            <strong>{selectedAsset.humanCode}</strong>
            <StatusPill tone={getQrAssetStatusTone(selectedAsset.status)}>
              {assignmentCopy.statusLabels[selectedAsset.status]}
            </StatusPill>
          </div>
          <div className="qr-site-exception-actions">
            {replacements.length > 0 ? (
              <form action={replaceQrAsset} className="qr-site-inline-form">
                <ScopeFields item={selectedAsset} locale={locale} view="exceptions" />
                <input
                  aria-label="source QR asset"
                  name="qrAssetId"
                  type="hidden"
                  value={selectedAsset.id}
                />
                <input
                  aria-label="source QR asset version"
                  name="expectedVersion"
                  type="hidden"
                  value={selectedAsset.version}
                />
                <label className="admin-field" htmlFor={`replacement-${selectedAsset.id}`}>
                  <span>{assignmentCopy.replacement}</span>
                  <select id={`replacement-${selectedAsset.id}`} name="replacementScope" required>
                    {replacements.map((replacement) => (
                      <option
                        key={replacement.id}
                        value={`${replacement.id}|${replacement.version}`}
                      >
                        {replacement.humanCode}
                      </option>
                    ))}
                  </select>
                </label>
                <ReasonField copy={assignmentCopy} id={`replace-reason-${selectedAsset.id}`} />
                <QrOperationConfirmButton
                  cancelLabel={copy.cancel}
                  confirmLabel={copy.confirmAction}
                  description={copy.confirmDescriptions.replace}
                  label={assignmentCopy.replace}
                  title={copy.confirmTitles.replace}
                />
              </form>
            ) : null}
            <form action={revokeQrAsset} className="qr-site-inline-form">
              <ScopeFields item={selectedAsset} locale={locale} view="exceptions" />
              <input
                aria-label="QR asset"
                name="qrAssetId"
                type="hidden"
                value={selectedAsset.id}
              />
              <input
                aria-label="QR asset version"
                name="expectedVersion"
                type="hidden"
                value={selectedAsset.version}
              />
              <ReasonField copy={assignmentCopy} id={`revoke-reason-${selectedAsset.id}`} />
              <QrOperationConfirmButton
                cancelLabel={copy.cancel}
                confirmLabel={copy.confirmAction}
                description={copy.confirmDescriptions.revoke}
                label={assignmentCopy.revoke}
                title={copy.confirmTitles.revoke}
                tone="danger"
              />
            </form>
          </div>
        </PanelBody>
      ) : null}
    </ConsolePanel>
  );
}

export function QrInventoryAssignmentView(props: InventoryAssignmentViewProps) {
  if (props.section === "inventory") return <InventoryWorkspace {...props} />;
  if (props.section === "assignment") return <AssignmentWorkspace {...props} />;
  return <ExceptionsWorkspace {...props} />;
}
