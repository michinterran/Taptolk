import {
  QrOperationsReadModelService,
  SITE_CONTRACT_VEHICLE_LIMIT_MAX,
  SiteLifecycleRequestService,
  SiteWorkspaceService,
} from "@taptolk/application";
import { roleHasPermission } from "@taptolk/domain";
import { PageHeader } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { summarizeQrOperationsScope } from "../../../../../../admin/qr-operations-scope-summary";
import { createSupabaseQrOperationsReadModelRepository } from "../../../../../../admin/supabase-qr-operations-read-model-repository";
import { createSupabaseSiteLifecycleRequestRepository } from "../../../../../../admin/supabase-site-lifecycle-request-repository";
import { createSupabaseSiteWorkspaceRepository } from "../../../../../../admin/supabase-site-workspace-repository";
import { toAdminAuthorizationContext } from "../../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../auth/server-client";
import { AdminPageHeader } from "../../../../../../components/admin-page-header";
import { SiteWorkspaceView } from "../../../../../../components/site-workspace-view";
import { ADMIN_SITE_WORKSPACE_COPY } from "../../../../../../content/admin-site-workspace-copy";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

function isSiteWorkspaceUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message === "SITE_WORKSPACE_UNAVAILABLE" ||
    error.message === "QR_OPERATIONS_UNAVAILABLE" ||
    error.message === "Site lifecycle request repository failed: UNAVAILABLE"
  );
}

export default async function SiteWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; siteId: string }>;
  searchParams: Promise<{
    error?: string | string[];
    status?: string | string[];
  }>;
}) {
  const [{ locale, siteId }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();
  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  const authorization = toAdminAuthorizationContext(
    context.decision.membership,
    context.mfaLevel === "aal2",
  );
  let model: Awaited<ReturnType<SiteWorkspaceService["read"]>>;
  let qrOperationsModel: Awaited<ReturnType<QrOperationsReadModelService["read"]>>;
  let lifecycleRequests: Awaited<ReturnType<SiteLifecycleRequestService["list"]>>;
  try {
    [model, qrOperationsModel, lifecycleRequests] = await Promise.all([
      new SiteWorkspaceService(createSupabaseSiteWorkspaceRepository(client)).read({
        actor: authorization,
        siteId,
      }),
      new QrOperationsReadModelService(createSupabaseQrOperationsReadModelRepository(client)).read({
        actor: {
          authorization,
          userId: context.userId,
        },
      }),
      new SiteLifecycleRequestService(createSupabaseSiteLifecycleRequestRepository(client)).list({
        actor: {
          authorization,
          userId: context.userId,
        },
      }),
    ]);
  } catch (error) {
    if (!isSiteWorkspaceUnavailable(error)) {
      throw error;
    }
    const messages = getMessages(locale);
    const copy = ADMIN_SITE_WORKSPACE_COPY[locale];
    return (
      <main className="admin-dashboard-shell">
        <AdminPageHeader
          locale={locale}
          localeLabels={{
            en: messages["locale.english"],
            ko: messages["locale.korean"],
          }}
          localeTitle={messages["locale.switcher.label"]}
          logoAlt={messages["admin.brand.logoAlt"]}
          pathname={`/${locale}/admin/sites/${siteId}`}
        />
        <div className="admin-workspace-canvas">
          <a className="admin-inline-back" href={`/${locale}/admin/sites`}>
            {copy.allLocations}
          </a>
          <PageHeader
            className="admin-compact-heading admin-compact-heading--workspace"
            description={copy.workspaceDescription}
            eyebrow={copy.locationWorkspace}
            lines={[copy.locationWorkspace]}
          />
          <section
            aria-labelledby="admin-site-workspace-unavailable-title"
            className="admin-data-unavailable"
            role="status"
          >
            <h2 id="admin-site-workspace-unavailable-title">
              {messages["admin.sites.error.unavailable"]}
            </h2>
            <p>{messages["shared.error.description"]}</p>
            <a className="tt-button tt-button--secondary" href={`/${locale}/admin/sites/${siteId}`}>
              {messages["shared.error.retry"]}
            </a>
          </section>
        </div>
      </main>
    );
  }
  if (!model) notFound();
  const messages = getMessages(locale);
  const errorMessages: Readonly<Record<string, string>> = {
    blocked: messages["admin.sites.error.blocked"],
    conflict: messages["admin.sites.error.conflict"],
    forbidden: messages["admin.sites.error.forbidden"],
    unavailable: messages["admin.sites.error.unavailable"],
    validation: messages["admin.sites.error.validation"],
  };
  const statusMessages: Readonly<Record<string, string>> = {
    contractUpdated: messages["admin.sites.status.contractUpdated"],
    operationalUpdated: messages["admin.sites.status.operationalUpdated"],
    requestCancelled: messages["admin.sites.lifecycle.status.cancelled"],
    requestCreated: messages["admin.sites.lifecycle.status.created"],
    statusChanged: messages["admin.sites.status.statusChanged"],
    batchReceiptRecorded: messages["admin.qr.status.batchReceiptRecorded"],
  };
  const readQueryValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return (
    <main className="admin-dashboard-shell">
      <SiteWorkspaceView
        addressSearch={{
          detailLabel: messages["admin.sites.address.detail"],
          detailPlaceholder: messages["admin.sites.address.detail.placeholder"],
          help: messages["admin.sites.address.help"],
          labels: {
            close: messages["admin.sites.address.search.close"],
            fallbackHint: messages["admin.sites.address.search.fallback"],
            jibunAddress: messages["admin.sites.address.search.jibun"],
            open: messages["admin.sites.address.search.open"],
            roadAddress: messages["admin.sites.address.search.road"],
            title: messages["admin.sites.address.search.title"],
            zonecode: messages["admin.sites.address.search.zonecode"],
          },
        }}
        batchStatusLabels={{
          CANCELLED: messages["admin.qr.batch.status.cancelled"],
          COMPLETED: messages["admin.qr.batch.status.completed"],
          DELIVERED: messages["admin.qr.batch.status.delivered"],
          PARTIALLY_RECEIVED: messages["admin.qr.batch.status.partiallyReceived"],
          DISTRIBUTING: messages["admin.qr.batch.status.distributing"],
          DRAFT: messages["admin.qr.batch.status.draft"],
          FAILED: messages["admin.qr.batch.status.failed"],
          FINAL_APPROVAL_PENDING: messages["admin.qr.batch.status.finalApprovalPending"],
          GENERATED: messages["admin.qr.batch.status.generated"],
          GENERATING: messages["admin.qr.batch.status.generating"],
          GENERATION_APPROVED: messages["admin.qr.batch.status.generationApproved"],
          GENERATION_QUEUED: messages["admin.qr.batch.status.generationQueued"],
          PARTIALLY_COMPLETED: messages["admin.qr.batch.status.partiallyCompleted"],
          PRINTED: messages["admin.qr.batch.status.printed"],
          PRINT_FILE_READY: messages["admin.qr.batch.status.printFileReady"],
          QUALITY_CHECKED: messages["admin.qr.batch.status.qualityChecked"],
          SAMPLE_APPROVED: messages["admin.qr.batch.status.sampleApproved"],
          SAMPLE_READY: messages["admin.qr.batch.status.sampleReady"],
          SAMPLE_RENDERING: messages["admin.qr.batch.status.sampleRendering"],
          SENT_TO_PRINTER: messages["admin.qr.batch.status.sentToPrinter"],
          SHIPPED: messages["admin.qr.batch.status.shipped"],
        }}
        canChangeStatus={roleHasPermission(
          context.decision.membership.role,
          "site:suspend-approve",
        )}
        canClose={roleHasPermission(context.decision.membership.role, "site:archive-approve")}
        canRequestClose={
          !roleHasPermission(context.decision.membership.role, "site:archive-approve") &&
          roleHasPermission(context.decision.membership.role, "site:archive-request")
        }
        canRequestStatus={
          !roleHasPermission(context.decision.membership.role, "site:suspend-approve") &&
          roleHasPermission(context.decision.membership.role, "site:suspend-request")
        }
        canReceiveBatch={roleHasPermission(context.decision.membership.role, "qr-asset:assign")}
        canUpdateContract={roleHasPermission(
          context.decision.membership.role,
          "site:update-contract",
        )}
        canUpdateOperational={roleHasPermission(
          context.decision.membership.role,
          "site:update-operational",
        )}
        contractVehicleLimitMax={SITE_CONTRACT_VEHICLE_LIMIT_MAX}
        copy={ADMIN_SITE_WORKSPACE_COPY[locale]}
        errorMessage={
          readQueryValue(query.error) ? errorMessages[readQueryValue(query.error) ?? ""] : undefined
        }
        lifecycleRequests={lifecycleRequests}
        locale={locale}
        localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
        localeTitle={messages["locale.switcher.label"]}
        logoAlt={messages["admin.brand.logoAlt"]}
        model={model}
        qrOperations={summarizeQrOperationsScope(qrOperationsModel, { siteId })}
        siteTypeLabels={{
          APARTMENT: messages["admin.sites.type.apartment"],
          BUILDING: messages["admin.sites.type.building"],
          OFFICETEL: messages["admin.sites.type.officetel"],
          OTHER: messages["admin.sites.type.other"],
        }}
        statusLabels={{
          ACTIVE: messages["admin.sites.status.active"],
          CLOSED: messages["admin.sites.status.closed"],
          SUSPENDED: messages["admin.sites.status.suspended"],
        }}
        statusMessage={
          readQueryValue(query.status)
            ? statusMessages[readQueryValue(query.status) ?? ""]
            : undefined
        }
      />
    </main>
  );
}
