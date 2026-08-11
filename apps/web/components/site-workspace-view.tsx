import { ArrowLeft, Car, QrCode, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type {
  OrganizationStatus,
  SiteLifecycleRequestItem,
  SiteLifecycleRequestReadModel,
  SiteType,
  SiteWorkspace,
} from "@taptolk/application";
import {
  type AddressFieldLabels,
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
  StatStrip,
  StatTile,
  StatusPill,
} from "@taptolk/ui";
import { receiveQrBatchQuantity } from "../admin/qr-inventory-assignment-actions";
import type { QrOperationsScopeSummary } from "../admin/qr-operations-scope-summary";
import { changeSiteStatus, updateSiteContract, updateSiteOperational } from "../admin/site-actions";
import {
  cancelSiteLifecycleRequest,
  requestSiteLifecycle,
} from "../admin/site-lifecycle-request-actions";
import { DAUM_POSTCODE_SCRIPT_SRC } from "../config/address-search";
import type { AdminSiteWorkspaceCopy } from "../content/admin-site-workspace-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";
import { ManagementCompanyAddressSearchField } from "./management-company-address-search-field";

interface SiteAddressSearchCopy {
  detailLabel: string;
  detailPlaceholder: string;
  help: string;
  labels: AddressFieldLabels;
}

interface SiteWorkspaceViewProps {
  batchStatusLabels: Readonly<Record<string, string>>;
  addressSearch: SiteAddressSearchCopy;
  copy: AdminSiteWorkspaceCopy;
  canChangeStatus: boolean;
  canClose: boolean;
  canRequestClose: boolean;
  canRequestStatus: boolean;
  canReceiveBatch: boolean;
  canUpdateContract: boolean;
  canUpdateOperational: boolean;
  contractVehicleLimitMax: number;
  errorMessage?: string | undefined;
  lifecycleRequests: SiteLifecycleRequestReadModel;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: SiteWorkspace;
  qrOperations: QrOperationsScopeSummary;
  siteTypeLabels: Readonly<Record<SiteType, string>>;
  statusLabels: Readonly<Record<OrganizationStatus, string>>;
  statusMessage?: string | undefined;
}

type BatchRow = SiteWorkspace["batches"][number] & {
  sequence: number;
};
type EscalationRow = SiteWorkspace["siteEscalations"][number];

function headingLine(value: string): readonly [string] {
  return [value];
}

function statusTone(status: OrganizationStatus): "success" | "warning" {
  return status === "ACTIVE" ? "success" : "warning";
}

function WorkspaceHiddenFields({
  copy,
  locale,
  model,
}: {
  copy: AdminSiteWorkspaceCopy;
  locale: AppLocale;
  model: SiteWorkspace;
}) {
  return (
    <>
      <input aria-label={copy.locationWorkspace} name="locale" type="hidden" value={locale} />
      <input aria-label={copy.locationName} name="siteId" type="hidden" value={model.id} />
      <input
        aria-label={copy.managementCompany}
        name="tenantId"
        type="hidden"
        value={model.tenantId}
      />
      <input
        aria-label={copy.managementCompany}
        name="managementCompanyId"
        type="hidden"
        value={model.managementCompanyId}
      />
      <input aria-label={copy.status} name="expectedVersion" type="hidden" value={model.version} />
    </>
  );
}

function LifecycleRequestFields({
  copy,
  locale,
  request,
}: {
  copy: AdminSiteWorkspaceCopy;
  locale: AppLocale;
  request: SiteLifecycleRequestItem;
}) {
  return (
    <>
      <input aria-label={copy.locationWorkspace} name="locale" type="hidden" value={locale} />
      <input aria-label={copy.status} name="action" type="hidden" value={request.action} />
      <input aria-label={copy.status} name="lifecycleRequestId" type="hidden" value={request.id} />
      <input
        aria-label={copy.status}
        name="expectedRequestVersion"
        type="hidden"
        value={request.version}
      />
      <input
        aria-label={copy.managementCompany}
        name="tenantId"
        type="hidden"
        value={request.tenantId}
      />
      <input
        aria-label={copy.managementCompany}
        name="managementCompanyId"
        type="hidden"
        value={request.managementCompanyId}
      />
      <input aria-label={copy.locationName} name="siteId" type="hidden" value={request.siteId} />
      <input
        aria-label={copy.status}
        name="requestedBy"
        type="hidden"
        value={request.requestedBy}
      />
    </>
  );
}

export function SiteWorkspaceView({
  addressSearch,
  batchStatusLabels,
  canChangeStatus,
  canClose,
  canRequestClose,
  canRequestStatus,
  canReceiveBatch,
  canUpdateContract,
  canUpdateOperational,
  copy,
  contractVehicleLimitMax,
  errorMessage,
  lifecycleRequests,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
  qrOperations,
  siteTypeLabels,
  statusLabels,
  statusMessage,
}: SiteWorkspaceViewProps) {
  const number = new Intl.NumberFormat(locale);
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const prefix = `/${locale}/admin`;
  const pendingActivationCount = qrOperations.pendingActivationQr;
  const batchRows = model.batches.map((batch, index) => ({
    ...batch,
    sequence: index + 1,
  }));
  const batchColumns = [
    {
      cell: (batch) => (
        <strong>
          {copy.qrBatch} {batch.sequence}
        </strong>
      ),
      header: copy.batchHistory,
      key: "batch",
    },
    {
      align: "right",
      cell: (batch) => number.format(batch.quantity),
      header: copy.quantity,
      key: "quantity",
    },
    {
      align: "right",
      cell: (batch) => number.format(batch.receivedQuantity),
      header: copy.receivedQuantity,
      key: "received",
    },
    {
      align: "right",
      cell: (batch) => number.format(batch.remainingQuantity),
      header: copy.remainingQuantity,
      key: "remaining",
    },
    {
      cell: (batch) => (
        <StatusPill tone="success">{batchStatusLabels[batch.status] ?? copy.status}</StatusPill>
      ),
      header: copy.status,
      key: "status",
    },
  ] satisfies Array<DataTableColumn<BatchRow>>;
  const escalationColumns = [
    {
      cell: (item) => <strong>{item.vehiclePlateLast4}</strong>,
      header: copy.plateLast4,
      key: "vehicle",
    },
    {
      cell: (item) => item.siteContactLocation ?? copy.noAddress,
      header: copy.siteContactLocation,
      key: "location",
    },
    {
      cell: (item) => item.reasonCode,
      header: copy.lifecycleReason,
      key: "reason",
    },
    {
      cell: (item) => dateTime.format(new Date(item.escalatedAt)),
      header: copy.escalatedAt,
      key: "escalatedAt",
    },
  ] satisfies Array<DataTableColumn<EscalationRow>>;

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`${prefix}/sites`}
      />
      <div className="admin-workspace-canvas">
        <a className="admin-inline-back" href={`${prefix}/sites`}>
          <ArrowLeft aria-hidden="true" size={15} />
          {copy.allLocations}
        </a>
        <PageHeader
          className="admin-compact-heading admin-compact-heading--workspace"
          description={`${model.managementCompanyName} · ${copy.workspaceDescription}`}
          eyebrow={copy.locationWorkspace}
          lines={headingLine(model.name)}
        />
        <StatStrip className="admin-stat-strip admin-stat-strip--workspace" columns={4}>
          <StatTile
            icon={<QrCode aria-hidden="true" size={24} />}
            label={copy.totalQr}
            value={number.format(qrOperations.totalQr)}
          />
          <StatTile
            icon={<QrCode aria-hidden="true" size={24} />}
            label={copy.activeQr}
            value={number.format(qrOperations.activeQr)}
          />
          <StatTile
            icon={<Car aria-hidden="true" size={24} />}
            label={copy.pendingActivation}
            value={number.format(pendingActivationCount)}
          />
          <StatTile
            icon={<WarningCircle aria-hidden="true" size={24} />}
            label={copy.openRequests}
            value={number.format(model.openContactCount)}
          />
        </StatStrip>
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
        <div className="admin-workspace-grid">
          <div className="admin-workspace-main">
            {canUpdateOperational ||
            canUpdateContract ||
            canChangeStatus ||
            canClose ||
            canRequestStatus ||
            canRequestClose ? (
              <details className="admin-workspace-command-disclosure">
                <summary>
                  <span>{copy.updateTitle}</span>
                  <StatusPill tone={statusTone(model.status)}>
                    {statusLabels[model.status]}
                  </StatusPill>
                </summary>
                <section className="admin-portfolio-panel admin-workspace-command-panel">
                  <header className="admin-portfolio-panel__header">
                    <div>
                      <h2>{copy.updateTitle}</h2>
                      <p>{copy.updateDescription}</p>
                    </div>
                    <StatusPill tone={statusTone(model.status)}>
                      {statusLabels[model.status]}
                    </StatusPill>
                  </header>
                  <div className="admin-workspace-context">
                    <div>
                      <span>{copy.managementCompany}</span>
                      <strong>{model.managementCompanyName}</strong>
                    </div>
                    <p>{copy.managementCompanyHelp}</p>
                  </div>
                  {canUpdateOperational ? (
                    <form
                      action={updateSiteOperational}
                      className="admin-workspace-form admin-workspace-form--operational"
                    >
                      <WorkspaceHiddenFields copy={copy} locale={locale} model={model} />
                      <input
                        aria-label={copy.status}
                        name="timezone"
                        type="hidden"
                        value={model.timezone}
                      />
                      <h3>{copy.locationInformation}</h3>
                      <div className="admin-workspace-form__grid">
                        <label className="admin-field" htmlFor="site-workspace-name">
                          <span>{copy.locationName}</span>
                          <input
                            defaultValue={model.name}
                            id="site-workspace-name"
                            maxLength={200}
                            name="name"
                            required
                          />
                        </label>
                        <label className="admin-field" htmlFor="site-workspace-type">
                          <span>{copy.type}</span>
                          <select
                            defaultValue={model.type}
                            id="site-workspace-type"
                            name="siteType"
                            required
                          >
                            {Object.entries(siteTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="admin-field admin-workspace-address-field">
                          <span>{copy.address}</span>
                          <ManagementCompanyAddressSearchField
                            detailLabel={addressSearch.detailLabel}
                            detailPlaceholder={addressSearch.detailPlaceholder}
                            idPrefix="site-workspace-address"
                            initialAddress={model.address ?? ""}
                            labels={addressSearch.labels}
                            name="address"
                            scriptSrc={DAUM_POSTCODE_SCRIPT_SRC}
                          />
                          <small>{addressSearch.help}</small>
                        </div>
                      </div>
                      <label className="admin-field" htmlFor="site-workspace-operational-reason">
                        <span>{copy.changeReason}</span>
                        <textarea
                          id="site-workspace-operational-reason"
                          maxLength={500}
                          minLength={3}
                          name="reason"
                          placeholder={copy.changeReasonPlaceholder}
                          required
                        />
                      </label>
                      <button className="tt-button tt-button--compact" type="submit">
                        {copy.saveOperational}
                      </button>
                    </form>
                  ) : null}
                  {canUpdateContract ? (
                    <form
                      action={updateSiteContract}
                      className="admin-workspace-form admin-workspace-form--contract"
                    >
                      <WorkspaceHiddenFields copy={copy} locale={locale} model={model} />
                      <h3>{copy.contractTitle}</h3>
                      <label className="admin-field" htmlFor="site-workspace-contract-limit">
                        <span>{copy.contractLimit}</span>
                        <input
                          defaultValue={model.contractVehicleLimit}
                          id="site-workspace-contract-limit"
                          max={contractVehicleLimitMax}
                          min={0}
                          name="contractVehicleLimit"
                          required
                          type="number"
                        />
                        <small>{copy.contractLimitHelp}</small>
                      </label>
                      <label className="admin-field" htmlFor="site-workspace-contract-reason">
                        <span>{copy.changeReason}</span>
                        <textarea
                          id="site-workspace-contract-reason"
                          maxLength={500}
                          minLength={3}
                          name="reason"
                          placeholder={copy.changeReasonPlaceholder}
                          required
                        />
                      </label>
                      <button className="tt-button tt-button--compact" type="submit">
                        {copy.saveContract}
                      </button>
                    </form>
                  ) : null}
                  {lifecycleRequests.pendingBySiteId.get(model.id) ? (
                    <section
                      aria-label={copy.requestTitle}
                      className="admin-workspace-form admin-workspace-form--notice"
                    >
                      <h3>{copy.requestTitle}</h3>
                      <p>{copy.requestDescription}</p>
                      <p>
                        {copy.status}:{" "}
                        {
                          copy.lifecycleActionLabels[
                            lifecycleRequests.pendingBySiteId.get(model.id)?.action ?? "SUSPEND"
                          ]
                        }
                      </p>
                      {(() => {
                        const request = lifecycleRequests.pendingBySiteId.get(model.id);
                        if (!request || !lifecycleRequests.cancellableRequestIds.has(request.id))
                          return null;
                        return (
                          <form
                            action={cancelSiteLifecycleRequest}
                            className="admin-workspace-status-form"
                          >
                            <LifecycleRequestFields copy={copy} locale={locale} request={request} />
                            <label className="admin-field" htmlFor="site-workspace-cancel-reason">
                              <span>{copy.lifecycleReason}</span>
                              <textarea
                                id="site-workspace-cancel-reason"
                                maxLength={500}
                                minLength={3}
                                name="reason"
                                placeholder={copy.lifecycleReasonPlaceholder}
                                required
                              />
                            </label>
                            <button
                              className="tt-button tt-button--secondary tt-button--compact"
                              type="submit"
                            >
                              {copy.lifecycleCancel}
                            </button>
                          </form>
                        );
                      })()}
                    </section>
                  ) : null}
                  {model.status !== "CLOSED" &&
                  !lifecycleRequests.pendingBySiteId.has(model.id) &&
                  (canRequestStatus || canRequestClose) ? (
                    <form action={requestSiteLifecycle} className="admin-workspace-form">
                      <WorkspaceHiddenFields copy={copy} locale={locale} model={model} />
                      <input
                        aria-label={copy.status}
                        name="currentStatus"
                        type="hidden"
                        value={model.status}
                      />
                      <input
                        aria-label={copy.status}
                        name="expectedSiteVersion"
                        type="hidden"
                        value={model.version}
                      />
                      <h3>{copy.requestTitle}</h3>
                      <p>{copy.requestDescription}</p>
                      <label className="admin-field" htmlFor="site-workspace-request-reason">
                        <span>{copy.lifecycleReason}</span>
                        <textarea
                          id="site-workspace-request-reason"
                          maxLength={500}
                          minLength={3}
                          name="reason"
                          placeholder={copy.lifecycleReasonPlaceholder}
                          required
                        />
                      </label>
                      <div className="admin-workspace-status-form__actions">
                        {canRequestStatus ? (
                          <button
                            className="tt-button tt-button--secondary tt-button--compact"
                            name="action"
                            type="submit"
                            value={model.status === "ACTIVE" ? "SUSPEND" : "REACTIVATE"}
                          >
                            {model.status === "ACTIVE"
                              ? copy.lifecycleActionLabels.SUSPEND
                              : copy.lifecycleActionLabels.REACTIVATE}
                          </button>
                        ) : null}
                        {canRequestClose ? (
                          <button
                            className="tt-button tt-button--danger tt-button--compact"
                            name="action"
                            type="submit"
                            value="CLOSE"
                          >
                            {copy.lifecycleActionLabels.CLOSE}
                          </button>
                        ) : null}
                      </div>
                    </form>
                  ) : null}
                  {model.status !== "CLOSED" && (canChangeStatus || canClose) ? (
                    <form action={changeSiteStatus} className="admin-workspace-form">
                      <WorkspaceHiddenFields copy={copy} locale={locale} model={model} />
                      <input
                        aria-label={copy.status}
                        name="currentStatus"
                        type="hidden"
                        value={model.status}
                      />
                      <h3>{copy.status}</h3>
                      <p>{copy.statusDescription}</p>
                      {model.status === "ACTIVE" ? <p>{copy.suspendDescription}</p> : null}
                      {canClose ? <p>{copy.closeDescription}</p> : null}
                      <label className="admin-field" htmlFor="site-workspace-status-reason">
                        <span>{copy.lifecycleReason}</span>
                        <textarea
                          id="site-workspace-status-reason"
                          maxLength={500}
                          minLength={3}
                          name="reason"
                          placeholder={copy.lifecycleReasonPlaceholder}
                          required
                        />
                      </label>
                      <div className="admin-workspace-status-form__actions">
                        {canChangeStatus ? (
                          <button
                            className="tt-button tt-button--secondary tt-button--compact"
                            name="nextStatus"
                            type="submit"
                            value={model.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}
                          >
                            {model.status === "ACTIVE" ? copy.suspend : copy.reactivate}
                          </button>
                        ) : null}
                        {canClose ? (
                          <button
                            className="tt-button tt-button--danger tt-button--compact"
                            name="nextStatus"
                            type="submit"
                            value="CLOSED"
                          >
                            {copy.close}
                          </button>
                        ) : null}
                      </div>
                    </form>
                  ) : null}
                </section>
              </details>
            ) : null}
            <section className="admin-portfolio-panel">
              <header className="admin-portfolio-panel__header">
                <div>
                  <h2>{copy.qrStickerStatus}</h2>
                  <p>{copy.qrStickerStatusDescription}</p>
                </div>
              </header>
              <DataTable
                columns={batchColumns}
                empty={<EmptyState title={copy.noBatches} />}
                getRowKey={(batch) => batch.id}
                rows={batchRows}
              />
            </section>
            {canReceiveBatch &&
            batchRows.some(
              (batch) =>
                (batch.status === "DELIVERED" || batch.status === "PARTIALLY_RECEIVED") &&
                batch.remainingQuantity > 0,
            ) ? (
              <section className="admin-portfolio-panel" aria-labelledby="site-receipt-title">
                <header className="admin-portfolio-panel__header">
                  <div>
                    <h2 id="site-receipt-title">{copy.receiptTitle}</h2>
                    <p>{copy.receiptDescription}</p>
                  </div>
                </header>
                <div className="admin-workspace-form-grid">
                  {batchRows
                    .filter(
                      (batch) =>
                        (batch.status === "DELIVERED" || batch.status === "PARTIALLY_RECEIVED") &&
                        batch.remainingQuantity > 0,
                    )
                    .map((batch) => (
                      <form
                        action={receiveQrBatchQuantity}
                        className="admin-workspace-form admin-workspace-form--notice"
                        key={batch.id}
                      >
                        <input
                          aria-label={copy.locationWorkspace}
                          name="locale"
                          type="hidden"
                          value={locale}
                        />
                        <input
                          aria-label={copy.qrBatch}
                          name="batchId"
                          type="hidden"
                          value={batch.id}
                        />
                        <input
                          aria-label={copy.status}
                          name="expectedVersion"
                          type="hidden"
                          value={batch.version}
                        />
                        <input
                          aria-label={copy.managementCompany}
                          name="tenantId"
                          type="hidden"
                          value={model.tenantId}
                        />
                        <input
                          aria-label={copy.managementCompany}
                          name="managementCompanyId"
                          type="hidden"
                          value={model.managementCompanyId}
                        />
                        <input
                          aria-label={copy.locationName}
                          name="siteId"
                          type="hidden"
                          value={model.id}
                        />
                        <h3>
                          {copy.qrBatch} {batch.sequence}
                        </h3>
                        <p>
                          {copy.remainingQuantity}: {number.format(batch.remainingQuantity)}
                        </p>
                        <label className="admin-field" htmlFor={`receipt-quantity-${batch.id}`}>
                          <span>{copy.receivedQuantity}</span>
                          <input
                            defaultValue={batch.remainingQuantity}
                            id={`receipt-quantity-${batch.id}`}
                            max={batch.remainingQuantity}
                            min={1}
                            name="receivedQuantity"
                            required
                            type="number"
                          />
                        </label>
                        <label className="admin-field" htmlFor={`receipt-reason-${batch.id}`}>
                          <span>{copy.receiptReason}</span>
                          <textarea
                            id={`receipt-reason-${batch.id}`}
                            maxLength={500}
                            minLength={3}
                            name="reason"
                            placeholder={copy.receiptReasonPlaceholder}
                            required
                          />
                        </label>
                        <button className="tt-button tt-button--compact" type="submit">
                          {copy.recordReceipt}
                        </button>
                        <div>
                          <strong>{copy.receiptHistory}</strong>
                          {batch.receipts.length > 0 ? (
                            <ul>
                              {batch.receipts.map((receipt) => (
                                <li key={`${receipt.createdAt}-${receipt.quantity}`}>
                                  {number.format(receipt.quantity)} ·{" "}
                                  {dateTime.format(new Date(receipt.createdAt))}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>{copy.noReceiptHistory}</p>
                          )}
                        </div>
                      </form>
                    ))}
                </div>
              </section>
            ) : null}
            <section className="admin-portfolio-panel">
              <header className="admin-portfolio-panel__header">
                <div>
                  <h2>{copy.escalationQueue}</h2>
                  <p>{copy.escalationQueueDescription}</p>
                </div>
              </header>
              <p className="qr-note qr-note--warn">{copy.escalationPrivacyNotice}</p>
              <DataTable
                columns={escalationColumns}
                empty={<EmptyState title={copy.noEscalations} />}
                getRowKey={(item) => item.sessionId}
                rows={model.siteEscalations}
              />
            </section>
          </div>
          <aside className="admin-workspace-rail">
            <section className="admin-workspace-rail__section">
              <div className="admin-workspace-rail__header">
                <h2>{copy.qrStickerStatus}</h2>
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
                  <dt>{copy.outputReadyBatches}</dt>
                  <dd>{number.format(qrOperations.outputReadyBatches)}</dd>
                </div>
                <div>
                  <dt>{copy.failedNotifications}</dt>
                  <dd>{number.format(model.failedNotificationCount)}</dd>
                </div>
              </dl>
            </section>
            <section className="admin-workspace-rail__section">
              <div className="admin-workspace-rail__header">
                <h2>{copy.escalationQueue}</h2>
                <span className="admin-workspace-rail__count">
                  {number.format(model.siteEscalations.length)}
                </span>
              </div>
              <p>{copy.escalationPrivacyNotice}</p>
              <dl>
                <div>
                  <dt>{copy.contactRequests}</dt>
                  <dd>{number.format(model.contactCount)}</dd>
                </div>
                <div>
                  <dt>{copy.openRequests}</dt>
                  <dd>{number.format(model.openContactCount)}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
