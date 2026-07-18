begin;

create index idx_admin_memberships_invited_by
on public.admin_memberships (invited_by);

create index idx_audit_logs_tenant_site
on public.audit_logs (tenant_id, site_id);

-- The three-column index also covers the two-column management company FK
-- because both constraints share the same leading columns.
create index idx_contracts_tenant_management_site
on public.contracts (tenant_id, management_company_id, site_id);

commit;
