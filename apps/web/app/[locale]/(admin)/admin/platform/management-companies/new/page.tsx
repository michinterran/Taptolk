import { roleHasPermission } from "@taptolk/domain";
import { notFound, redirect } from "next/navigation";
import { getLocalizedAdminPath } from "../../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../../auth/page-guard";
import { AdminPageHeader } from "../../../../../../../components/admin-page-header";
import { ManagementCompanyCreateForm } from "../../../../../../../components/management-company-create-form";
import { DAUM_POSTCODE_SCRIPT_SRC } from "../../../../../../../config/address-search";
import { getMessages } from "../../../../../../../content/messages";
import { isAppLocale } from "../../../../../../../i18n/locale";

export default async function NewManagementCompanyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }

  const context = await requireReadyAdminContext(locale);
  const membership = context.decision.membership;
  if (membership.scopeType !== "PLATFORM") {
    redirect(getLocalizedAdminPath(locale, "/dashboard"));
  }
  if (!roleHasPermission(membership.role, "management-company:create")) {
    redirect(getLocalizedAdminPath(locale, "/access"));
  }

  const copy = getMessages(locale);
  const listPath = `/${locale}/admin/platform/management-companies`;

  return (
    <main className="admin-dashboard-shell">
      <AdminPageHeader
        locale={locale}
        localeLabels={{
          en: copy["locale.english"],
          ko: copy["locale.korean"],
        }}
        localeTitle={copy["locale.switcher.label"]}
        logoAlt={copy["admin.brand.logoAlt"]}
        pathname={`${listPath}/new`}
      />

      <section className="console-settings-page admin-create-panel admin-create-panel--page">
        <header className="console-settings-page__header">
          <div>
            <span className="admin-hierarchy-label">{copy["admin.companies.create.title"]}</span>
            <h1>{copy["admin.companies.create"]}</h1>
            <p>{copy["admin.companies.create.description"]}</p>
          </div>
          <a className="tt-button tt-button--secondary tt-button--compact" href={listPath}>
            {copy["admin.companies.cancel"]}
          </a>
        </header>

        <div className="console-settings-layout">
          <nav aria-label={copy["admin.companies.create"]} className="console-settings-nav">
            <a href="#company-create-basic">{copy["admin.companies.name"]}</a>
            <a href="#company-create-contact">{copy["admin.companies.contactName"]}</a>
            <a href="#company-create-operations">{copy["admin.companies.operationsManagerName"]}</a>
            <a href="#company-create-reason">{copy["admin.companies.reason"]}</a>
          </nav>

          <ManagementCompanyCreateForm
            addressScriptSrc={DAUM_POSTCODE_SCRIPT_SRC}
            copy={{
              address: copy["admin.companies.address"],
              addressDetail: copy["admin.companies.address.detail"],
              addressDetailPlaceholder: copy["admin.companies.address.detail.placeholder"],
              addressHelp: copy["admin.companies.address.help"],
              addressSearch: {
                close: copy["admin.companies.address.search.close"],
                fallbackHint: copy["admin.companies.address.search.fallback"],
                jibunAddress: copy["admin.companies.address.search.jibun"],
                open: copy["admin.companies.address.search.open"],
                roadAddress: copy["admin.companies.address.search.road"],
                title: copy["admin.companies.address.search.title"],
                zonecode: copy["admin.companies.address.search.zonecode"],
              },
              businessNumber: copy["admin.companies.businessNumber"],
              businessNumberHelp: copy["admin.companies.businessNumber.help"],
              cancel: copy["admin.companies.cancel"],
              contactChannelHelp: copy["admin.companies.contactChannel.help"],
              contactEmail: copy["admin.companies.contactEmail"],
              contactName: copy["admin.companies.contactName"],
              contactPhone: copy["admin.companies.contactPhone"],
              create: copy["admin.companies.create"],
              error: {
                blocked: copy["admin.companies.error.blocked"],
                channelRequired: copy["admin.companies.error.contactChannel"],
                conflict: copy["admin.companies.error.conflict"],
                forbidden: copy["admin.companies.error.forbidden"],
                formSummary: copy["admin.companies.error.formSummary"],
                invalid: copy["admin.companies.error.fieldInvalid"],
                operationsManagerChannelRequired:
                  copy["admin.companies.error.operationsManagerChannel"],
                required: copy["admin.companies.error.fieldRequired"],
                unavailable: copy["admin.companies.error.unavailable"],
              },
              localeLabel: copy["locale.switcher.label"],
              name: copy["admin.companies.name"],
              operationsManagerEmail: copy["admin.companies.operationsManagerEmail"],
              operationsManagerHelp: copy["admin.companies.operationsManager.help"],
              operationsManagerName: copy["admin.companies.operationsManagerName"],
              operationsManagerPhone: copy["admin.companies.operationsManagerPhone"],
              optional: copy["admin.companies.field.optional"],
              reason: copy["admin.companies.reason"],
              reasonPlaceholder: copy["admin.companies.reason.placeholder"],
              representativePhone: copy["admin.companies.representativePhone"],
              required: copy["admin.companies.field.required"],
              requiredHint: copy["admin.companies.required.help"],
              submitting: copy["admin.companies.submitting"],
            }}
            listPath={listPath}
            locale={locale}
          />
        </div>
      </section>
    </main>
  );
}
