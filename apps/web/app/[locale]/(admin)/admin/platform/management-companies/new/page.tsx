import { roleHasPermission } from "@taptolk/domain";
import { notFound, redirect } from "next/navigation";
import { createManagementCompany } from "../../../../../../../admin/management-company-actions";
import { getLocalizedAdminPath } from "../../../../../../../auth/admin-routing";
import { requireReadyAdminContext } from "../../../../../../../auth/page-guard";
import { AdminPageHeader } from "../../../../../../../components/admin-page-header";
import { ManagementCompanyAddressSearchField } from "../../../../../../../components/management-company-address-search-field";
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

          <form action={createManagementCompany} className="admin-tenant-form admin-company-form">
            <input
              aria-label={copy["locale.switcher.label"]}
              name="locale"
              type="hidden"
              value={locale}
            />
            <div className="admin-company-form__section" id="company-create-basic">
              <h2>{copy["admin.companies.name"]}</h2>
              <div className="admin-company-form__grid">
                <label className="admin-field" htmlFor="company-create-name">
                  <span>{copy["admin.companies.name"]}</span>
                  <input id="company-create-name" maxLength={200} name="name" required />
                </label>
                <label className="admin-field" htmlFor="company-create-business-number">
                  <span>{copy["admin.companies.businessNumber"]}</span>
                  <input
                    id="company-create-business-number"
                    inputMode="numeric"
                    name="businessNumber"
                    pattern="[0-9-]*"
                  />
                  <small>{copy["admin.companies.businessNumber.help"]}</small>
                </label>
                <div className="admin-field admin-company-form__wide-field">
                  <span>{copy["admin.companies.address"]}</span>
                  <ManagementCompanyAddressSearchField
                    detailLabel={copy["admin.companies.address.detail"]}
                    detailPlaceholder={copy["admin.companies.address.detail.placeholder"]}
                    labels={{
                      close: copy["admin.companies.address.search.close"],
                      fallbackHint: copy["admin.companies.address.search.fallback"],
                      jibunAddress: copy["admin.companies.address.search.jibun"],
                      open: copy["admin.companies.address.search.open"],
                      roadAddress: copy["admin.companies.address.search.road"],
                      title: copy["admin.companies.address.search.title"],
                      zonecode: copy["admin.companies.address.search.zonecode"],
                    }}
                    name="address"
                    scriptSrc={DAUM_POSTCODE_SCRIPT_SRC}
                  />
                  <small>{copy["admin.companies.address.help"]}</small>
                </div>
              </div>
            </div>

            <div className="admin-company-form__section" id="company-create-contact">
              <h2>{copy["admin.companies.contactName"]}</h2>
              <div className="admin-company-form__grid">
                <label className="admin-field" htmlFor="company-create-representative-phone">
                  <span>{copy["admin.companies.representativePhone"]}</span>
                  <input
                    autoComplete="tel"
                    id="company-create-representative-phone"
                    inputMode="tel"
                    name="representativePhone"
                  />
                </label>
                <label className="admin-field" htmlFor="company-create-contact-name">
                  <span>{copy["admin.companies.contactName"]}</span>
                  <input id="company-create-contact-name" maxLength={100} name="contactName" />
                </label>
                <label className="admin-field" htmlFor="company-create-contact-phone">
                  <span>{copy["admin.companies.contactPhone"]}</span>
                  <input
                    autoComplete="tel"
                    id="company-create-contact-phone"
                    inputMode="tel"
                    name="contactPhone"
                  />
                </label>
                <label className="admin-field" htmlFor="company-create-contact-email">
                  <span>{copy["admin.companies.contactEmail"]}</span>
                  <input
                    autoComplete="email"
                    id="company-create-contact-email"
                    maxLength={254}
                    name="contactEmail"
                    type="email"
                  />
                </label>
              </div>
            </div>

            <div className="admin-company-form__section" id="company-create-operations">
              <h2>{copy["admin.companies.operationsManagerName"]}</h2>
              <div className="admin-company-form__grid">
                <label className="admin-field" htmlFor="company-create-operations-manager-name">
                  <span>{copy["admin.companies.operationsManagerName"]}</span>
                  <input
                    id="company-create-operations-manager-name"
                    maxLength={100}
                    name="operationsManagerName"
                  />
                </label>
                <label className="admin-field" htmlFor="company-create-operations-manager-phone">
                  <span>{copy["admin.companies.operationsManagerPhone"]}</span>
                  <input
                    autoComplete="tel"
                    id="company-create-operations-manager-phone"
                    inputMode="tel"
                    name="operationsManagerPhone"
                  />
                </label>
                <label
                  className="admin-field admin-company-form__wide-field"
                  htmlFor="company-create-operations-manager-email"
                >
                  <span>{copy["admin.companies.operationsManagerEmail"]}</span>
                  <input
                    autoComplete="email"
                    id="company-create-operations-manager-email"
                    maxLength={254}
                    name="operationsManagerEmail"
                    type="email"
                  />
                </label>
              </div>
            </div>

            <div className="admin-company-form__section" id="company-create-reason">
              <h2>{copy["admin.companies.reason"]}</h2>
              <label className="admin-field" htmlFor="company-create-reason-input">
                <span>{copy["admin.companies.reason"]}</span>
                <textarea
                  id="company-create-reason-input"
                  maxLength={500}
                  minLength={3}
                  name="reason"
                  placeholder={copy["admin.companies.reason.placeholder"]}
                  required
                />
              </label>
            </div>

            <div className="admin-company-form__actions">
              <a className="tt-button tt-button--secondary" href={listPath}>
                {copy["admin.companies.cancel"]}
              </a>
              <button className="tt-button" type="submit">
                {copy["admin.companies.create"]}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
