import {
  type QrBatchItem,
  type QrBatchStatus,
  type QrFinalApprovalBatchItem,
  type QrFinalGenerationApprovalReadModel,
  type QrInventorySampleReadModel,
  STICKER_TEMPLATE_CODES,
  type StickerDesignStatus,
  type StickerDesignVersionItem,
} from "@taptolk/application";
import { StatusPill } from "@taptolk/ui";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  approveQrBatchFinalGeneration,
  cancelQrBatchBeforeGenerationApproval,
  requestQrBatchFinalApproval,
} from "../admin/qr-final-generation-approval-actions";
import {
  approveQrBatchSample,
  approveStickerDesignVersion,
  archiveStickerDesignVersion,
  cancelQrBatch,
  createStickerDesignVersion,
  generateQrBatchSample,
  invalidateQrBatchSample,
  requestQrBatch,
} from "../admin/qr-inventory-sample-actions";
import type { AdminQrWorkflowCopy } from "../content/admin-qr-workflow-copy";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";
import { QrQuantityControl } from "./qr-quantity-control";

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
  batchSplitNotice: string;
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
  designLogo: string;
  designLogoNone: string;
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
  samplePreviewAlt: string;
  samplePreviewDesktop: string;
  samplePreviewMobile: string;
  sampleStatus: string;
  securityNote: string;
  signOut: string;
  site: string;
  storageBucket: string;
  storagePath: string;
  templateCode: string;
  wizardBrand: string;
  wizardBrandDescription: string;
  wizardPreview: string;
  wizardQuantityHint: string;
  wizardStep1: string;
  wizardStep1Description: string;
  wizardStep2: string;
  wizardStep2Description: string;
  wizardStep3: string;
  wizardStep3Description: string;
  wizardTemplate: string;
  wizardTemplateDescription: string;
  wizardTitle: string;
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
  brandAssetUpload?: ReactNode;
  workflowCopy: AdminQrWorkflowCopy;
}

function formatDate(locale: AppLocale, value: string): string {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getQrBatchStatusTone(
  status: QrBatchStatus,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "FAILED" || status === "CANCELLED") {
    return "danger";
  }

  if (status === "COMPLETED" || status === "DELIVERED") {
    return "success";
  }

  if (status === "DRAFT") {
    return "neutral";
  }

  if (
    status === "PARTIALLY_COMPLETED" ||
    status === "SAMPLE_READY" ||
    status === "FINAL_APPROVAL_PENDING"
  ) {
    return "warning";
  }

  return "info";
}

function getStickerDesignStatusTone(
  status: StickerDesignStatus,
): "neutral" | "success" | "warning" {
  if (status === "APPROVED") {
    return "success";
  }

  if (status === "ARCHIVED") {
    return "neutral";
  }

  return "warning";
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

function WizardStep({
  description,
  index,
  title,
}: {
  description: string;
  index: number;
  title: string;
}) {
  return (
    <article className="admin-qr-wizard-step">
      <span>{String(index).padStart(2, "0")}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </article>
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
        <StatusPill tone="warning">{copy.sampleReady}</StatusPill>
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
        <StatusPill tone={getQrBatchStatusTone(batch.status)}>
          {copy.batchStatusLabels[batch.status]}
        </StatusPill>
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
      {batch.sample ? (
        <div className="admin-qr-preview-grid">
          <figure className="admin-qr-preview admin-qr-preview--desktop">
            <figcaption>{copy.samplePreviewDesktop}</figcaption>
            <Image
              alt={`${batch.siteName} · ${copy.samplePreviewAlt}`}
              height={300}
              loading="lazy"
              src={`/api/admin/qr-samples/${batch.sample.id}`}
              unoptimized
              width={300}
            />
          </figure>
          <figure className="admin-qr-preview admin-qr-preview--mobile">
            <figcaption>{copy.samplePreviewMobile}</figcaption>
            <Image
              alt={`${batch.siteName} · ${copy.samplePreviewAlt}`}
              height={300}
              loading="lazy"
              src={`/api/admin/qr-samples/${batch.sample.id}`}
              unoptimized
              width={300}
            />
          </figure>
        </div>
      ) : null}
      <div className="admin-approval-form">
        <p className="admin-catalog-read-only">{waiting}</p>
      </div>
      {canAttach ? (
        <details className="admin-rejection-panel">
          <summary>{copy.sampleAttach}</summary>
          <form action={generateQrBatchSample} className="admin-rejection-form">
            <BatchFields batch={batch} copy={copy} locale={locale} />
            <input
              aria-label={copy.templateCode}
              name="templateCode"
              type="hidden"
              value={batch.templateCode}
            />
            <p className="admin-catalog-read-only">{copy.sampleAttachDescription}</p>
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
        <StatusPill tone={getQrBatchStatusTone(batch.status)}>
          {copy.batchStatusLabels[batch.status]}
        </StatusPill>
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
  canApproveDesign,
  canApproveFinalGeneration,
  canArchiveDesign,
  canCreateDesign,
  canOperateSample,
  canRequestBatch,
  copy,
  errorMessage,
  finalApprovalModel,
  brandAssetUpload,
  locale,
  model,
  statusMessage,
  workflowCopy,
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

      <section className="admin-compact-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{workflowCopy.title}</h1>
          <p>{workflowCopy.description}</p>
        </div>
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

      <section
        className="admin-qr-wizard admin-qr-wizard--workflow"
        aria-labelledby="qr-wizard-title"
      >
        <div className="admin-qr-wizard__copy">
          <p className="eyebrow">{copy.wizardTemplate}</p>
          <h2 id="qr-wizard-title">{workflowCopy.title}</h2>
          <p>{workflowCopy.description}</p>
          <div className="admin-qr-wizard__steps">
            {workflowCopy.steps.map((step, index) => (
              <WizardStep
                description={step.description}
                index={index + 1}
                key={step.title}
                title={step.title}
              />
            ))}
          </div>
        </div>
      </section>

      {brandAssetUpload ? (
        <section className="admin-qr-wizard-panel" aria-labelledby="qr-brand-title">
          <div>
            <p className="eyebrow">{copy.wizardBrand}</p>
            <h2 id="qr-brand-title">{copy.wizardBrandDescription}</h2>
          </div>
          {brandAssetUpload}
        </section>
      ) : null}

      {canCreateDesign ? (
        <details className="admin-tenant-create admin-qr-wizard-panel">
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
                <fieldset className="admin-template-options">
                  <legend>{workflowCopy.templateLegend}</legend>
                  {STICKER_TEMPLATE_CODES.map((templateCode, index) => (
                    <label className="admin-template-option" key={templateCode}>
                      <input
                        aria-label={workflowCopy.templateLabels[templateCode]}
                        defaultChecked={index === 0}
                        name="templateCode"
                        required
                        type="radio"
                        value={templateCode}
                      />
                      <span className="admin-template-option__preview">
                        {/* biome-ignore lint/performance/noImgElement: protected route returns a generated production renderer preview */}
                        <img
                          alt={`${workflowCopy.templateLabels[templateCode]} · ${workflowCopy.previewAlt}`}
                          src={`/api/admin/qr-preview?template=${templateCode}`}
                        />
                      </span>
                      <strong>{workflowCopy.templateLabels[templateCode]}</strong>
                      <small>{workflowCopy.templateDescriptions[templateCode]}</small>
                    </label>
                  ))}
                </fieldset>
                <label className="admin-field" htmlFor="design-brand-asset">
                  <span>{copy.designLogo}</span>
                  <select id="design-brand-asset" name="brandAssetId">
                    <option value="">{copy.designLogoNone}</option>
                    {model.brandAssetOptions.map((asset) => (
                      <option
                        key={asset.id}
                        value={`${asset.tenantId}|${asset.managementCompanyId}|${asset.siteId}|${asset.id}`}
                      >
                        {asset.name} · {asset.mimeType}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="admin-catalog-read-only">{copy.designConfig}</p>
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
                    <StatusPill tone="warning">{copy.waitingDesign}</StatusPill>
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
                  <StatusPill tone={getStickerDesignStatusTone(design.status)}>
                    {copy.designStatusLabels[design.status]}
                  </StatusPill>
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
        <section
          aria-labelledby="batch-request-title"
          className="admin-lifecycle-queue admin-qr-wizard-panel"
        >
          <header>
            <h2 id="batch-request-title">{copy.batchRequestTitle}</h2>
            <p>{copy.batchRequestDescription}</p>
            <p className="admin-catalog-read-only">{copy.batchSplitNotice}</p>
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
                        <QrQuantityControl
                          label={copy.batchQuantity}
                          maxLabel={copy.wizardQuantityHint}
                        />
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
