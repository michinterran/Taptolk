import {
  DEFAULT_SITE_TIMEZONE,
  type OrganizationStatus,
  SITE_CONTRACT_VEHICLE_LIMIT_MAX,
  SITE_CONTRACT_VEHICLE_LIMIT_MIN,
  SiteCatalogService,
  type SiteCatalogSort,
  type SiteCatalogSortDirection,
  SiteLifecycleRequestService,
  type SiteType,
} from "@taptolk/application";
import { roleHasPermission } from "@taptolk/domain";
import { PageHeader } from "@taptolk/ui";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseSiteCatalogRepository } from "../../../../../admin/supabase-site-catalog-repository";
import { createSupabaseSiteLifecycleRequestRepository } from "../../../../../admin/supabase-site-lifecycle-request-repository";
import { toAdminAuthorizationContext } from "../../../../../auth/admin-authorization";
import { getLocalizedAdminPath } from "../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../auth/page-guard";
import { createAdminServerClient } from "../../../../../auth/server-client";
import { AdminPageHeader } from "../../../../../components/admin-page-header";
import { SiteCatalogView } from "../../../../../components/site-catalog-view";
import { getMessages } from "../../../../../content/messages";
import { isAppLocale } from "../../../../../i18n/locale";

function readValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readPage(value: string | string[] | undefined): number {
  const parsed = Number(readValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function readPageSize(value: string | string[] | undefined): number | undefined {
  const parsed = Number(readValue(value));
  return parsed === 10 || parsed === 20 || parsed === 50 ? parsed : undefined;
}

function readSiteType(value: string | string[] | undefined): SiteType | undefined {
  const type = readValue(value);
  return type === "APARTMENT" || type === "OFFICETEL" || type === "BUILDING" || type === "OTHER"
    ? type
    : undefined;
}

function readSiteStatus(value: string | string[] | undefined): OrganizationStatus | undefined {
  const status = readValue(value);
  return status === "ACTIVE" || status === "SUSPENDED" || status === "CLOSED" ? status : undefined;
}

function readSiteSort(value: string | string[] | undefined): SiteCatalogSort | undefined {
  const sort = readValue(value);
  return sort === "createdAt" || sort === "name" || sort === "contractLimit" ? sort : undefined;
}

function readSiteDirection(
  value: string | string[] | undefined,
): SiteCatalogSortDirection | undefined {
  const direction = readValue(value);
  return direction === "asc" || direction === "desc" ? direction : undefined;
}

function isSiteCatalogUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message === "Unable to load the Site catalog." ||
    error.message === "Unable to load active Site parents."
  );
}

export default async function SitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    company?: string | string[];
    direction?: string | string[];
    error?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
    q?: string | string[];
    sort?: string | string[];
    state?: string | string[];
    status?: string | string[];
    type?: string | string[];
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
  const direction = readSiteDirection(query.direction);
  const managementCompanyId = readValue(query.company);
  const search = readValue(query.q);
  const siteType = readSiteType(query.type);
  const sort = readSiteSort(query.sort);
  const siteStatus = readSiteStatus(query.state);
  const pageSize = readPageSize(query.pageSize);
  const siteCatalogQuery = {
    page: readPage(query.page),
    ...(direction ? { direction } : {}),
    ...(managementCompanyId ? { managementCompanyId } : {}),
    ...(pageSize ? { pageSize } : {}),
    ...(search ? { search } : {}),
    ...(siteType ? { siteType } : {}),
    ...(sort ? { sort } : {}),
    ...(siteStatus ? { status: siteStatus } : {}),
  };
  let catalog: Awaited<ReturnType<SiteCatalogService["list"]>>;
  let lifecycleRequests: Awaited<ReturnType<SiteLifecycleRequestService["list"]>>;
  try {
    [catalog, lifecycleRequests] = await Promise.all([
      new SiteCatalogService(createSupabaseSiteCatalogRepository(client)).list({
        actor: authorization,
        query: siteCatalogQuery,
      }),
      new SiteLifecycleRequestService(createSupabaseSiteLifecycleRequestRepository(client)).list({
        actor,
      }),
    ]);
  } catch (error) {
    if (!isSiteCatalogUnavailable(error)) {
      throw error;
    }
    return (
      <main className="admin-dashboard-shell">
        <div className="admin-catalog-canvas">
          <AdminPageHeader
            locale={locale}
            localeLabels={{
              en: copy["locale.english"],
              ko: copy["locale.korean"],
            }}
            localeTitle={copy["locale.switcher.label"]}
            logoAlt={copy["admin.brand.logoAlt"]}
            pathname={`/${locale}/admin/sites`}
          />
          <PageHeader
            description={copy["admin.sites.description"]}
            eyebrow={copy["admin.sites.eyebrow"]}
            lines={[copy["admin.sites.line1"], copy["admin.sites.line2"]]}
          />
          <section
            aria-labelledby="admin-sites-unavailable-title"
            className="admin-data-unavailable"
            role="status"
          >
            <h2 id="admin-sites-unavailable-title">{copy["admin.sites.error.unavailable"]}</h2>
            <p>{copy["shared.error.description"]}</p>
            <Link
              className="tt-button tt-button--secondary"
              href={`/${locale}/admin/sites` as Route}
            >
              {copy["shared.error.retry"]}
            </Link>
          </section>
        </div>
      </main>
    );
  }
  const errorMessages: Readonly<Record<string, string>> = {
    blocked: copy["admin.sites.error.blocked"],
    conflict: copy["admin.sites.error.conflict"],
    forbidden: copy["admin.sites.error.forbidden"],
    unavailable: copy["admin.sites.error.unavailable"],
    validation: copy["admin.sites.error.validation"],
  };
  const statusMessages: Readonly<Record<string, string>> = {
    contractUpdated: copy["admin.sites.status.contractUpdated"],
    created: copy["admin.sites.status.created"],
    operationalUpdated: copy["admin.sites.status.operationalUpdated"],
    requestApproved: copy["admin.sites.lifecycle.status.approved"],
    requestCancelled: copy["admin.sites.lifecycle.status.cancelled"],
    requestCreated: copy["admin.sites.lifecycle.status.created"],
    requestRejected: copy["admin.sites.lifecycle.status.rejected"],
    statusChanged: copy["admin.sites.status.statusChanged"],
  };
  const error = readValue(query.error);
  const status = readValue(query.status);
  return (
    <main className="admin-dashboard-shell">
      <SiteCatalogView
        canCreate={roleHasPermission(membership.role, "site:create")}
        catalog={catalog}
        contractVehicleLimitMin={SITE_CONTRACT_VEHICLE_LIMIT_MIN}
        contractVehicleLimitMax={SITE_CONTRACT_VEHICLE_LIMIT_MAX}
        copy={{
          actions: copy["admin.sites.actions"],
          address: copy["admin.sites.address"],
          addressDetail: copy["admin.sites.address.detail"],
          addressDetailPlaceholder: copy["admin.sites.address.detail.placeholder"],
          addressHelp: copy["admin.sites.address.help"],
          addressSearch: {
            close: copy["admin.sites.address.search.close"],
            fallbackHint: copy["admin.sites.address.search.fallback"],
            jibunAddress: copy["admin.sites.address.search.jibun"],
            open: copy["admin.sites.address.search.open"],
            roadAddress: copy["admin.sites.address.search.road"],
            title: copy["admin.sites.address.search.title"],
            zonecode: copy["admin.sites.address.search.zonecode"],
          },
          close: copy["admin.sites.close"],
          company: copy["admin.sites.company"],
          companyFilter: copy["admin.sites.filters.company"],
          clearFilters: copy["admin.sites.filters.clear"],
          contractLimit: copy["admin.sites.contractLimit"],
          contractLimitHelp: copy["admin.sites.contractLimit.help"],
          contractTitle: copy["admin.sites.contract.title"],
          create: copy["admin.sites.create"],
          createDescription: copy["admin.sites.create.description"],
          createTitle: copy["admin.sites.create.title"],
          createdAt: copy["admin.sites.createdAt"],
          description: copy["admin.sites.description"],
          emptyDescription: copy["admin.sites.empty.description"],
          emptyTitle: copy["admin.sites.empty.title"],
          eyebrow: copy["admin.sites.eyebrow"],
          lifecycleRequestOnly: copy["admin.sites.lifecycle.requestOnly"],
          lifecycleActionLabels: {
            CLOSE: copy["admin.sites.lifecycle.action.close"],
            REACTIVATE: copy["admin.sites.lifecycle.action.reactivate"],
            SUSPEND: copy["admin.sites.lifecycle.action.suspend"],
          },
          lifecycleApprovalApprove: copy["admin.sites.lifecycle.approval.approve"],
          lifecycleApprovalDescription: copy["admin.sites.lifecycle.approval.description"],
          lifecycleApprovalEmpty: copy["admin.sites.lifecycle.approval.empty"],
          lifecycleApprovalReject: copy["admin.sites.lifecycle.approval.reject"],
          lifecycleApprovalRejectSummary: copy["admin.sites.lifecycle.approval.rejectSummary"],
          lifecycleApprovalTitle: copy["admin.sites.lifecycle.approval.title"],
          lifecycleCancel: copy["admin.sites.lifecycle.cancel"],
          lifecycleCancelDescription: copy["admin.sites.lifecycle.cancel.description"],
          lifecyclePending: copy["admin.sites.lifecycle.pending"],
          lifecyclePendingAt: copy["admin.sites.lifecycle.pendingAt"],
          lifecyclePendingDescription: copy["admin.sites.lifecycle.pending.description"],
          lifecycleRequest: copy["admin.sites.lifecycle.request"],
          lifecycleRequestDescription: copy["admin.sites.lifecycle.request.description"],
          lifecycleRequestReason: copy["admin.sites.lifecycle.request.reason"],
          localeLabels: {
            en: copy["locale.english"],
            ko: copy["locale.korean"],
          },
          localeTitle: copy["locale.switcher.label"],
          logoAlt: copy["admin.brand.logoAlt"],
          moreActions: copy["admin.sites.moreActions"],
          name: copy["admin.sites.name"],
          next: copy["admin.sites.next"],
          noActiveParent: copy["admin.sites.noActiveParent"],
          notAvailable: copy["admin.sites.notAvailable"],
          optional: copy["admin.companies.field.optional"],
          operationalDescription: copy["admin.sites.operational.description"],
          operationalTitle: copy["admin.sites.operational.title"],
          page: copy["admin.sites.page"],
          pageSize: copy["admin.sites.filters.pageSize"],
          pageSizeOptions: [
            copy["admin.sites.filters.pageSize.10"],
            copy["admin.sites.filters.pageSize.20"],
            copy["admin.sites.filters.pageSize.50"],
          ],
          paginationLabel: copy["admin.sites.pagination"],
          parent: copy["admin.sites.parent"],
          previous: copy["admin.sites.previous"],
          reactivate: copy["admin.sites.reactivate"],
          reason: copy["admin.sites.reason"],
          reasonPlaceholder: copy["admin.sites.reason.placeholder"],
          required: copy["admin.companies.field.required"],
          requiredHint: copy["admin.sites.required.help"],
          saveContract: copy["admin.sites.contract.save"],
          saveOperational: copy["admin.sites.operational.save"],
          search: copy["admin.sites.filters.search"],
          searchAction: copy["admin.sites.filters.searchAction"],
          filters: copy["admin.sites.filters.label"],
          securityNote: copy["admin.sites.securityNote"],
          sort: copy["admin.sites.filters.sort"],
          sortCreatedAt: copy["admin.sites.filters.sort.createdAt"],
          sortName: copy["admin.sites.filters.sort.name"],
          sortContractLimit: copy["admin.sites.filters.sort.contractLimit"],
          direction: copy["admin.sites.filters.direction"],
          directionContractLimitAscending: copy["admin.sites.filters.direction.contractLimit.asc"],
          directionContractLimitDescending:
            copy["admin.sites.filters.direction.contractLimit.desc"],
          directionCreatedAtAscending: copy["admin.sites.filters.direction.createdAt.asc"],
          directionCreatedAtDescending: copy["admin.sites.filters.direction.createdAt.desc"],
          directionNameAscending: copy["admin.sites.filters.direction.name.asc"],
          directionNameDescending: copy["admin.sites.filters.direction.name.desc"],
          status: copy["admin.sites.status"],
          statusDescription: copy["admin.sites.status.description"],
          statusLabels: {
            ACTIVE: copy["admin.sites.status.active"],
            CLOSED: copy["admin.sites.status.closed"],
            SUSPENDED: copy["admin.sites.status.suspended"],
          },
          suspend: copy["admin.sites.suspend"],
          tenant: copy["admin.sites.tenant"],
          timezone: copy["admin.sites.timezone"],
          titleLines: [copy["admin.sites.line1"], copy["admin.sites.line2"]],
          total: copy["admin.sites.total"],
          type: copy["admin.sites.type"],
          typeLabels: {
            APARTMENT: copy["admin.sites.type.apartment"],
            BUILDING: copy["admin.sites.type.building"],
            OFFICETEL: copy["admin.sites.type.officetel"],
            OTHER: copy["admin.sites.type.other"],
          },
          view: copy["admin.sites.view"],
        }}
        defaultTimezone={DEFAULT_SITE_TIMEZONE}
        errorMessages={errorMessages}
        errorMessage={error ? errorMessages[error] : undefined}
        lifecycleRequests={lifecycleRequests}
        locale={locale}
        statusMessage={status ? statusMessages[status] : undefined}
        successMessages={statusMessages}
      />
    </main>
  );
}
