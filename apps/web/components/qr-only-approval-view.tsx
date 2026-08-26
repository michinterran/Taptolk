import type {
  QrFinalApprovalBatchItem,
  QrFinalGenerationApprovalReadModel,
} from "@taptolk/application";
import { PageHeader, StatusPill } from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import type { AppLocale } from "../i18n/config";
import { AdminPageHeader } from "./admin-page-header";
import { QrOnlyApprovalForm } from "./qr-only-approval-form";

interface QrOnlyApprovalViewProps {
  errorMessage?: string | undefined;
  locale: AppLocale;
  localeLabels: Readonly<Record<AppLocale, string>>;
  localeTitle: string;
  logoAlt: string;
  model: QrFinalGenerationApprovalReadModel;
  statusMessage?: string | undefined;
  copy: {
    approve: string;
    description: string;
    empty: string;
    eyebrow: string;
    pending: string;
    pendingAction: string;
    requestedByYou: string;
    reason: string;
    reasonDefault: string;
    reasonPlaceholder: string;
    title: string;
    status: string;
    back: string;
  };
}

function statusTone(batch: QrFinalApprovalBatchItem): "info" | "warning" {
  return batch.requestedByCurrentActor ? "warning" : "info";
}

export function QrOnlyApprovalView({
  copy,
  errorMessage,
  locale,
  localeLabels,
  localeTitle,
  logoAlt,
  model,
  statusMessage,
}: QrOnlyApprovalViewProps) {
  const number = new Intl.NumberFormat(locale);
  const pending = model.batches.filter((batch) => batch.status === "FINAL_APPROVAL_PENDING");
  const approvable = new Set(model.finalApprovalQueue.map((batch) => batch.id));

  return (
    <>
      <AdminPageHeader
        locale={locale}
        localeLabels={localeLabels}
        localeTitle={localeTitle}
        logoAlt={logoAlt}
        pathname={`/${locale}/admin/qr-inventory/approval`}
      />
      <div className="admin-catalog-canvas console-page">
        <PageHeader
          className="admin-compact-heading"
          description={copy.description}
          eyebrow={copy.eyebrow}
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

        <div className="admin-catalog-toolbar">
          <strong>{copy.pending}</strong>
          <span>{number.format(pending.length)}</span>
          <Link
            className="tt-button tt-button--secondary"
            href={`/${locale}/admin/qr-inventory/operations` as Route}
          >
            {copy.back}
          </Link>
        </div>

        {pending.length > 0 ? (
          <div className="admin-catalog-grid">
            {pending.map((batch) => {
              const canApprove = approvable.has(batch.id);
              return (
                <article className="admin-catalog-card" key={batch.id}>
                  <header className="admin-catalog-card__header">
                    <div>
                      <span className="admin-hierarchy-label">{batch.siteName}</span>
                      <h2>{batch.batchCode}</h2>
                    </div>
                    <StatusPill tone={statusTone(batch)}>
                      {batch.requestedByCurrentActor ? copy.requestedByYou : copy.status}
                    </StatusPill>
                  </header>
                  <dl className="admin-definition-list">
                    <div>
                      <dt>{copy.pending}</dt>
                      <dd>{number.format(batch.requestedQuantity)}</dd>
                    </div>
                    <div>
                      <dt>{copy.status}</dt>
                      <dd>{batch.siteName}</dd>
                    </div>
                  </dl>
                  {canApprove ? (
                    <QrOnlyApprovalForm
                      approve={copy.approve}
                      batch={batch}
                      locale={locale}
                      pendingLabel={copy.pendingAction}
                      reason={copy.reason}
                      reasonPlaceholder={copy.reasonDefault}
                      title={copy.title}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="admin-catalog-read-only">{copy.empty}</p>
        )}
      </div>
    </>
  );
}
