import { QrInventoryAssignmentService, QrOperationsReadModelService } from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { roleHasPermission } from "@taptolk/domain";
import { PageHeader } from "@taptolk/ui";
import { notFound, redirect } from "next/navigation";
import { createSupabaseQrInventoryAssignmentRepository } from "../../../../../../../admin/supabase-qr-inventory-assignment-repository";
import { createSupabaseQrOperationsReadModelRepository } from "../../../../../../../admin/supabase-qr-operations-read-model-repository";
import { AesGcmVehiclePlateProtector } from "../../../../../../../admin/vehicle-plate-protector";
import { toAdminAuthorizationContext } from "../../../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../../auth/server-client";
import { AdminPageHeader } from "../../../../../../../components/admin-page-header";
import type { InventoryAssignmentCopy } from "../../../../../../../components/qr-inventory-assignment-view";
import { QrSiteOperationsView } from "../../../../../../../components/qr-site-operations-view";
import { ADMIN_QR_SITE_OPERATIONS_COPY } from "../../../../../../../content/admin-qr-site-operations-copy";
import { getMessages } from "../../../../../../../content/messages";
import { isAppLocale } from "../../../../../../../i18n/locale";

function isUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "QR_OPERATIONS_UNAVAILABLE" ||
      error.message.includes("QR inventory assignment repository failed: UNAVAILABLE"))
  );
}

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function assignmentCopy(messages: Readonly<Record<string, string>>) {
  return {
    assign: messages["admin.qr.inventory.assign"],
    assignDescription: messages["admin.qr.inventory.assign.description"],
    assignTitle: messages["admin.qr.inventory.assign.title"],
    batchReceive: messages["admin.qr.inventory.batch.receive"],
    batchReceiveDescription: messages["admin.qr.inventory.batch.receive.description"],
    batchReceiveTitle: messages["admin.qr.inventory.batch.receive.title"],
    batchStatusLabels: {
      CANCELLED: messages["admin.qr.batch.status.cancelled"],
      COMPLETED: messages["admin.qr.batch.status.completed"],
      DELIVERED: messages["admin.qr.batch.status.delivered"],
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
    },
    commit: messages["admin.qr.inventory.commit"],
    csvFile: messages["admin.qr.inventory.csvFile"],
    empty: messages["admin.qr.inventory.empty"],
    humanCode: messages["admin.qr.inventory.humanCode"],
    importDescription: messages["admin.qr.inventory.import.description"],
    importTitle: messages["admin.qr.inventory.import.title"],
    originalDeleted: messages["admin.qr.inventory.originalDeleted"],
    reason: messages["admin.qr.reason"],
    reasonPlaceholder: messages["admin.qr.reason.placeholder"],
    replace: messages["admin.qr.inventory.replace"],
    replacement: messages["admin.qr.inventory.replacement"],
    revoke: messages["admin.qr.inventory.revoke"],
    securityNote: messages["admin.qr.inventory.securityNote"],
    site: messages["admin.qr.site"],
    status: messages["admin.qr.inventory.status"],
    statusLabels: {
      ACTIVATION_PENDING: messages["admin.qr.asset.status.activationPending"],
      ACTIVE: messages["admin.qr.asset.status.active"],
      ASSIGNED: messages["admin.qr.asset.status.assigned"],
      DAMAGED: messages["admin.qr.asset.status.damaged"],
      EXPIRED: messages["admin.qr.asset.status.expired"],
      GENERATED: messages["admin.qr.asset.status.generated"],
      IN_STOCK: messages["admin.qr.asset.status.inStock"],
      LOST: messages["admin.qr.asset.status.lost"],
      PRINTED: messages["admin.qr.asset.status.printed"],
      PRINT_READY: messages["admin.qr.asset.status.printReady"],
      REPLACED: messages["admin.qr.asset.status.replaced"],
      REVOKED: messages["admin.qr.asset.status.revoked"],
      SUSPENDED: messages["admin.qr.asset.status.suspended"],
    },
    vehicleLast4: messages["admin.qr.inventory.vehicleLast4"],
    vehiclePlate: messages["admin.qr.inventory.vehiclePlate"],
  };
}

function configuredProtector() {
  const environment = parseServerEnvironment();
  if (!environment.APP_ENCRYPTION_KEY_V1 || !environment.TOKEN_HMAC_KEY) {
    return {
      protect: async () => Promise.reject(new Error("VEHICLE_PLATE_PROTECTION_CONFIG_MISSING")),
    };
  }
  return new AesGcmVehiclePlateProtector(
    environment.APP_ENCRYPTION_KEY_V1,
    environment.TOKEN_HMAC_KEY,
  );
}

export default async function QrSiteOperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; siteId: string }>;
  searchParams: Promise<{ error?: string | string[]; status?: string | string[] }>;
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
  const actor = { authorization, userId: context.userId };
  const messages = getMessages(locale);
  try {
    const [operations, inventory] = await Promise.all([
      new QrOperationsReadModelService(createSupabaseQrOperationsReadModelRepository(client)).read({
        actor,
      }),
      new QrInventoryAssignmentService(
        createSupabaseQrInventoryAssignmentRepository(client),
        configuredProtector(),
      ).list({ actor }),
    ]);
    const site = operations.sites.find((item) => item.id === siteId);
    if (!site) notFound();
    const batches = operations.batches.filter((batch) => batch.siteId === site.id);
    const model = {
      assets: inventory.assets.filter((asset) => asset.siteId === site.id),
      batches: inventory.batches.filter((batch) => batch.siteId === site.id),
      imports: inventory.imports.filter((item) => item.siteId === site.id),
    };
    const error = readValue(query.error);
    const status = readValue(query.status);
    const errorMessages: Readonly<Record<string, string>> = {
      blocked: messages["admin.qr.error.blocked"],
      conflict: messages["admin.qr.error.conflict"],
      forbidden: messages["admin.qr.error.forbidden"],
      unavailable: messages["admin.qr.error.unavailable"],
      validation: messages["admin.qr.error.validation"],
    };
    const statusMessages: Readonly<Record<string, string>> = {
      assetAssigned: messages["admin.qr.status.assetAssigned"],
      assetReplaced: messages["admin.qr.status.assetReplaced"],
      assetRevoked: messages["admin.qr.status.assetRevoked"],
      batchReceived: messages["admin.qr.status.batchReceived"],
      batchDeliveryAdvanced: ADMIN_QR_SITE_OPERATIONS_COPY[locale].deliveryAdvancedStatus,
      batchReceiptRecorded: messages["admin.qr.status.batchReceiptRecorded"],
      importCommitted: messages["admin.qr.status.importCommitted"],
      importValidated: messages["admin.qr.status.importValidated"],
    };
    return (
      <main className="admin-dashboard-shell">
        <QrSiteOperationsView
          assignmentCopy={
            assignmentCopy(messages as Readonly<Record<string, string>>) as InventoryAssignmentCopy
          }
          canAdvanceDelivery={roleHasPermission(
            context.decision.membership.role,
            "qr-batch:delivery-advance",
          )}
          canAssign={roleHasPermission(context.decision.membership.role, "qr-asset:assign")}
          canRevoke={roleHasPermission(context.decision.membership.role, "qr-asset:revoke")}
          copy={ADMIN_QR_SITE_OPERATIONS_COPY[locale]}
          errorMessage={error ? errorMessages[error] : undefined}
          locale={locale}
          localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
          localeTitle={messages["locale.switcher.label"]}
          logoAlt={messages["admin.brand.logoAlt"]}
          model={model}
          site={site}
          batches={batches}
          statusMessage={status ? statusMessages[status] : undefined}
        />
      </main>
    );
  } catch (error) {
    if (!isUnavailable(error)) throw error;
    return (
      <main className="admin-dashboard-shell">
        <AdminPageHeader
          locale={locale}
          localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
          localeTitle={messages["locale.switcher.label"]}
          logoAlt={messages["admin.brand.logoAlt"]}
          pathname={`/${locale}/admin/qr-inventory/sites/${siteId}`}
        />
        <div className="admin-workspace-canvas">
          <PageHeader
            description={ADMIN_QR_SITE_OPERATIONS_COPY[locale].description}
            eyebrow={ADMIN_QR_SITE_OPERATIONS_COPY[locale].eyebrow}
            lines={[ADMIN_QR_SITE_OPERATIONS_COPY[locale].title]}
          />
          <section className="admin-data-unavailable" role="status">
            <h2>{messages["admin.qr.error.unavailable"]}</h2>
            <p>{messages["shared.error.description"]}</p>
            <a
              className="tt-button tt-button--secondary"
              href={`/${locale}/admin/qr-inventory/sites/${siteId}`}
            >
              {messages["shared.error.retry"]}
            </a>
          </section>
        </div>
      </main>
    );
  }
}
