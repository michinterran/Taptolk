import { QrOperationsReadModelService } from "@taptolk/application";
import { PageHeader } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { createSupabaseQrOperationsReadModelRepository } from "../../../../../admin/supabase-qr-operations-read-model-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { QrOperationsView } from "../../../../../components/qr-operations-view";
import { ADMIN_QR_OPERATIONS_COPY } from "../../../../../content/admin-qr-operations-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readQuantity(value: string | string[] | undefined): number {
  const candidate = Number(readValue(value));
  return Number.isInteger(candidate) && candidate > 0 ? candidate : 100;
}

function readPositiveInteger(value: string | string[] | undefined, fallback: number): number {
  const candidate = Number(readValue(value));
  return Number.isInteger(candidate) && candidate > 0 ? candidate : fallback;
}

function isQrOperationsUnavailable(error: unknown): boolean {
  return error instanceof Error && error.message === "QR_OPERATIONS_UNAVAILABLE";
}

export default async function QrInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    company?: string | string[];
    batches?: string | string[];
    confirmed?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
    request?: string | string[];
    error?: string | string[];
    quantity?: string | string[];
    site?: string | string[];
    status?: string | string[];
  }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  const membership = context.decision.membership;
  const authorization = toAdminAuthorizationContext(membership, context.mfaLevel === "aal2");
  const actor = { authorization, userId: context.userId };
  const copy = getMessages(locale);
  let operationsModel: Awaited<ReturnType<QrOperationsReadModelService["read"]>>;
  try {
    operationsModel = await new QrOperationsReadModelService(
      createSupabaseQrOperationsReadModelRepository(client),
    ).read({
      actor,
    });
  } catch (error) {
    if (!isQrOperationsUnavailable(error)) {
      throw error;
    }
    const qrCopy = ADMIN_QR_OPERATIONS_COPY[locale];
    return (
      <main className="admin-dashboard-shell">
        <AdminPageHeader
          locale={locale}
          localeLabels={{
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          }}
          localeTitle={copy["locale.switcher.label"]}
          logoAlt={copy["admin.brand.logoAlt"]}
          pathname={`/${locale}/admin/qr-inventory`}
        />
        <div className="operations-shell admin-report-shell">
          <PageHeader
            description={qrCopy.description}
            eyebrow={qrCopy.eyebrow}
            lines={[qrCopy.title]}
          />
          <section
            aria-labelledby="admin-qr-operations-unavailable-title"
            className="admin-data-unavailable"
            role="status"
          >
            <h2 id="admin-qr-operations-unavailable-title">{copy["admin.qr.error.unavailable"]}</h2>
            <p>{copy["shared.error.description"]}</p>
            <a className="tt-button tt-button--secondary" href={`/${locale}/admin/qr-inventory`}>
              {copy["shared.error.retry"]}
            </a>
          </section>
        </div>
      </main>
    );
  }
  const errorMessages: Readonly<Record<string, string>> = {
    blocked: copy["admin.qr.error.blocked"],
    conflict: copy["admin.qr.error.conflict"],
    forbidden: copy["admin.qr.error.forbidden"],
    unavailable: copy["admin.qr.error.unavailable"],
    validation: copy["admin.qr.error.validation"],
  };
  const statusMessages: Readonly<Record<string, string>> = {
    batchCancelled: copy["admin.qr.status.batchCancelled"],
    batchRequested: copy["admin.qr.status.batchRequested"],
    designApproved: copy["admin.qr.status.designApproved"],
    designArchived: copy["admin.qr.status.designArchived"],
    designCreated: copy["admin.qr.status.designCreated"],
    finalApprovalCancelled: copy["admin.qr.status.finalApprovalCancelled"],
    finalApprovalRequested: copy["admin.qr.status.finalApprovalRequested"],
    finalGenerationApproved: copy["admin.qr.status.finalGenerationApproved"],
    sampleApproved: copy["admin.qr.status.sampleApproved"],
    sampleAttached: copy["admin.qr.status.sampleAttached"],
    sampleGenerated: copy["admin.qr.status.sampleGenerated"],
    sampleInvalidated: copy["admin.qr.status.sampleInvalidated"],
    assetAssigned: copy["admin.qr.status.assetAssigned"],
    assetReplaced: copy["admin.qr.status.assetReplaced"],
    assetRevoked: copy["admin.qr.status.assetRevoked"],
    batchReceived: copy["admin.qr.status.batchReceived"],
    brandAssetUploaded: copy["admin.qr.status.brandAssetUploaded"],
    importCommitted: copy["admin.qr.status.importCommitted"],
    importValidated: copy["admin.qr.status.importValidated"],
  };
  const error = readValue(query.error);
  const status = readValue(query.status);
  const selectedCompanyId = readValue(query.company);
  const selectedSiteId = readValue(query.site);
  const selectedQuantity = readQuantity(query.quantity);
  const batchPage = readPositiveInteger(query.page, 1);
  const batchPageSize = readPositiveInteger(query.pageSize, 10);
  const activeRequestId = readValue(query.request);
  const activeBatchIds =
    readValue(query.batches)
      ?.split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? [];
  const confirmed = readValue(query.confirmed) === "1";
  return (
    <main className="admin-dashboard-shell">
      <QrOperationsView
        confirmed={confirmed}
        copy={ADMIN_QR_OPERATIONS_COPY[locale]}
        errorMessage={error ? errorMessages[error] : undefined}
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        operationsModel={operationsModel}
        activeBatchIds={activeBatchIds}
        activeRequestId={activeRequestId}
        batchPage={batchPage}
        batchPageSize={batchPageSize}
        selectedCompanyId={selectedCompanyId}
        selectedQuantity={selectedQuantity}
        selectedSiteId={selectedSiteId}
        statusMessage={status ? statusMessages[status] : undefined}
      />
    </main>
  );
}
