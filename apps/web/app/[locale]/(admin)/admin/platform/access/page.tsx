import {
  AdminAccountApprovalService,
  type AdminApprovalQueue,
  type AdminApprovalScopeCatalog,
  type AdminApprovalSort,
} from "@taptolk/application";
import { notFound, redirect } from "next/navigation";
import {
  AdminAccountApprovalRepositoryError,
  createSupabaseAdminAccountApprovalRepository,
} from "../../../../../../admin/supabase-admin-account-approval-repository";
import { getLocalizedAdminPath } from "../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../../auth/server-client";
import { createAdminServiceClient } from "../../../../../../auth/service-client";
import { AdminAccountApprovalView } from "../../../../../../components/admin-account-approval-view";
import { getAdminRoleLabel, getAdminScopeLabel } from "../../../../../../content/admin-copy";
import { getMessages } from "../../../../../../content/messages";
import { isAppLocale } from "../../../../../../i18n/locale";

const EMPTY_QUEUE: AdminApprovalQueue = {
  accounts: [],
  page: 1,
  pageSize: 20,
  total: 0,
  truncated: false,
};

const EMPTY_SCOPES: AdminApprovalScopeCatalog = {
  managementCompanies: [],
  sites: [],
  tenants: [],
};

function readPage(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function readSearch(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim().slice(0, 120) ?? "";
}

function readSort(value: string | string[] | undefined): AdminApprovalSort {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "oldest" ? "oldest" : "newest";
}

function readStatus(
  value: string | string[] | undefined,
): "approved" | "assigned" | "invited" | "rejected" | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "approved" ||
    candidate === "assigned" ||
    candidate === "invited" ||
    candidate === "rejected"
    ? candidate
    : null;
}

function readErrorMessage(
  value: string | string[] | undefined,
  copy: ReturnType<typeof getMessages>,
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const errors = {
    conflict: copy["admin.approvals.error.conflict"],
    configuration: copy["admin.approvals.error.configuration"],
    "account-not-found": copy["admin.approvals.error.accountNotFound"],
    expired: copy["admin.access.error.invitationExpired"],
    forbidden: copy["admin.approvals.error.forbidden"],
    unavailable: copy["admin.approvals.error.unavailable"],
    validation: copy["admin.approvals.error.validation"],
  } as const;
  return candidate && candidate in errors ? errors[candidate as keyof typeof errors] : null;
}

export default async function PlatformAccessApprovalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string | string[];
    page?: string | string[];
    q?: string | string[];
    sort?: string | string[];
    status?: string | string[];
  }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  if (context.decision.membership.role !== "SUPER_ADMIN") {
    redirect(getLocalizedAdminPath(locale, "/platform"));
  }

  const copy = getMessages(locale);
  const search = readSearch(query.q);
  const sort = readSort(query.sort);
  const [sessionClient, serviceClient] = await Promise.all([
    createAdminServerClient(),
    Promise.resolve(createAdminServiceClient()),
  ]);
  let queue = EMPTY_QUEUE;
  let scopes = EMPTY_SCOPES;
  let configurationMissing = false;
  let repositoryError: string | null = null;

  if (!sessionClient || !serviceClient) {
    configurationMissing = true;
  } else {
    try {
      const service = new AdminAccountApprovalService(
        createSupabaseAdminAccountApprovalRepository(sessionClient, serviceClient),
      );
      const result = await service.list({
        actor: {
          authorization: {
            mfaVerified: context.mfaLevel === "aal2",
            role: context.decision.membership.role,
            scope: { type: "PLATFORM" },
          },
          userId: context.userId,
        },
        page: readPage(query.page),
        search,
        sort,
      });
      queue = result.queue;
      scopes = result.scopes;
    } catch (error) {
      repositoryError =
        error instanceof AdminAccountApprovalRepositoryError
          ? copy["admin.approvals.error.unavailable"]
          : copy["admin.approvals.error.forbidden"];
    }
  }

  return (
    <main className="admin-dashboard-shell">
      <AdminAccountApprovalView
        configurationMissing={configurationMissing}
        copy={{
          account: copy["admin.approvals.account"],
          approve: copy["admin.approvals.approve"],
          back: copy["admin.approvals.back"],
          configurationDescription: copy["admin.approvals.configuration.description"],
          configurationTitle: copy["admin.approvals.configuration.title"],
          description: copy["admin.approvals.description"],
          directAssignmentDescription: copy["admin.approvals.direct.description"],
          directAssignmentEmail: copy["admin.approvals.direct.email"],
          directAssignmentEmailPlaceholder: copy["admin.approvals.direct.emailPlaceholder"],
          directAssignmentSend: copy["admin.approvals.direct.send"],
          directAssignmentTitle: copy["admin.approvals.direct.title"],
          displayName: copy["admin.approvals.displayName"],
          emailStatus: copy["admin.approvals.emailStatus"],
          invitationDescription: copy["admin.approvals.invitation.description"],
          invitationEmail: copy["admin.approvals.invitation.email"],
          invitationEmailPlaceholder: copy["admin.approvals.invitation.emailPlaceholder"],
          invitationSend: copy["admin.approvals.invitation.send"],
          invitationTitle: copy["admin.approvals.invitation.title"],
          emptyDescription: copy["admin.approvals.empty.description"],
          emptyTitle: copy["admin.approvals.empty.title"],
          eyebrow: copy["admin.approvals.eyebrow"],
          joinedAt: copy["admin.approvals.joinedAt"],
          localeLabels: {
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          },
          localeTitle: copy["locale.switcher.label"],
          logoAlt: copy["admin.brand.logoAlt"],
          managementCompany: copy["admin.approvals.managementCompany"],
          next: copy["admin.tenants.next"],
          noManagementCompany: copy["admin.approvals.noManagementCompany"],
          noSite: copy["admin.approvals.noSite"],
          noTenant: copy["admin.approvals.noTenant"],
          page: copy["admin.tenants.page"],
          paginationLabel: copy["admin.approvals.pagination"],
          previous: copy["admin.tenants.previous"],
          provider: copy["admin.approvals.provider"],
          providerLabels: {
            email: copy["admin.approvals.provider.email"],
            google: copy["admin.approvals.provider.google"],
            other: copy["admin.approvals.provider.other"],
          },
          reset: copy["admin.approvals.reset"],
          reason: copy["admin.approvals.reason"],
          reasonPlaceholder: copy["admin.approvals.reasonPlaceholder"],
          reject: copy["admin.approvals.reject"],
          rejectDescription: copy["admin.approvals.rejectDescription"],
          rejectReason: copy["admin.approvals.rejectReason"],
          rejectReasonPlaceholder: copy["admin.approvals.rejectReasonPlaceholder"],
          rejectSummary: copy["admin.approvals.rejectSummary"],
          review: copy["admin.approvals.review"],
          role: copy["admin.approvals.role"],
          roleLabels: {
            MANAGEMENT_ADMIN: getAdminRoleLabel(copy, "MANAGEMENT_ADMIN"),
            PLATFORM_OPERATOR: getAdminRoleLabel(copy, "PLATFORM_OPERATOR"),
            READ_ONLY: getAdminRoleLabel(copy, "READ_ONLY"),
            SITE_ADMIN: getAdminRoleLabel(copy, "SITE_ADMIN"),
            SITE_OPERATOR: getAdminRoleLabel(copy, "SITE_OPERATOR"),
            SUPER_ADMIN: getAdminRoleLabel(copy, "SUPER_ADMIN"),
          },
          scopeHelp: copy["admin.approvals.scopeHelp"],
          scopeLabels: {
            MANAGEMENT_COMPANY: getAdminScopeLabel(copy, "MANAGEMENT_COMPANY"),
            PLATFORM: getAdminScopeLabel(copy, "PLATFORM"),
            SITE: getAdminScopeLabel(copy, "SITE"),
            TENANT: getAdminScopeLabel(copy, "TENANT"),
          },
          scopeType: copy["admin.approvals.scopeType"],
          search: copy["admin.approvals.search"],
          searchPlaceholder: copy["admin.approvals.searchPlaceholder"],
          securityNote: copy["admin.approvals.securityNote"],
          signOut: copy["admin.shared.signOut"],
          site: copy["admin.approvals.site"],
          statusLabels: {
            approved: copy["admin.approvals.status.approved"],
            assigned: copy["admin.approvals.status.assigned"],
            invited: copy["admin.approvals.status.invited"],
            rejected: copy["admin.approvals.status.rejected"],
          },
          sort: copy["admin.approvals.sort"],
          sortNewest: copy["admin.approvals.sortNewest"],
          sortOldest: copy["admin.approvals.sortOldest"],
          tenant: copy["admin.approvals.tenant"],
          titleLines: [copy["admin.approvals.line1"], copy["admin.approvals.line2"]],
          total: copy["admin.approvals.total"],
          truncated: copy["admin.approvals.truncated"],
          verificationLabels: {
            pending: copy["admin.approvals.verification.pending"],
            verified: copy["admin.approvals.verification.verified"],
          },
        }}
        errorMessage={readErrorMessage(query.error, copy) ?? repositoryError}
        locale={locale}
        queue={queue}
        scopes={scopes}
        search={search}
        sort={sort}
        status={readStatus(query.status)}
      />
    </main>
  );
}
