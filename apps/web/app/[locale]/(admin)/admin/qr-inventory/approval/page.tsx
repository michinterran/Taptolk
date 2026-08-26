import { QrFinalGenerationApprovalService } from "@taptolk/application";
import { notFound } from "next/navigation";
import { createSupabaseQrFinalGenerationApprovalRepository } from "../../../../../../admin/supabase-qr-final-generation-approval-repository";
import { toAdminAuthorizationContext } from "../../../../../../auth/admin-authorization";
import { requireReadyAdminContext } from "../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../auth/server-client";
import { QrOnlyApprovalView } from "../../../../../../components/qr-only-approval-view";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QrInventoryApprovalPage({
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
  if (!isAppLocale(locale)) notFound();

  const context = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) throw new Error("ADMIN_SUPABASE_UNAVAILABLE");
  const actor = {
    authorization: toAdminAuthorizationContext(
      context.decision.membership,
      context.mfaLevel === "aal2",
    ),
    userId: context.userId,
  };
  const model = await new QrFinalGenerationApprovalService(
    createSupabaseQrFinalGenerationApprovalRepository(client),
  ).list({ actor });
  const messages = getMessages(locale);
  const error = readValue(query.error);
  const status = readValue(query.status);
  const errorMessages: Readonly<Record<string, string>> = {
    blocked: messages["admin.qr.error.blocked"],
    conflict: messages["admin.qr.error.conflict"],
    forbidden: messages["admin.qr.error.forbidden"],
    unavailable: messages["admin.qr.error.unavailable"],
    validation: messages["admin.qr.error.validation"],
  };

  return (
    <main className="admin-dashboard-shell">
      <QrOnlyApprovalView
        copy={{
          approve: messages["admin.qr.only.approval.approve"],
          back: messages["admin.qr.back"],
          description: messages["admin.qr.only.approval.description"],
          empty: messages["admin.qr.only.approval.empty"],
          eyebrow: messages["admin.qr.only.approval.eyebrow"],
          pending: messages["admin.qr.only.approval.pending"],
          pendingAction: messages["admin.qr.only.approval.pendingAction"],
          reason: messages["admin.qr.only.approval.reason"],
          reasonDefault: messages["admin.qr.only.approval.reasonPlaceholder"],
          reasonPlaceholder: messages["admin.qr.only.approval.reasonPlaceholder"],
          requestedByYou: messages["admin.qr.only.approval.requestedByYou"],
          status: messages["admin.qr.batch.status.finalApprovalPending"],
          title: messages["admin.qr.only.approval.title"],
        }}
        errorMessage={error ? errorMessages[error] : undefined}
        locale={locale}
        localeLabels={{ en: messages["locale.english"], ko: messages["locale.korean"] }}
        localeTitle={messages["locale.switcher.label"]}
        logoAlt={messages["admin.brand.logoAlt"]}
        model={model}
        statusMessage={
          status === "qrOnlyApprovalRequested"
            ? messages["admin.qr.only.approval.requested"]
            : undefined
        }
      />
    </main>
  );
}
