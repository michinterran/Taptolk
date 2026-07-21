import { SiteWorkspaceService } from "@taptolk/application";
import { notFound, redirect } from "next/navigation";
import { createSupabaseSiteWorkspaceRepository } from "../../../../../../admin/supabase-site-workspace-repository";
import { toAdminAuthorizationContext } from "../../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../auth/server-client";
import { SiteWorkspaceView } from "../../../../../../components/site-workspace-view";
import { ADMIN_SITE_WORKSPACE_COPY } from "../../../../../../content/admin-site-workspace-copy";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

export default async function SiteWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string; siteId: string }>;
}) {
  const { locale, siteId } = await params;
  if (!isAppLocale(locale)) notFound();
  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  const authorization = toAdminAuthorizationContext(
    context.decision.membership,
    context.mfaLevel === "aal2",
  );
  const model = await new SiteWorkspaceService(createSupabaseSiteWorkspaceRepository(client)).read({
    actor: authorization,
    siteId,
  });
  if (!model) notFound();
  const messages = getMessages(locale);
  return (
    <main className="admin-dashboard-shell">
      <SiteWorkspaceView
        batchStatusLabels={{
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
        }}
        copy={ADMIN_SITE_WORKSPACE_COPY[locale]}
        locale={locale}
        localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
        localeTitle={messages["locale.switcher.label"]}
        logoAlt={messages["admin.brand.logoAlt"]}
        model={model}
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
      />
    </main>
  );
}
