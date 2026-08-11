"use client";

import type { AdminApprovalScopeCatalog } from "@taptolk/application";
import type { AdminRole, AdminScopeType } from "@taptolk/domain";
import { useMemo, useState } from "react";
import type { AppLocale } from "../i18n/config";

type AssignmentAction = (formData: FormData) => void | Promise<void>;

type AssignmentFormCopy = {
  description: string;
  displayName: string;
  email: string;
  emailPlaceholder: string;
  localeTitle: string;
  managementCompany: string;
  noManagementCompany: string;
  noSite: string;
  noTenant: string;
  reason: string;
  reasonPlaceholder: string;
  role: string;
  roleLabels: Readonly<Record<AdminRole, string>>;
  scopeHelp: string;
  scopeLabels: Readonly<Record<AdminScopeType, string>>;
  scopeType: string;
  site: string;
  tenant: string;
  title: string;
  submit: string;
};

interface AdminAccountAssignmentFormProps {
  action: AssignmentAction;
  className: string;
  copy: AssignmentFormCopy;
  formId: string;
  locale: AppLocale;
  scopes: AdminApprovalScopeCatalog;
}

const ROLE_SCOPE_OPTIONS: Readonly<
  Record<AdminRole, readonly [AdminScopeType, ...AdminScopeType[]]>
> = {
  MANAGEMENT_ADMIN: ["MANAGEMENT_COMPANY"],
  PLATFORM_OPERATOR: ["PLATFORM"],
  READ_ONLY: ["TENANT", "MANAGEMENT_COMPANY", "SITE"],
  SITE_ADMIN: ["SITE"],
  SITE_OPERATOR: ["SITE"],
  SUPER_ADMIN: ["PLATFORM"],
};

const SCOPE_ROLE_OPTIONS: Readonly<Record<AdminScopeType, readonly [AdminRole, ...AdminRole[]]>> = {
  MANAGEMENT_COMPANY: ["MANAGEMENT_ADMIN", "READ_ONLY"],
  PLATFORM: ["SUPER_ADMIN", "PLATFORM_OPERATOR"],
  SITE: ["SITE_ADMIN", "SITE_OPERATOR", "READ_ONLY"],
  TENANT: ["READ_ONLY"],
};

function isScopeOptionVisible(scopeType: AdminScopeType, field: "tenant" | "company" | "site") {
  if (field === "tenant") return scopeType !== "PLATFORM";
  if (field === "company") {
    return scopeType === "MANAGEMENT_COMPANY" || scopeType === "SITE";
  }
  return scopeType === "SITE";
}

export function AdminAccountAssignmentForm({
  action,
  className,
  copy,
  formId,
  locale,
  scopes,
}: AdminAccountAssignmentFormProps) {
  const [role, setRole] = useState<AdminRole>("MANAGEMENT_ADMIN");
  const [scopeType, setScopeType] = useState<AdminScopeType>("MANAGEMENT_COMPANY");
  const [tenantId, setTenantId] = useState("");
  const [managementCompanyId, setManagementCompanyId] = useState("");
  const [siteId, setSiteId] = useState("");

  const availableScopes = ROLE_SCOPE_OPTIONS[role];
  const availableRoles = SCOPE_ROLE_OPTIONS[scopeType];
  const managementCompanies = useMemo(
    () =>
      tenantId ? scopes.managementCompanies.filter((company) => company.parentId === tenantId) : [],
    [scopes.managementCompanies, tenantId],
  );
  const sites = useMemo(
    () =>
      managementCompanyId
        ? scopes.sites.filter((site) => site.parentId === managementCompanyId)
        : [],
    [managementCompanyId, scopes.sites],
  );

  function resetScopeSelection() {
    setTenantId("");
    setManagementCompanyId("");
    setSiteId("");
  }

  function handleRoleChange(nextRole: AdminRole) {
    setRole(nextRole);
    if (!ROLE_SCOPE_OPTIONS[nextRole].includes(scopeType)) {
      setScopeType(ROLE_SCOPE_OPTIONS[nextRole][0]);
      resetScopeSelection();
    }
  }

  function handleScopeChange(nextScopeType: AdminScopeType) {
    setScopeType(nextScopeType);
    if (!SCOPE_ROLE_OPTIONS[nextScopeType].includes(role)) {
      setRole(SCOPE_ROLE_OPTIONS[nextScopeType][0]);
    }
    resetScopeSelection();
  }

  return (
    <section aria-labelledby={`${formId}-title`} className={className}>
      <header>
        <p className="eyebrow">{copy.title}</p>
        <h2 id={`${formId}-title`}>{copy.title}</h2>
        <p>{copy.description}</p>
      </header>
      <form action={action} className="admin-approval-form">
        <input aria-label={copy.localeTitle} name="locale" type="hidden" value={locale} />

        <div className="admin-approval-field-grid">
          <label className="admin-field" htmlFor={`${formId}-email`}>
            <span>{copy.email}</span>
            <input
              id={`${formId}-email`}
              name="email"
              placeholder={copy.emailPlaceholder}
              required
              type="email"
            />
          </label>
          <label className="admin-field" htmlFor={`${formId}-display-name`}>
            <span>{copy.displayName}</span>
            <input id={`${formId}-display-name`} maxLength={100} name="displayName" required />
          </label>
        </div>

        <div className="admin-approval-field-grid">
          <label className="admin-field" htmlFor={`${formId}-role`}>
            <span>{copy.role}</span>
            <select
              id={`${formId}-role`}
              name="role"
              onChange={(event) => handleRoleChange(event.target.value as AdminRole)}
              value={role}
            >
              {availableRoles.map((availableRole) => (
                <option key={availableRole} value={availableRole}>
                  {copy.roleLabels[availableRole]}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field" htmlFor={`${formId}-scope-type`}>
            <span>{copy.scopeType}</span>
            <select
              id={`${formId}-scope-type`}
              name="scopeType"
              onChange={(event) => handleScopeChange(event.target.value as AdminScopeType)}
              value={scopeType}
            >
              {availableScopes.map((availableScope) => (
                <option key={availableScope} value={availableScope}>
                  {copy.scopeLabels[availableScope]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="admin-approval-scope-help">{copy.scopeHelp}</p>

        <div className="admin-approval-field-grid admin-approval-field-grid--scope">
          {isScopeOptionVisible(scopeType, "tenant") ? (
            <label className="admin-field" htmlFor={`${formId}-tenant`}>
              <span>{copy.tenant}</span>
              <select
                id={`${formId}-tenant`}
                name="tenantId"
                onChange={(event) => {
                  setTenantId(event.target.value);
                  setManagementCompanyId("");
                  setSiteId("");
                }}
                required
                value={tenantId}
              >
                <option value="">{copy.noTenant}</option>
                {scopes.tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {isScopeOptionVisible(scopeType, "company") ? (
            <label className="admin-field" htmlFor={`${formId}-management-company`}>
              <span>{copy.managementCompany}</span>
              <select
                disabled={!tenantId}
                id={`${formId}-management-company`}
                name="managementCompanyId"
                onChange={(event) => {
                  setManagementCompanyId(event.target.value);
                  setSiteId("");
                }}
                required
                value={managementCompanyId}
              >
                <option value="">{copy.noManagementCompany}</option>
                {managementCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {isScopeOptionVisible(scopeType, "site") ? (
            <label className="admin-field" htmlFor={`${formId}-site`}>
              <span>{copy.site}</span>
              <select
                disabled={!managementCompanyId}
                id={`${formId}-site`}
                name="siteId"
                onChange={(event) => setSiteId(event.target.value)}
                required
                value={siteId}
              >
                <option value="">{copy.noSite}</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <label className="admin-field" htmlFor={`${formId}-reason`}>
          <span>{copy.reason}</span>
          <textarea
            id={`${formId}-reason`}
            maxLength={500}
            minLength={3}
            name="reason"
            placeholder={copy.reasonPlaceholder}
            required
            rows={3}
          />
        </label>
        <button className="tt-button" type="submit">
          {copy.submit}
        </button>
      </form>
    </section>
  );
}
