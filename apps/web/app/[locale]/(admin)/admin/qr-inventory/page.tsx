import {
  QrBatchProgressService,
  QrFinalGenerationApprovalService,
  QrInventoryAssignmentService,
  QrInventorySampleService,
} from "@taptolk/application";
import { getAdminLandingArea } from "@taptolk/auth";
import { parseServerEnvironment } from "@taptolk/config";
import { roleHasPermission } from "@taptolk/domain";
import { notFound, redirect } from "next/navigation";
import { createSupabaseQrBatchProgressRepository } from "../../../../../admin/supabase-qr-batch-progress-repository";
import { createSupabaseQrFinalGenerationApprovalRepository } from "../../../../../admin/supabase-qr-final-generation-approval-repository";
import { createSupabaseQrInventoryAssignmentRepository } from "../../../../../admin/supabase-qr-inventory-assignment-repository";
import { createSupabaseQrInventorySampleRepository } from "../../../../../admin/supabase-qr-inventory-sample-repository";
import { AesGcmVehiclePlateProtector } from "../../../../../admin/vehicle-plate-protector";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { BrandAssetUploadView } from "../../../../../components/brand-asset-upload-view";
import { QrBatchProgressView } from "../../../../../components/qr-batch-progress-view";
import { QrInventoryAssignmentView } from "../../../../../components/qr-inventory-assignment-view";
import {
  QrInventorySampleView,
  type QrInventorySection,
} from "../../../../../components/qr-inventory-sample-view";
import { ADMIN_QR_WORKFLOW_COPY } from "../../../../../content/admin-qr-workflow-copy";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

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
    section?: string | string[];
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
  const environment = parseServerEnvironment();
  const unavailableProtector = {
    async protect(): Promise<never> {
      throw new Error("VEHICLE_PLATE_PROTECTION_CONFIG_MISSING");
    },
  };
  const plateProtector =
    environment.APP_ENCRYPTION_KEY_V1 && environment.TOKEN_HMAC_KEY
      ? new AesGcmVehiclePlateProtector(
          environment.APP_ENCRYPTION_KEY_V1,
          environment.TOKEN_HMAC_KEY,
        )
      : unavailableProtector;
  const [model, finalApprovalModel, assignmentModel, progressModel] = await Promise.all([
    new QrInventorySampleService(createSupabaseQrInventorySampleRepository(client)).list({
      actor,
    }),
    new QrFinalGenerationApprovalService(
      createSupabaseQrFinalGenerationApprovalRepository(client),
    ).list({ actor }),
    new QrInventoryAssignmentService(
      createSupabaseQrInventoryAssignmentRepository(client),
      plateProtector,
    ).list({ actor }),
    new QrBatchProgressService(createSupabaseQrBatchProgressRepository(client)).list({
      actor,
    }),
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
  const requestedSection = readValue(query.section);
  const section: QrInventorySection =
    requestedSection === "approvals" || requestedSection === "tracking"
      ? requestedSection
      : "order";
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
          batchSplitNotice: copy["admin.qr.batch.splitNotice"],
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
          designLogo: copy["admin.qr.design.logo"],
          designLogoNone: copy["admin.qr.design.logo.none"],
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
          quantity: {
            contextContract: copy["admin.qr.quantity.context.contract"],
            contextLastOrder: copy["admin.qr.quantity.context.lastOrder"],
            contextStock: copy["admin.qr.quantity.context.stock"],
            decrease: copy["admin.qr.quantity.decrease"],
            empty: copy["admin.qr.quantity.empty"],
            eta: copy["admin.qr.quantity.eta"],
            increase: copy["admin.qr.quantity.increase"],
            presetContract: copy["admin.qr.quantity.preset.contract"],
            presetContractDouble: copy["admin.qr.quantity.preset.contractDouble"],
            presetFixed: copy["admin.qr.quantity.preset.fixed"],
            recommend: copy["admin.qr.quantity.recommend"],
            recommendWhy: copy["admin.qr.quantity.recommend.why"],
            scaleContract: copy["admin.qr.quantity.scale.contract"],
            slider: copy["admin.qr.quantity.slider"],
            snapAligned: copy["admin.qr.quantity.snap.aligned"],
            snapDown: copy["admin.qr.quantity.snap.down"],
            snapUp: copy["admin.qr.quantity.snap.up"],
            splitNotice: copy["admin.qr.batch.splitNotice"],
            statBatches: copy["admin.qr.quantity.stat.batches"],
            statEta: copy["admin.qr.quantity.stat.eta"],
            statLast: copy["admin.qr.quantity.stat.last"],
            statPerBatch: copy["admin.qr.quantity.stat.perBatch"],
            total: copy["admin.qr.quantity.total"],
            unit: copy["admin.qr.quantity.unit"],
            vizCollapsed: copy["admin.qr.quantity.viz.collapsed"],
            vizNote: copy["admin.qr.quantity.viz.note"],
            vizTitle: copy["admin.qr.quantity.viz.title"],
            warnFills: copy["admin.qr.quantity.warn.fills"],
            warnOver: copy["admin.qr.quantity.warn.over"],
          },
          quietZone: copy["admin.qr.quietZone"],
          specBottom: copy["admin.qr.spec.bottom"],
          specBottomValue: copy["admin.qr.spec.bottom.value"],
          specSize: copy["admin.qr.spec.size"],
          specSizeValue: copy["admin.qr.spec.size.value"],
          sections: {
            approvals: copy["admin.qr.section.approvals"],
            approvalsHint: copy["admin.qr.section.approvals.hint"],
            order: copy["admin.qr.section.order"],
            orderHint: copy["admin.qr.section.order.hint"],
            title: copy["admin.qr.section.title"],
            tracking: copy["admin.qr.section.tracking"],
            trackingHint: copy["admin.qr.section.tracking.hint"],
          },
          reason: copy["admin.qr.reason"],
          reasonPlaceholder: copy["admin.qr.reason.placeholder"],
          sampleApprove: copy["admin.qr.sample.approve"],
          sampleApproveDescription: copy["admin.qr.sample.approval.description"],
          sampleApproveTitle: copy["admin.qr.sample.approval.title"],
          sampleAttach: copy["admin.qr.sample.attach"],
          sampleAttachDescription: copy["admin.qr.sample.attach.description"],
          sampleReady: copy["admin.qr.sample.ready"],
          samplePreviewAlt: copy["admin.qr.sample.preview.alt"],
          samplePreviewDesktop: copy["admin.qr.sample.preview.desktop"],
          samplePreviewMobile: copy["admin.qr.sample.preview.mobile"],
          sampleStatus: copy["admin.qr.sample.status"],
          securityNote: copy["admin.qr.securityNote"],
          signOut: copy["admin.shared.signOut"],
          site: copy["admin.qr.site"],
          storageBucket: copy["admin.qr.storageBucket"],
          storagePath: copy["admin.qr.storagePath"],
          templateCode: copy["admin.qr.templateCode"],
          wizardBrand: copy["admin.qr.wizard.brand"],
          wizardBrandDescription: copy["admin.qr.wizard.brand.description"],
          wizardPreview: copy["admin.qr.wizard.preview"],
          wizardQuantityHint: copy["admin.qr.wizard.quantityHint"],
          wizardStep1: copy["admin.qr.wizard.step1"],
          wizardStep1Description: copy["admin.qr.wizard.step1.description"],
          wizardStep2: copy["admin.qr.wizard.step2"],
          wizardStep2Description: copy["admin.qr.wizard.step2.description"],
          wizardStep3: copy["admin.qr.wizard.step3"],
          wizardStep3Description: copy["admin.qr.wizard.step3.description"],
          wizardTemplate: copy["admin.qr.wizard.template"],
          wizardTemplateDescription: copy["admin.qr.wizard.template.description"],
          wizardTitle: copy["admin.qr.wizard.title"],
          tenant: copy["admin.qr.tenant"],
          titleLines: [copy["admin.qr.line1"], copy["admin.qr.line2"]],
          waitingDesign: copy["admin.qr.waiting.design"],
          waitingFinal: copy["admin.qr.waiting.final"],
          waitingSample: copy["admin.qr.waiting.sample"],
        }}
        errorMessage={error ? errorMessages[error] : undefined}
        finalApprovalModel={finalApprovalModel}
        brandAssetUpload={
          roleHasPermission(membership.role, "sticker-design:create") ? (
            <BrandAssetUploadView
              copy={{
                description: copy["admin.qr.brand.upload.description"],
                file: copy["admin.qr.brand.upload.file"],
                name: copy["admin.qr.brand.upload.name"],
                reason: copy["admin.qr.reason"],
                reasonPlaceholder: copy["admin.qr.reason.placeholder"],
                site: copy["admin.qr.site"],
                submit: copy["admin.qr.brand.upload.submit"],
                title: copy["admin.qr.brand.upload.title"],
              }}
              locale={locale}
              sites={model.siteOptions}
            />
          ) : null
        }
        locale={locale}
        model={model}
        section={section}
        statusMessage={status ? statusMessages[status] : undefined}
        workflowCopy={ADMIN_QR_WORKFLOW_COPY[locale]}
      />
      {section === "tracking" ? (
        <QrBatchProgressView
          copy={{
            attempts: copy["admin.qr.progress.attempts"],
            empty: copy["admin.qr.progress.empty"],
            exports: copy["admin.qr.progress.exports"],
            failed: copy["admin.qr.progress.failed"],
            generated: copy["admin.qr.progress.generated"],
            progress: copy["admin.qr.progress.description"],
            statusLabels: {
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
            title: copy["admin.qr.progress.title"],
          }}
          items={progressModel}
        />
      ) : null}
      {section === "tracking" ? (
        <QrInventoryAssignmentView
          canAssign={roleHasPermission(membership.role, "qr-asset:assign")}
          canRevoke={roleHasPermission(membership.role, "qr-asset:revoke")}
          copy={{
            assign: copy["admin.qr.inventory.assign"],
            assignDescription: copy["admin.qr.inventory.assign.description"],
            assignTitle: copy["admin.qr.inventory.assign.title"],
            batchReceive: copy["admin.qr.inventory.batch.receive"],
            batchReceiveDescription: copy["admin.qr.inventory.batch.receive.description"],
            batchReceiveTitle: copy["admin.qr.inventory.batch.receive.title"],
            commit: copy["admin.qr.inventory.commit"],
            csvFile: copy["admin.qr.inventory.csvFile"],
            empty: copy["admin.qr.inventory.empty"],
            humanCode: copy["admin.qr.inventory.humanCode"],
            importDescription: copy["admin.qr.inventory.import.description"],
            importTitle: copy["admin.qr.inventory.import.title"],
            originalDeleted: copy["admin.qr.inventory.originalDeleted"],
            reason: copy["admin.qr.reason"],
            reasonPlaceholder: copy["admin.qr.reason.placeholder"],
            replace: copy["admin.qr.inventory.replace"],
            replacement: copy["admin.qr.inventory.replacement"],
            revoke: copy["admin.qr.inventory.revoke"],
            securityNote: copy["admin.qr.inventory.securityNote"],
            site: copy["admin.qr.site"],
            status: copy["admin.qr.inventory.status"],
            statusLabels: {
              ACTIVATION_PENDING: copy["admin.qr.asset.status.activationPending"],
              ACTIVE: copy["admin.qr.asset.status.active"],
              ASSIGNED: copy["admin.qr.asset.status.assigned"],
              DAMAGED: copy["admin.qr.asset.status.damaged"],
              EXPIRED: copy["admin.qr.asset.status.expired"],
              GENERATED: copy["admin.qr.asset.status.generated"],
              IN_STOCK: copy["admin.qr.asset.status.inStock"],
              LOST: copy["admin.qr.asset.status.lost"],
              PRINTED: copy["admin.qr.asset.status.printed"],
              PRINT_READY: copy["admin.qr.asset.status.printReady"],
              REPLACED: copy["admin.qr.asset.status.replaced"],
              REVOKED: copy["admin.qr.asset.status.revoked"],
              SUSPENDED: copy["admin.qr.asset.status.suspended"],
            },
            vehicleLast4: copy["admin.qr.inventory.vehicleLast4"],
            vehiclePlate: copy["admin.qr.inventory.vehiclePlate"],
          }}
          locale={locale}
          model={assignmentModel}
        />
      ) : null}
    </main>
  );
}
