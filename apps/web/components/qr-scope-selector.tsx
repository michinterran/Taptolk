"use client";

import { ArrowRight, CaretDown } from "@phosphor-icons/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AppLocale } from "../i18n/config";

interface QrScopeCompanyOption {
  id: string;
  name: string;
}

interface QrScopeSiteOption {
  id: string;
  managementCompanyId: string;
  name: string;
}

export function QrScopeSelector({
  companies,
  companyLabel,
  initialCompanyId,
  initialSiteId,
  locale,
  quantity,
  reviewLabel,
  siteLabel,
  sites,
}: {
  companies: readonly QrScopeCompanyOption[];
  companyLabel: string;
  initialCompanyId: string;
  initialSiteId: string;
  locale: AppLocale;
  quantity: number;
  reviewLabel: string;
  siteLabel: string;
  sites: readonly QrScopeSiteOption[];
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const companySites = useMemo(
    () => sites.filter((site) => site.managementCompanyId === companyId),
    [companyId, sites],
  );
  const initialSiteAvailable = companySites.some((site) => site.id === initialSiteId);
  const [siteId, setSiteId] = useState(initialSiteAvailable ? initialSiteId : "");
  const effectiveSiteId =
    companySites.find((site) => site.id === siteId)?.id ?? companySites[0]?.id ?? "";

  return (
    <form
      className="qr-console-v2-scope-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!companyId || !effectiveSiteId) return;
        const search = new URLSearchParams({
          company: companyId,
          quantity: String(quantity),
          site: effectiveSiteId,
        });
        router.push(`/${locale}/admin/qr-inventory?${search.toString()}` as Route);
      }}
    >
      <label className="admin-field" htmlFor="qr-company">
        <span>{companyLabel}</span>
        <span className="qr-console-v2-select">
          <select
            id="qr-company"
            onChange={(event) => {
              const nextCompanyId = event.currentTarget.value;
              setCompanyId(nextCompanyId);
              setSiteId(sites.find((site) => site.managementCompanyId === nextCompanyId)?.id ?? "");
            }}
            value={companyId}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <CaretDown aria-hidden="true" size={14} />
        </span>
      </label>
      <label className="admin-field" htmlFor="qr-site">
        <span>{siteLabel}</span>
        <span className="qr-console-v2-select">
          <select
            id="qr-site"
            onChange={(event) => setSiteId(event.currentTarget.value)}
            value={effectiveSiteId}
          >
            {companySites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <CaretDown aria-hidden="true" size={14} />
        </span>
      </label>
      <button
        className="tt-button tt-button--secondary tt-button--compact"
        disabled={!companyId || !effectiveSiteId}
        type="submit"
      >
        {reviewLabel}
        <ArrowRight aria-hidden="true" size={14} />
      </button>
    </form>
  );
}
