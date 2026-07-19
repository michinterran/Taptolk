import type {
  QrAssetStatus,
  QrInventoryAssignmentAssetItem,
  QrInventoryAssignmentReadModel,
} from "@taptolk/application";
import {
  assignQrAsset,
  commitVehicleImport,
  receiveQrBatch,
  replaceQrAsset,
  revokeQrAsset,
  validateVehicleImport,
} from "../admin/qr-inventory-assignment-actions";
import type { AppLocale } from "../i18n/config";

interface InventoryAssignmentCopy {
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
  canAssign: boolean;
  canRevoke: boolean;
  copy: InventoryAssignmentCopy;
  locale: AppLocale;
  model: QrInventoryAssignmentReadModel;
}

function ScopeFields({
  item,
  locale,
}: {
  item: { managementCompanyId: string; siteId: string; tenantId: string };
  locale: AppLocale;
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
    </>
  );
}

function ReasonField({ copy, id }: { copy: InventoryAssignmentCopy; id: string }) {
  return (
    <label className="admin-field" htmlFor={id}>
      <span>{copy.reason}</span>
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

function AssetIdentity({
  asset,
  copy,
}: {
  asset: QrInventoryAssignmentAssetItem;
  copy: InventoryAssignmentCopy;
}) {
  return (
    <header className="admin-approval-card__header">
      <div>
        <span className="admin-approval-card__label">{copy.humanCode}</span>
        <h3>{asset.humanCode}</h3>
        {asset.currentVehicleLast4 ? (
          <small>
            {copy.vehicleLast4} · {asset.currentVehicleLast4}
          </small>
        ) : null}
      </div>
      <span className="admin-status-badge">{copy.statusLabels[asset.status]}</span>
    </header>
  );
}

export function QrInventoryAssignmentView({
  canAssign,
  canRevoke,
  copy,
  locale,
  model,
}: InventoryAssignmentViewProps) {
  const stockAssets = model.assets.filter((asset) => asset.status === "IN_STOCK");
  const assignedAssets = model.assets.filter((asset) =>
    ["ASSIGNED", "ACTIVATION_PENDING", "ACTIVE", "SUSPENDED", "LOST", "DAMAGED"].includes(
      asset.status,
    ),
  );
  const siteOptions = Array.from(
    new Map(
      model.batches.map((batch) => [
        batch.siteId,
        {
          label: batch.siteName,
          managementCompanyId: batch.managementCompanyId,
          siteId: batch.siteId,
          tenantId: batch.tenantId,
        },
      ]),
    ).values(),
  );

  return (
    <>
      <section aria-labelledby="inventory-receipt-title" className="admin-lifecycle-queue">
        <header>
          <h2 id="inventory-receipt-title">{copy.batchReceiveTitle}</h2>
          <p>{copy.batchReceiveDescription}</p>
        </header>
        {canAssign && model.batches.some((batch) => batch.status === "DELIVERED") ? (
          <div className="admin-approval-list">
            {model.batches
              .filter((batch) => batch.status === "DELIVERED")
              .map((batch) => (
                <form action={receiveQrBatch} className="admin-approval-card" key={batch.id}>
                  <ScopeFields item={batch} locale={locale} />
                  <input aria-label="batch" name="batchId" type="hidden" value={batch.id} />
                  <input
                    aria-label="batch version"
                    name="expectedVersion"
                    type="hidden"
                    value={batch.version}
                  />
                  <strong>
                    {batch.siteName} · {batch.batchCode} · {batch.requestedQuantity}
                  </strong>
                  <ReasonField copy={copy} id={`receive-reason-${batch.id}`} />
                  <button className="tt-button" type="submit">
                    {copy.batchReceive}
                  </button>
                </form>
              ))}
          </div>
        ) : (
          <p className="admin-catalog-read-only">{copy.empty}</p>
        )}
      </section>

      {canAssign ? (
        <section aria-labelledby="inventory-import-title" className="admin-lifecycle-queue">
          <header>
            <h2 id="inventory-import-title">{copy.importTitle}</h2>
            <p>{copy.importDescription}</p>
          </header>
          {siteOptions.length > 0 ? (
            <form action={validateVehicleImport} className="admin-approval-card">
              <label className="admin-field" htmlFor="vehicle-import-site">
                <span>{copy.site}</span>
                <select id="vehicle-import-site" name="siteScope" required>
                  {siteOptions.map((site) => (
                    <option
                      key={site.siteId}
                      value={`${site.tenantId}|${site.managementCompanyId}|${site.siteId}`}
                    >
                      {site.label}
                    </option>
                  ))}
                </select>
              </label>
              <input aria-label="locale" name="locale" type="hidden" value={locale} />
              <label className="admin-field" htmlFor="vehicle-import-file">
                <span>{copy.csvFile}</span>
                <input
                  accept=".csv,text/csv"
                  id="vehicle-import-file"
                  name="csvFile"
                  required
                  type="file"
                />
              </label>
              <ReasonField copy={copy} id="vehicle-import-reason" />
              <p className="admin-catalog-read-only">{copy.securityNote}</p>
              <button className="tt-button" type="submit">
                {copy.importTitle}
              </button>
            </form>
          ) : (
            <p className="admin-catalog-read-only">{copy.empty}</p>
          )}

          {model.imports
            .filter((item) => item.status === "VALIDATED")
            .map((item) => (
              <form action={commitVehicleImport} className="admin-approval-card" key={item.id}>
                <ScopeFields item={item} locale={locale} />
                <input aria-label="import" name="importId" type="hidden" value={item.id} />
                <input
                  aria-label="import version"
                  name="expectedVersion"
                  type="hidden"
                  value={item.version}
                />
                <strong>
                  {item.rowCount} · {copy.originalDeleted}
                </strong>
                <ReasonField copy={copy} id={`import-commit-reason-${item.id}`} />
                <button className="tt-button" type="submit">
                  {copy.commit}
                </button>
              </form>
            ))}
        </section>
      ) : null}

      <section aria-labelledby="inventory-assignment-title" className="admin-lifecycle-queue">
        <header>
          <h2 id="inventory-assignment-title">{copy.assignTitle}</h2>
          <p>{copy.assignDescription}</p>
        </header>
        {canAssign && stockAssets.length > 0 ? (
          <div className="admin-approval-list">
            {stockAssets.map((asset) => (
              <form action={assignQrAsset} className="admin-approval-card" key={asset.id}>
                <AssetIdentity asset={asset} copy={copy} />
                <ScopeFields item={asset} locale={locale} />
                <input aria-label="QR asset" name="qrAssetId" type="hidden" value={asset.id} />
                <input
                  aria-label="QR asset version"
                  name="expectedVersion"
                  type="hidden"
                  value={asset.version}
                />
                <label className="admin-field" htmlFor={`vehicle-plate-${asset.id}`}>
                  <span>{copy.vehiclePlate}</span>
                  <input
                    autoComplete="off"
                    id={`vehicle-plate-${asset.id}`}
                    maxLength={16}
                    name="vehiclePlate"
                    required
                  />
                </label>
                <ReasonField copy={copy} id={`assignment-reason-${asset.id}`} />
                <button className="tt-button" type="submit">
                  {copy.assign}
                </button>
              </form>
            ))}
          </div>
        ) : (
          <p className="admin-catalog-read-only">{copy.empty}</p>
        )}
      </section>

      {canRevoke && assignedAssets.length > 0 ? (
        <section aria-labelledby="inventory-lifecycle-title" className="admin-lifecycle-queue">
          <header>
            <h2 id="inventory-lifecycle-title">{copy.replacement}</h2>
            <p>{copy.securityNote}</p>
          </header>
          <div className="admin-approval-list">
            {assignedAssets.map((asset) => {
              const replacements = stockAssets.filter((item) => item.siteId === asset.siteId);
              return (
                <article className="admin-approval-card" key={asset.id}>
                  <AssetIdentity asset={asset} copy={copy} />
                  {replacements.length > 0 ? (
                    <form action={replaceQrAsset} className="admin-approval-form">
                      <ScopeFields item={asset} locale={locale} />
                      <input
                        aria-label="source QR asset"
                        name="qrAssetId"
                        type="hidden"
                        value={asset.id}
                      />
                      <input
                        aria-label="source QR asset version"
                        name="expectedVersion"
                        type="hidden"
                        value={asset.version}
                      />
                      <label className="admin-field" htmlFor={`replacement-${asset.id}`}>
                        <span>{copy.replacement}</span>
                        <select id={`replacement-${asset.id}`} name="replacementScope" required>
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
                      <ReasonField copy={copy} id={`replace-reason-${asset.id}`} />
                      <button className="tt-button" type="submit">
                        {copy.replace}
                      </button>
                    </form>
                  ) : null}
                  <form action={revokeQrAsset} className="admin-approval-form">
                    <ScopeFields item={asset} locale={locale} />
                    <input aria-label="QR asset" name="qrAssetId" type="hidden" value={asset.id} />
                    <input
                      aria-label="QR asset version"
                      name="expectedVersion"
                      type="hidden"
                      value={asset.version}
                    />
                    <ReasonField copy={copy} id={`revoke-reason-${asset.id}`} />
                    <button className="tt-button tt-button--secondary" type="submit">
                      {copy.revoke}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
