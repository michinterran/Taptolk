import { QrOperationsReadModelService } from "@taptolk/application";
import { PageHeader } from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseQrOperationsReadModelRepository } from "../../../../../../admin/supabase-qr-operations-read-model-repository";
import { toAdminAuthorizationContext } from "../../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../auth/server-client";
import { AdminPageHeader } from "../../../../../../components/admin-page-header";
import { QrOperationsView } from "../../../../../../components/qr-operations-view";
import { ADMIN_QR_OPERATIONS_COPY } from "../../../../../../content/admin-qr-operations-copy";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

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

function readBatchView(value: string | string[] | undefined): "current" | "all" {
  return readValue(value) === "all" ? "all" : "current";
}

function readBatchSort(
  value: string | string[] | undefined,
): "recent" | "oldest" | "progress" | "status" {
  const candidate = readValue(value);
  return candidate === "oldest" || candidate === "progress" || candidate === "status"
    ? candidate
    : "recent";
}

function isQrOperationsUnavailable(error: unknown): boolean {
  return error instanceof Error && error.message === "QR_OPERATIONS_UNAVAILABLE";
}

export default async function QrOperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    company?: string | string[];
    batches?: string | string[];
    batchSort?: string | string[];
    batchView?: string | string[];
    confirmed?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
    sitePage?: string | string[];
    sitePageSize?: string | string[];
    request?: string | string[];
    error?: string | string[];
    quantity?: string | string[];
    site?: string | string[];
    status?: string | string[];
  }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();

  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  const membership = context.decision.membership;
  const actor = {
    authorization: toAdminAuthorizationContext(membership, context.mfaLevel === "aal2"),
    userId: context.userId,
  };
  const copy = getMessages(locale);
  let operationsModel: Awaited<ReturnType<QrOperationsReadModelService["read"]>>;
  try {
    operationsModel = await new QrOperationsReadModelService(
      createSupabaseQrOperationsReadModelRepository(client),
    ).read({ actor });
  } catch (error) {
    if (!isQrOperationsUnavailable(error)) throw error;
    const qrCopy = ADMIN_QR_OPERATIONS_COPY[locale];
    return (
      <main className="admin-dashboard-shell">
        <AdminPageHeader
          locale={locale}
          localeLabels={{ en: copy["locale.english"], ko: copy["locale.korean"] }}
          localeTitle={copy["locale.switcher.label"]}
          logoAlt={copy["admin.brand.logoAlt"]}
          pathname={`/${locale}/admin/qr-inventory/operations`}
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
            <Link
              className="tt-button tt-button--secondary"
              href={`/${locale}/admin/qr-inventory/operations` as Route}
            >
              {copy["shared.error.retry"]}
            </Link>
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
    batchRequested: copy["admin.qr.status.batchRequested"],
    qrOnlyGenerationStarted: copy["admin.qr.only.approval.requested"],
  };
  const error = readValue(query.error);
  const status = readValue(query.status);
  const activeBatchIds =
    readValue(query.batches)
      ?.split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? [];

  return (
    <main className="admin-dashboard-shell">
      <QrOperationsView
        activeBatchIds={activeBatchIds}
        activeRequestId={readValue(query.request)}
        batchPage={readPositiveInteger(query.page, 1)}
        batchPageSize={readPositiveInteger(query.pageSize, 10)}
        batchSort={readBatchSort(query.batchSort)}
        batchView={readBatchView(query.batchView)}
        confirmed={readValue(query.confirmed) === "1"}
        copy={ADMIN_QR_OPERATIONS_COPY[locale]}
        directGenerationEnabled
        errorMessage={error ? errorMessages[error] : undefined}
        locale={locale}
        localeLabels={{ en: copy["locale.english"], ko: copy["locale.korean"] }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        operationsModel={operationsModel}
        selectedCompanyId={readValue(query.company)}
        selectedQuantity={readQuantity(query.quantity)}
        selectedSiteId={readValue(query.site)}
        sitePage={readPositiveInteger(query.sitePage, 1)}
        sitePageSize={readPositiveInteger(query.sitePageSize, 10)}
        statusMessage={status ? statusMessages[status] : undefined}
      />
    </main>
  );
}
