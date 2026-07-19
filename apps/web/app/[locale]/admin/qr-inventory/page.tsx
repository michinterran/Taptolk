import { QrFinalGenerationApprovalService, QrInventorySampleService } from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { roleHasPermission } from "@taptolk/domain";
import { notFound, redirect } from "next/navigation";
import { createSupabaseQrFinalGenerationApprovalRepository } from "../../../../admin/supabase-qr-final-generation-approval-repository";
import { createSupabaseQrInventorySampleRepository } from "../../../../admin/supabase-qr-inventory-sample-repository";
import { toAdminAuthorizationContext } from "../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../auth/server-client";
import { QrInventorySampleView } from "../../../../components/qr-inventory-sample-view";
import { getMessages } from "../../../../content/messages";
import { isAppLocale } from "../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QrInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string | string[];
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
  const [model, finalApprovalModel] = await Promise.all([
    new QrInventorySampleService(createSupabaseQrInventorySampleRepository(client)).list({
      actor,
    }),
    new QrFinalGenerationApprovalService(
      createSupabaseQrFinalGenerationApprovalRepository(client),
    ).list({ actor }),
  ]);
  const copy = getMessages(locale);
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
    sampleInvalidated: copy["admin.qr.status.sampleInvalidated"],
  };
  const error = readValue(query.error);
  const status = readValue(query.status);
  const isPlatform = getAdminLandingArea(membership.role) === "platform";

  return (
    <main className="admin-dashboard-shell">
      <QrInventorySampleView
        backHref={getLocalizedAdminPath(locale, isPlatform ? "/platform" : "/dashboard")}
        canApproveDesign={roleHasPermission(membership.role, "sticker-design:approve")}
        canArchiveDesign={roleHasPermission(membership.role, "sticker-design:archive")}
        canCreateDesign={roleHasPermission(membership.role, "sticker-design:create")}
        canApproveFinalGeneration={roleHasPermission(
          membership.role,
          "qr-batch:generation-approve",
        )}
        canOperateSample={roleHasPermission(membership.role, "qr-batch:sample-approve")}
        canRequestBatch={roleHasPermission(membership.role, "qr-batch:request")}
        copy={{
          actions: copy["admin.qr.actions"],
          approve: copy["admin.qr.approve"],
          archive: copy["admin.qr.archive"],
          artifact: copy["admin.qr.artifact"],
          back: copy["admin.qr.back"],
          batchCancel: copy["admin.qr.batch.cancel"],
          batchCode: copy["admin.qr.batch.code"],
          batchEmpty: copy["admin.qr.batch.empty"],
          batchPurpose: copy["admin.qr.batch.purpose"],
          batchQuantity: copy["admin.qr.batch.quantity"],
          batchRequest: copy["admin.qr.batch.request"],
          batchRequestDescription: copy["admin.qr.batch.request.description"],
          batchRequestTitle: copy["admin.qr.batch.request.title"],
          batchStatusLabels: {
            CANCELLED: copy["admin.qr.batch.status.cancelled"],
            COMPLETED: copy["admin.qr.batch.status.completed"],
            DELIVERED: copy["admin.qr.batch.status.delivered"],
            DISTRIBUTING: copy["admin.qr.batch.status.distributing"],
            DRAFT: copy["admin.qr.batch.status.draft"],
            FAILED: copy["admin.qr.batch.status.failed"],
            FINAL_APPROVAL_PENDING: copy["admin.qr.batch.status.finalApprovalPending"],
            GENERATED: copy["admin.qr.batch.status.generated"],
            GENERATING: copy["admin.qr.batch.status.generating"],
            GENERATION_APPROVED: copy["admin.qr.batch.status.generationApproved"],
            GENERATION_QUEUED: copy["admin.qr.batch.status.generationQueued"],
            PARTIALLY_COMPLETED: copy["admin.qr.batch.status.partiallyCompleted"],
            PRINTED: copy["admin.qr.batch.status.printed"],
            PRINT_FILE_READY: copy["admin.qr.batch.status.printFileReady"],
            QUALITY_CHECKED: copy["admin.qr.batch.status.qualityChecked"],
            SAMPLE_APPROVED: copy["admin.qr.batch.status.sampleApproved"],
            SAMPLE_READY: copy["admin.qr.batch.status.sampleReady"],
            SAMPLE_RENDERING: copy["admin.qr.batch.status.sampleRendering"],
            SENT_TO_PRINTER: copy["admin.qr.batch.status.sentToPrinter"],
            SHIPPED: copy["admin.qr.batch.status.shipped"],
          },
          batchTitle: copy["admin.qr.batch.title"],
          byteSize: copy["admin.qr.byteSize"],
          checksum: copy["admin.qr.checksum"],
          company: copy["admin.qr.company"],
          contrast: copy["admin.qr.contrast"],
          createdAt: copy["admin.qr.createdAt"],
          decode: copy["admin.qr.decode"],
          description: copy["admin.qr.description"],
          designApproveDescription: copy["admin.qr.design.approval.description"],
          designApproveTitle: copy["admin.qr.design.approval.title"],
          designConfig: copy["admin.qr.design.config"],
          designCreate: copy["admin.qr.design.create"],
          designCreateDescription: copy["admin.qr.design.create.description"],
          designCreateTitle: copy["admin.qr.design.create.title"],
          designEmpty: copy["admin.qr.design.empty"],
          designStatusLabels: {
            APPROVED: copy["admin.qr.design.status.approved"],
            ARCHIVED: copy["admin.qr.design.status.archived"],
            DRAFT: copy["admin.qr.design.status.draft"],
          },
          designTitle: copy["admin.qr.design.title"],
          emptyQueue: copy["admin.qr.emptyQueue"],
          eyebrow: copy["admin.qr.eyebrow"],
          finalApprovalNotice: copy["admin.qr.finalApprovalNotice"],
          finalApprovalApprove: copy["admin.qr.final.approve"],
          finalApprovalDescription: copy["admin.qr.final.approval.description"],
          finalApprovalRequest: copy["admin.qr.final.request"],
          finalApprovalRequestDescription: copy["admin.qr.final.request.description"],
          finalApprovalTitle: copy["admin.qr.final.approval.title"],
          invalidate: copy["admin.qr.invalidate"],
          localeLabels: {
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          },
          localeTitle: copy["locale.switcher.label"],
          logoAlt: copy["admin.brand.logoAlt"],
          mimeType: copy["admin.qr.mimeType"],
          noApprovedDesign: copy["admin.qr.noApprovedDesign"],
          noSite: copy["admin.qr.noSite"],
          purposePlaceholder: copy["admin.qr.batch.purpose.placeholder"],
          qaEvidence: copy["admin.qr.qaEvidence"],
          quietZone: copy["admin.qr.quietZone"],
          reason: copy["admin.qr.reason"],
          reasonPlaceholder: copy["admin.qr.reason.placeholder"],
          sampleApprove: copy["admin.qr.sample.approve"],
          sampleApproveDescription: copy["admin.qr.sample.approval.description"],
          sampleApproveTitle: copy["admin.qr.sample.approval.title"],
          sampleAttach: copy["admin.qr.sample.attach"],
          sampleAttachDescription: copy["admin.qr.sample.attach.description"],
          sampleReady: copy["admin.qr.sample.ready"],
          sampleStatus: copy["admin.qr.sample.status"],
          securityNote: copy["admin.qr.securityNote"],
          signOut: copy["admin.shared.signOut"],
          site: copy["admin.qr.site"],
          storageBucket: copy["admin.qr.storageBucket"],
          storagePath: copy["admin.qr.storagePath"],
          templateCode: copy["admin.qr.templateCode"],
          tenant: copy["admin.qr.tenant"],
          titleLines: [copy["admin.qr.line1"], copy["admin.qr.line2"]],
          waitingDesign: copy["admin.qr.waiting.design"],
          waitingFinal: copy["admin.qr.waiting.final"],
          waitingSample: copy["admin.qr.waiting.sample"],
        }}
        errorMessage={error ? errorMessages[error] : undefined}
        finalApprovalModel={finalApprovalModel}
        locale={locale}
        model={model}
        statusMessage={status ? statusMessages[status] : undefined}
      />
    </main>
  );
}
