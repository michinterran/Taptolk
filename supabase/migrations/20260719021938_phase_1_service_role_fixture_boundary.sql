begin;

-- The staging E2E fixture uses the server-only Secret Key and must be able to
-- create and remove its own isolated hierarchy. Browser roles remain unchanged,
-- and no UPDATE/TRUNCATE privilege is added through this boundary.
grant select, insert, delete on table
  public.tenants,
  public.management_companies,
  public.sites,
  public.admin_profiles,
  public.admin_memberships
to service_role;

-- Site commands write audit rows through reviewed SECURITY DEFINER functions.
-- The fixture service can only read their evidence and remove those exact rows
-- before deleting the ephemeral Site hierarchy.
grant select, delete on table public.audit_logs to service_role;

commit;
