import { QrFinalGenerationApprovalService, QrInventorySampleService } from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import { roleHasPermission } from "@taptolk/domain";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { createQrInventoryCopy } from "../../../../../../admin/qr-inventory-copy";
import { createSupabaseQrFinalGenerationApprovalRepository } from "../../../../../../admin/supabase-qr-final-generation-approval-repository";
import { createSupabaseQrInventorySampleRepository } from "../../../../../../admin/supabase-qr-inventory-sample-repository";
import { toAdminAuthorizationContext } from "../../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../auth/server-client";
import { QrInventorySampleView } from "../../../../../../components/qr-inventory-sample-view";
import { resolveQrWizardStep } from "../../../../../../components/qr-wizard-stepper";
import { ADMIN_QR_WORKFLOW_COPY } from "../../../../../../content/admin-qr-workflow-copy";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * QR issuance must pass through design/sample review and independent final approval.
 * The route remains explicit so operators can see which step is waiting and which role
 * owns the next action.
 */
export default async function QrInventoryApprovalCompatibilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string | string[];
    site?: string | string[];
    status?: string | string[];
    step?: string | string[];
  }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();
  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    throw new Error("ADMIN_SUPABASE_UNAVAILABLE");
  }
  const membership = context.decision.membership;
  const actor = {
    authorization: toAdminAuthorizationContext(membership, context.mfaLevel === "aal2"),
    userId: context.userId,
  };
  const [model, finalApprovalModel] = await Promise.all([
    new QrInventorySampleService(createSupabaseQrInventorySampleRepository(client)).list({ actor }),
    new QrFinalGenerationApprovalService(
      createSupabaseQrFinalGenerationApprovalRepository(client),
    ).list({ actor }),
  ]);
  const copy = getMessages(locale);
  const error = readValue(query.error);
  const status = readValue(query.status);
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
  };
  const environment = parseServerEnvironment();
  return (
    <main className="admin-dashboard-shell">
      <QrInventorySampleView
        backHref={getLocalizedAdminPath(locale, "/qr-inventory")}
        canApproveDesign={roleHasPermission(membership.role, "sticker-design:approve")}
        canApproveFinalGeneration={roleHasPermission(
          membership.role,
          "qr-batch:generation-approve",
        )}
        canCreateDesign={roleHasPermission(membership.role, "sticker-design:create")}
        canOperateSample={roleHasPermission(membership.role, "qr-batch:sample-approve")}
        canRequestBatch={roleHasPermission(membership.role, "qr-batch:request")}
        canonicalQrHostReady={Boolean(environment.PUBLIC_QR_BASE_URL)}
        copy={
          createQrInventoryCopy(
            copy as Readonly<Record<string, string>>,
            locale,
          ) as unknown as ComponentProps<typeof QrInventorySampleView>["copy"]
        }
        errorMessage={error ? errorMessages[error] : undefined}
        finalApprovalModel={finalApprovalModel}
        locale={locale}
        model={model}
        selectedSiteId={readValue(query.site)}
        statusMessage={status ? statusMessages[status] : undefined}
        step={resolveQrWizardStep(readValue(query.step))}
        workflowCopy={ADMIN_QR_WORKFLOW_COPY[locale]}
      />
    </main>
  );
}
