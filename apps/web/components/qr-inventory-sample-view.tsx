import type {
  QrBatchItem,
  QrBatchStatus,
  QrFinalApprovalBatchItem,
  QrFinalGenerationApprovalReadModel,
  QrInventorySampleReadModel,
  StickerDesignStatus,
  StickerDesignVersionItem,
} from "@taptolk/application";
import { SemanticHeading } from "@taptolk/ui";
import {
  approveQrBatchFinalGeneration,
  cancelQrBatchBeforeGenerationApproval,
  requestQrBatchFinalApproval,
} from "../admin/qr-final-generation-approval-actions";
import {
  approveQrBatchSample,
  approveStickerDesignVersion,
  archiveStickerDesignVersion,
  attachQrBatchSample,
  cancelQrBatch,
  createStickerDesignVersion,
  invalidateQrBatchSample,
  requestQrBatch,
} from "../admin/qr-inventory-sample-actions";
import { signOutAdmin } from "../auth/actions";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";

interface QrInventoryCopy {
  actions: string;
  approve: string;
  archive: string;
  artifact: string;
  back: string;
  batchCancel: string;
  batchCode: string;
  batchEmpty: string;
  batchPurpose: string;
  batchQuantity: string;
  batchRequest: string;
  batchRequestDescription: string;
  batchRequestTitle: string;
  batchStatusLabels: Readonly<Record<QrBatchStatus, string>>;
  batchTitle: string;
  byteSize: string;
  checksum: string;
  company: string;
  contrast: string;
  createdAt: string;
  decode: string;
  description: string;
  designApproveDescription: string;
  designApproveTitle: string;
  designConfig: string;
  designCreate: string;
  designCreateDescription: string;
  designCreateTitle: string;
  designEmpty: string;
  designStatusLabels: Readonly<Record<StickerDesignStatus, string>>;
  designTitle: string;
  emptyQueue: string;
  eyebrow: string;
  finalApprovalNotice: string;
  finalApprovalApprove: string;
  finalApprovalDescription: string;
  finalApprovalRequest: string;
  finalApprovalRequestDescription: string;
  finalApprovalTitle: string;
  invalidate: string;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  mimeType: string;
  noApprovedDesign: string;
  noSite: string;
  purposePlaceholder: string;
  qaEvidence: string;
  quietZone: string;
  reason: string;
  reasonPlaceholder: string;
  sampleApprove: string;
  sampleApproveDescription: string;
  sampleApproveTitle: string;
  sampleAttach: string;
  sampleAttachDescription: string;
  sampleReady: string;
  sampleStatus: string;
  securityNote: string;
  signOut: string;
  site: string;
  storageBucket: string;
  storagePath: string;
  templateCode: string;
  tenant: string;
  titleLines: readonly [string, ...string[]];
  waitingDesign: string;
  waitingFinal: string;
  waitingSample: string;
}

interface QrInventorySampleViewProps {
  backHref: string;
  canApproveDesign: boolean;
  canApproveFinalGeneration: boolean;
  canArchiveDesign: boolean;
  canCreateDesign: boolean;
  canOperateSample: boolean;
  canRequestBatch: boolean;
  copy: QrInventoryCopy;
  errorMessage?: string | undefined;
  finalApprovalModel: QrFinalGenerationApprovalReadModel;
  locale: AppLocale;
  model: QrInventorySampleReadModel;
  statusMessage?: string | undefined;
}

function formatDate(locale: AppLocale, value: string): string {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ScopeFields({
  copy,
  item,
  locale,
}: {
  copy: QrInventoryCopy;
  item: { managementCompanyId: string; siteId: string; tenantId: string };
  locale: AppLocale;
}) {
  return (
    <>
      <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
      <input aria-label={copy.tenant} name="tenantId" type="hidden" value={item.tenantId} />
      <input
        aria-label={copy.company}
        name="managementCompanyId"
        type="hidden"
        value={item.managementCompanyId}
      />
      <input aria-label={copy.site} name="siteId" type="hidden" value={item.siteId} />
    </>
  );
}

function DesignFields({
  copy,
  design,
  locale,
}: {
  copy: QrInventoryCopy;
  design: StickerDesignVersionItem;
  locale: AppLocale;
}) {
  return (
    <>
      <ScopeFields copy={copy} item={design} locale={locale} />
      <input aria-label={copy.designTitle} name="designId" type="hidden" value={design.id} />
      <input
        aria-label={copy.actions}
        name="expectedVersion"
        type="hidden"
        value={design.version}
      />
      <input
        aria-label={copy.designTitle}
        name="designStatus"
        type="hidden"
        value={design.status}
      />
      <input
        aria-label={copy.actions}
        name="createdByCurrentActor"
        type="hidden"
        value={design.createdByCurrentActor ? "on" : "off"}
      />
    </>
  );
}

function BatchFields({
  batch,
  copy,
  locale,
}: {
  batch: QrBatchItem;
  copy: QrInventoryCopy;
  locale: AppLocale;
}) {
  return (
    <>
      <ScopeFields copy={copy} item={batch} locale={locale} />
      <input aria-label={copy.batchCode} name="batchId" type="hidden" value={batch.id} />
      <input
        aria-label={copy.actions}
        name="expectedBatchVersion"
        type="hidden"
        value={batch.version}
      />
      <input aria-label={copy.batchTitle} name="batchStatus" type="hidden" value={batch.status} />
      <input
        aria-label={copy.actions}
        name="requestedByCurrentActor"
        type="hidden"
        value={batch.requestedByCurrentActor ? "on" : "off"}
      />
      {batch.sample ? (
        <>
          <input aria-label={copy.artifact} name="sampleId" type="hidden" value={batch.sample.id} />
          <input
            aria-label={copy.actions}
            name="expectedSampleVersion"
            type="hidden"
            value={batch.sample.version}
          />
          <input
            aria-label={copy.sampleStatus}
            name="sampleStatus"
            type="hidden"
            value={batch.sample.status}
          />
        </>
      ) : null}
    </>
  );
}

function FinalApprovalFields({
  batch,
  copy,
  locale,
}: {
  batch: Pick<QrFinalApprovalBatchItem, "id" | "version">;
  copy: QrInventoryCopy;
  locale: AppLocale;
}) {
  return (
    <>
      <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
      <input aria-label={copy.batchCode} name="batchId" type="hidden" value={batch.id} />
      <input
        aria-label={copy.actions}
        name="expectedBatchVersion"
        type="hidden"
        value={batch.version}
      />
      <input aria-label={copy.actions} name="requestId" type="hidden" value={crypto.randomUUID()} />
    </>
  );
}

function ReasonField({ copy, id }: { copy: QrInventoryCopy; id: string }) {
  return (
    <label className="admin-field" htmlFor={id}>
      <span>{copy.reason}</span>
      <textarea
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

function SampleApprovalCard({
  batch,
  copy,
  locale,
}: {
  batch: QrBatchItem;
  copy: QrInventoryCopy;
  locale: AppLocale;
}) {
  if (!batch.sample) {
    return null;
  }
  return (
    <article className="admin-approval-card">
      <header className="admin-approval-card__header">
        <div>
          <span className="admin-approval-card__label">{batch.batchCode}</span>
          <h3>{batch.siteName}</h3>
        </div>
        <span className="admin-status-badge admin-status-badge--suspended">{copy.sampleReady}</span>
      </header>
      <dl className="admin-approval-meta">
        <div>
          <dt>{copy.batchQuantity}</dt>
          <dd>{batch.requestedQuantity.toLocaleString(locale === "ko" ? "ko-KR" : "en")}</dd>
        </div>
        <div>
          <dt>{copy.templateCode}</dt>
          <dd>{batch.templateCode}</dd>
        </div>
        <div>
          <dt>{copy.qaEvidence}</dt>
          <dd>
            {copy.decode} ✓ · {copy.quietZone} ✓ · {copy.contrast} ✓
          </dd>
        </div>
      </dl>
      <form action={approveQrBatchSample} className="admin-approval-form">
        <BatchFields batch={batch} copy={copy} locale={locale} />
        <input aria-label={copy.decode} name="decodePassed" type="hidden" value="on" />
        <input aria-label={copy.quietZone} name="quietZonePassed" type="hidden" value="on" />
        <input aria-label={copy.contrast} name="contrastPassed" type="hidden" value="on" />
        <ReasonField copy={copy} id={`sample-approve-${batch.id}`} />
        <button className="tt-button admin-approval-primary-action" type="submit">
          {copy.sampleApprove}
        </button>
      </form>
    </article>
  );
}

function BatchCard({
  batch,
  canOperateSample,
  canCancel,
  canCancelFinalApproval,
  canRequestFinalApproval,
  copy,
  locale,
}: {
  batch: QrBatchItem;
  canCancel: boolean;
  canCancelFinalApproval: boolean;
  canOperateSample: boolean;
  canRequestFinalApproval: boolean;
  copy: QrInventoryCopy;
  locale: AppLocale;
}) {
  const canAttach = canOperateSample && batch.status === "DRAFT" && !batch.sample;
  const canInvalidate =
    canOperateSample &&
    batch.sample &&
    (batch.status === "SAMPLE_READY" || batch.status === "SAMPLE_APPROVED");
  const waiting =
    batch.status === "DRAFT"
      ? copy.waitingSample
      : batch.status === "SAMPLE_READY"
        ? copy.sampleApproveDescription
        : batch.status === "SAMPLE_APPROVED"
          ? copy.waitingFinal
          : copy.batchStatusLabels[batch.status];

  return (
    <article className="admin-approval-card">
      <header className="admin-approval-card__header">
        <div>
          <span className="admin-approval-card__label">{batch.batchCode}</span>
          <h3>{batch.siteName}</h3>
        </div>
        <span className="admin-status-badge">{copy.batchStatusLabels[batch.status]}</span>
      </header>
      <dl className="admin-approval-meta">
        <div>
          <dt>{copy.batchQuantity}</dt>
          <dd>{batch.requestedQuantity.toLocaleString(locale === "ko" ? "ko-KR" : "en")}</dd>
        </div>
        <div>
          <dt>{copy.templateCode}</dt>
          <dd>{batch.templateCode}</dd>
        </div>
        <div>
          <dt>{copy.createdAt}</dt>
          <dd>
            <time dateTime={batch.createdAt}>{formatDate(locale, batch.createdAt)}</time>
          </dd>
        </div>
      </dl>
      <div className="admin-approval-form">
        <p className="admin-catalog-read-only">{waiting}</p>
      </div>
      {canAttach ? (
        <details className="admin-rejection-panel">
          <summary>{copy.sampleAttach}</summary>
          <form action={attachQrBatchSample} className="admin-rejection-form">
            <BatchFields batch={batch} copy={copy} locale={locale} />
            <div className="admin-approval-field-grid">
              <label className="admin-field" htmlFor={`bucket-${batch.id}`}>
                <span>{copy.storageBucket}</span>
                <input id={`bucket-${batch.id}`} name="storageBucket" required />
              </label>
              <label className="admin-field" htmlFor={`path-${batch.id}`}>
                <span>{copy.storagePath}</span>
                <input id={`path-${batch.id}`} maxLength={500} name="storagePath" required />
              </label>
              <label className="admin-field" htmlFor={`checksum-${batch.id}`}>
                <span>{copy.checksum}</span>
                <input
                  id={`checksum-${batch.id}`}
                  maxLength={64}
                  minLength={64}
                  name="checksumSha256"
                  required
                />
              </label>
              <label className="admin-field" htmlFor={`mime-${batch.id}`}>
                <span>{copy.mimeType}</span>
                <select id={`mime-${batch.id}`} name="mimeType">
                  <option value="image/png">image/png</option>
                  <option value="image/svg+xml">image/svg+xml</option>
                  <option value="application/pdf">application/pdf</option>
                </select>
              </label>
              <label className="admin-field" htmlFor={`bytes-${batch.id}`}>
                <span>{copy.byteSize}</span>
                <input
                  id={`bytes-${batch.id}`}
                  max={20_000_000}
                  min={1}
                  name="byteSize"
                  required
                  type="number"
                />
              </label>
            </div>
            <fieldset className="admin-approval-form">
              <legend>{copy.qaEvidence}</legend>
              <label>
                <input aria-label={copy.decode} name="decodePassed" required type="checkbox" />{" "}
                {copy.decode}
              </label>
              <label>
                <input
                  aria-label={copy.quietZone}
                  name="quietZonePassed"
                  required
                  type="checkbox"
                />{" "}
                {copy.quietZone}
              </label>
              <label>
                <input aria-label={copy.contrast} name="contrastPassed" required type="checkbox" />{" "}
                {copy.contrast}
              </label>
            </fieldset>
            <ReasonField copy={copy} id={`sample-attach-reason-${batch.id}`} />
            <button className="tt-button" type="submit">
              {copy.sampleAttach}
            </button>
          </form>
        </details>
      ) : null}
      {canInvalidate ? (
        <details className="admin-rejection-panel">
          <summary>{copy.invalidate}</summary>
          <form action={invalidateQrBatchSample} className="admin-rejection-form">
            <BatchFields batch={batch} copy={copy} locale={locale} />
            <ReasonField copy={copy} id={`sample-invalidate-${batch.id}`} />
            <button className="tt-button admin-danger-action" type="submit">
              {copy.invalidate}
            </button>
          </form>
        </details>
      ) : null}
      {canCancel ? (
        <details className="admin-rejection-panel">
          <summary>{copy.batchCancel}</summary>
          <form action={cancelQrBatch} className="admin-rejection-form">
            <BatchFields batch={batch} copy={copy} locale={locale} />
            <ReasonField copy={copy} id={`batch-cancel-${batch.id}`} />
            <button className="tt-button admin-danger-action" type="submit">
              {copy.batchCancel}
            </button>
          </form>
        </details>
      ) : null}
      {canRequestFinalApproval ? (
        <details className="admin-rejection-panel">
          <summary>{copy.finalApprovalRequest}</summary>
          <form action={requestQrBatchFinalApproval} className="admin-rejection-form">
            <FinalApprovalFields batch={batch} copy={copy} locale={locale} />
            <ReasonField copy={copy} id={`final-request-${batch.id}`} />
            <button className="tt-button admin-approval-primary-action" type="submit">
              {copy.finalApprovalRequest}
            </button>
          </form>
        </details>
      ) : null}
      {canCancelFinalApproval ? (
        <details className="admin-rejection-panel">
          <summary>{copy.batchCancel}</summary>
          <form action={cancelQrBatchBeforeGenerationApproval} className="admin-rejection-form">
            <FinalApprovalFields batch={batch} copy={copy} locale={locale} />
            <ReasonField copy={copy} id={`final-cancel-${batch.id}`} />
            <button className="tt-button admin-danger-action" type="submit">
              {copy.batchCancel}
            </button>
          </form>
        </details>
      ) : null}
    </article>
  );
}

function FinalGenerationApprovalCard({
  batch,
  copy,
  locale,
  templateCode,
}: {
  batch: QrFinalApprovalBatchItem;
  copy: QrInventoryCopy;
  locale: AppLocale;
  templateCode: string;
}) {
  return (
    <article className="admin-approval-card">
      <header className="admin-approval-card__header">
        <div>
          <span className="admin-approval-card__label">{batch.batchCode}</span>
          <h3>{batch.siteName}</h3>
        </div>
        <span className="admin-status-badge admin-status-badge--suspended">
          {copy.batchStatusLabels[batch.status]}
        </span>
      </header>
      <dl className="admin-approval-meta">
        <div>
          <dt>{copy.batchQuantity}</dt>
          <dd>{batch.requestedQuantity.toLocaleString(locale === "ko" ? "ko-KR" : "en")}</dd>
        </div>
        <div>
          <dt>{copy.templateCode}</dt>
          <dd>{templateCode}</dd>
        </div>
        <div>
          <dt>{copy.createdAt}</dt>
          <dd>
            <time dateTime={batch.createdAt}>{formatDate(locale, batch.createdAt)}</time>
          </dd>
        </div>
      </dl>
      <form action={approveQrBatchFinalGeneration} className="admin-approval-form">
        <FinalApprovalFields batch={batch} copy={copy} locale={locale} />
        <ReasonField copy={copy} id={`final-approve-${batch.id}`} />
        <button className="tt-button admin-approval-primary-action" type="submit">
          {copy.finalApprovalApprove}
        </button>
      </form>
    </article>
  );
}

export function QrInventorySampleView({
  backHref,
  canApproveDesign,
  canApproveFinalGeneration,
  canArchiveDesign,
  canCreateDesign,
  canOperateSample,
  canRequestBatch,
  copy,
  errorMessage,
  finalApprovalModel,
  locale,
  model,
  statusMessage,
}: QrInventorySampleViewProps) {
  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={copy.localeLabels}
        localeTitle={copy.localeTitle}
        logoAlt={copy.logoAlt}
        pathname={`/${locale}/admin/qr-inventory`}
      />

      <section className="admin-section-hero">
        <div>
          <a className="admin-back-link" href={backHref}>
            {copy.back}
          </a>
          <p className="eyebrow">{copy.eyebrow}</p>
          <SemanticHeading className="admin-section-title" lines={copy.titleLines} />
          <p className="admin-dashboard-description">{copy.description}</p>
        </div>
        <form action={signOutAdmin}>
          <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
          <button className="tt-button tt-button--secondary" type="submit">
            {copy.signOut}
          </button>
        </form>
      </section>

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
      <aside className="admin-notice">
        <strong>{copy.finalApprovalNotice}</strong>
      </aside>

      {canCreateDesign ? (
        <details className="admin-tenant-create">
          <summary>
            <span>{copy.designCreateTitle}</span>
            <small>{copy.designCreateDescription}</small>
          </summary>
          {model.siteOptions.length > 0 ? (
            <form action={createStickerDesignVersion} className="admin-tenant-form">
              <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />
              <div className="admin-tenant-field-grid">
                <label className="admin-field" htmlFor="design-site">
                  <span>{copy.site}</span>
                  <select id="design-site" name="siteScope" required>
                    {model.siteOptions.map((site) => (
                      <option
                        key={site.id}
                        value={`${site.tenantId}|${site.managementCompanyId}|${site.id}|${site.version}|${site.status}`}
                      >
                        {site.tenantName} / {site.managementCompanyName} / {site.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field" htmlFor="design-template">
                  <span>{copy.templateCode}</span>
                  <input id="design-template" maxLength={64} name="templateCode" required />
                </label>
              </div>
              <label className="admin-field" htmlFor="design-config">
                <span>{copy.designConfig}</span>
                <textarea
                  defaultValue={'{"layout":"round-85","qrQuietZone":4}'}
                  id="design-config"
                  maxLength={20_000}
                  name="designConfig"
                  required
                />
              </label>
              <ReasonField copy={copy} id="design-create-reason" />
              <button className="tt-button" type="submit">
                {copy.designCreate}
              </button>
            </form>
          ) : (
            <p className="admin-catalog-read-only">{copy.noSite}</p>
          )}
        </details>
      ) : null}

      {canApproveDesign ? (
        <section aria-labelledby="design-approval-title" className="admin-lifecycle-queue">
          <header>
            <h2 id="design-approval-title">{copy.designApproveTitle}</h2>
            <p>{copy.designApproveDescription}</p>
          </header>
          {model.designApprovalQueue.length > 0 ? (
            <div className="admin-approval-list">
              {model.designApprovalQueue.map((design) => (
                <article className="admin-approval-card" key={design.id}>
                  <header className="admin-approval-card__header">
                    <div>
                      <span className="admin-approval-card__label">{design.templateCode}</span>
                      <h3>{design.siteName}</h3>
                    </div>
                    <span className="admin-status-badge admin-status-badge--suspended">
                      {copy.waitingDesign}
                    </span>
                  </header>
                  <form action={approveStickerDesignVersion} className="admin-approval-form">
                    <DesignFields copy={copy} design={design} locale={locale} />
                    <ReasonField copy={copy} id={`design-approve-${design.id}`} />
                    <button className="tt-button admin-approval-primary-action" type="submit">
                      {copy.approve}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <p className="admin-catalog-read-only">{copy.emptyQueue}</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="design-catalog-title" className="admin-lifecycle-queue">
        <header>
          <h2 id="design-catalog-title">{copy.designTitle}</h2>
          <p>{copy.securityNote}</p>
        </header>
        {model.designs.length > 0 ? (
          <div className="admin-approval-list">
            {model.designs.map((design) => (
              <article className="admin-approval-card" key={design.id}>
                <header className="admin-approval-card__header">
                  <div>
                    <span className="admin-approval-card__label">{design.templateCode}</span>
                    <h3>{design.siteName}</h3>
                  </div>
                  <span className="admin-status-badge">
                    {copy.designStatusLabels[design.status]}
                  </span>
                </header>
                {canArchiveDesign && design.status === "APPROVED" ? (
                  <form action={archiveStickerDesignVersion} className="admin-approval-form">
                    <DesignFields copy={copy} design={design} locale={locale} />
                    <ReasonField copy={copy} id={`design-archive-${design.id}`} />
                    <button className="tt-button tt-button--secondary" type="submit">
                      {copy.archive}
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-catalog-read-only">{copy.designEmpty}</p>
        )}
      </section>

      {canRequestBatch ? (
        <section aria-labelledby="batch-request-title" className="admin-lifecycle-queue">
          <header>
            <h2 id="batch-request-title">{copy.batchRequestTitle}</h2>
            <p>{copy.batchRequestDescription}</p>
          </header>
          {model.approvedDesignOptions.length > 0 ? (
            <div className="admin-approval-list">
              {model.approvedDesignOptions.map((design) => {
                const site = model.siteOptions.find((item) => item.id === design.siteId);
                if (!site) {
                  return null;
                }
                return (
                  <form action={requestQrBatch} className="admin-approval-card" key={design.id}>
                    <div className="admin-approval-form">
                      <ScopeFields copy={copy} item={design} locale={locale} />
                      <input
                        aria-label={copy.designTitle}
                        name="designId"
                        type="hidden"
                        value={design.id}
                      />
                      <input
                        aria-label={copy.designTitle}
                        name="designStatus"
                        type="hidden"
                        value={design.status}
                      />
                      <input
                        aria-label={copy.actions}
                        name="expectedDesignVersion"
                        type="hidden"
                        value={design.version}
                      />
                      <input
                        aria-label={copy.actions}
                        name="expectedSiteVersion"
                        type="hidden"
                        value={site.version}
                      />
                      <input
                        aria-label={copy.site}
                        name="siteStatus"
                        type="hidden"
                        value={site.status}
                      />
                      <strong>
                        {design.siteName} · {design.templateCode}
                      </strong>
                      <div className="admin-approval-field-grid">
                        <label className="admin-field" htmlFor={`quantity-${design.id}`}>
                          <span>{copy.batchQuantity}</span>
                          <input
                            id={`quantity-${design.id}`}
                            max={100}
                            min={1}
                            name="quantity"
                            required
                            type="number"
                          />
                        </label>
                        <label className="admin-field" htmlFor={`purpose-${design.id}`}>
                          <span>{copy.batchPurpose}</span>
                          <input
                            id={`purpose-${design.id}`}
                            maxLength={200}
                            minLength={3}
                            name="purpose"
                            placeholder={copy.purposePlaceholder}
                            required
                          />
                        </label>
                      </div>
                      <ReasonField copy={copy} id={`batch-request-reason-${design.id}`} />
                      <button className="tt-button" type="submit">
                        {copy.batchRequest}
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          ) : (
            <p className="admin-catalog-read-only">{copy.noApprovedDesign}</p>
          )}
        </section>
      ) : null}

      {canOperateSample ? (
        <section aria-labelledby="sample-approval-title" className="admin-lifecycle-queue">
          <header>
            <h2 id="sample-approval-title">{copy.sampleApproveTitle}</h2>
            <p>{copy.sampleApproveDescription}</p>
          </header>
          {model.sampleApprovalQueue.length > 0 ? (
            <div className="admin-approval-list">
              {model.sampleApprovalQueue.map((batch) => (
                <SampleApprovalCard batch={batch} copy={copy} key={batch.id} locale={locale} />
              ))}
            </div>
          ) : (
            <p className="admin-catalog-read-only">{copy.emptyQueue}</p>
          )}
        </section>
      ) : null}

      {canApproveFinalGeneration ? (
        <section aria-labelledby="final-approval-title" className="admin-lifecycle-queue">
          <header>
            <h2 id="final-approval-title">{copy.finalApprovalTitle}</h2>
            <p>{copy.finalApprovalDescription}</p>
          </header>
          {finalApprovalModel.finalApprovalQueue.length > 0 ? (
            <div className="admin-approval-list">
              {finalApprovalModel.finalApprovalQueue.map((batch) => {
                const inventoryBatch = model.batches.find((item) => item.id === batch.id);
                return inventoryBatch ? (
                  <FinalGenerationApprovalCard
                    batch={batch}
                    copy={copy}
                    key={batch.id}
                    locale={locale}
                    templateCode={inventoryBatch.templateCode}
                  />
                ) : null;
              })}
            </div>
          ) : (
            <p className="admin-catalog-read-only">{copy.emptyQueue}</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="batch-catalog-title" className="admin-lifecycle-queue">
        <header>
          <h2 id="batch-catalog-title">{copy.batchTitle}</h2>
          <p>{copy.securityNote}</p>
        </header>
        {model.batches.length > 0 ? (
          <div className="admin-approval-list">
            {model.batches.map((batch) => (
              <BatchCard
                batch={batch}
                canCancel={model.cancellableBatchIds.has(batch.id)}
                canCancelFinalApproval={finalApprovalModel.cancellableBatchIds.has(batch.id)}
                canOperateSample={canOperateSample}
                canRequestFinalApproval={finalApprovalModel.requestableBatchIds.has(batch.id)}
                copy={copy}
                key={batch.id}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <p className="admin-catalog-read-only">{copy.batchEmpty}</p>
        )}
      </section>
    </>
  );
}
