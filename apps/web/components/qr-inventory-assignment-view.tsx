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
): Route {
  const query = new URLSearchParams({ view: section });
  if (selection?.asset) query.set("asset", selection.asset);
  if (selection?.batch) query.set("batch", selection.batch);
  return `/${locale}/admin/qr-inventory/sites/${siteId}?${query.toString()}` as Route;
}

function assetColumns({
  action,
  actionLabel,
  assignmentCopy,
  copy,
}: {
  action?: ((asset: QrInventoryAssignmentAssetItem) => ReactNode) | undefined;
  actionLabel: string;
  assignmentCopy: InventoryAssignmentCopy;
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
  canAssign,
  copy,
  locale,
  model,
  selectedBatchId,
  siteId,
}: Omit<InventoryAssignmentViewProps, "canRevoke" | "section" | "selectedAssetId">) {
  const deliveredBatches = model.batches.filter((batch) => batch.status === "DELIVERED");
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
          <PanelBody className="qr-site-action-workspace">
            <div className="qr-site-action-workspace__intro">
              <span>{copy.batchCode}</span>
              <strong>{selectedBatch.batchCode}</strong>
              <small>
                {copy.totalQr} ·{" "}
                {new Intl.NumberFormat(locale).format(selectedBatch.requestedQuantity)}
              </small>
            </div>
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
          </PanelBody>
        ) : null}
      </ConsolePanel>

      <ConsolePanel description={copy.inventoryAssetDescription} title={copy.inventoryAssetTitle}>
        <DataTable
          columns={assetColumns({ actionLabel: copy.action, assignmentCopy, copy })}
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
          rows={model.assets}
        />
      </ConsolePanel>
    </div>
  );
}

function AssignmentWorkspace({
  assignmentCopy,
  canAssign,
  copy,
  locale,
  model,
  selectedAssetId,
  siteId,
}: Omit<InventoryAssignmentViewProps, "canRevoke" | "section" | "selectedBatchId">) {
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
        <DataTable
          columns={assetColumns({
            action: (asset) => (
              <Link
                className="tt-button tt-button--secondary tt-button--compact qr-site-table-action"
                href={sectionHref(locale, siteId, "assignment", { asset: asset.id })}
              >
                {copy.assignmentAction}
              </Link>
            ),
            actionLabel: copy.action,
            assignmentCopy,
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
              description={copy.noStock}
              title={copy.sectionLabels.assignment}
            />
          }
          getRowKey={(asset) => asset.id}
          rows={stockAssets}
        />
        {canAssign && selectedAsset ? (
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
        ) : null}
      </ConsolePanel>

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
  canRevoke,
  copy,
  locale,
  model,
  selectedAssetId,
  siteId,
}: Omit<InventoryAssignmentViewProps, "canAssign" | "section" | "selectedBatchId">) {
  const stockAssets = getStockAssets(model);
  const managedAssets = getManagedAssets(model);
  const selectedAsset = managedAssets.find((asset) => asset.id === selectedAssetId);
  const replacements = selectedAsset
    ? stockAssets.filter((asset) => asset.siteId === selectedAsset.siteId)
    : [];

  return (
    <ConsolePanel
      description={copy.sectionDescriptions.exceptions}
      title={copy.sectionLabels.exceptions}
    >
      <DataTable
        columns={assetColumns({
          action: (asset) => (
            <Link
              className="tt-button tt-button--secondary tt-button--compact qr-site-table-action"
              href={sectionHref(locale, siteId, "exceptions", { asset: asset.id })}
            >
              {copy.exceptionAction}
            </Link>
          ),
          actionLabel: copy.action,
          assignmentCopy,
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
        rows={managedAssets}
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
