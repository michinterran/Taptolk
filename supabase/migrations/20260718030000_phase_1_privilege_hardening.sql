begin;

-- Supabase-managed defaults can add REFERENCES, TRIGGER, and TRUNCATE to
-- authenticated. Reset every browser-facing table to the reviewed contract
-- before granting the minimum privileges required by each application flow.
revoke all on table
  public.tenants,
  public.management_companies,
  public.sites,
  public.contracts,
  public.admin_profiles,
  public.admin_memberships,
  public.audit_logs
from authenticated;

grant select, insert, update on public.tenants to authenticated;
grant select, insert, update on public.management_companies to authenticated;
grant select on public.sites to authenticated;
grant select, insert, update on public.contracts to authenticated;
grant select, update on public.admin_profiles to authenticated;
grant select, insert, update on public.admin_memberships to authenticated;
grant select on public.audit_logs to authenticated;

-- RLS expressions reference the helper by object identity. Browser roles do
-- not need to resolve or call app_private objects directly.
revoke usage on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;

commit;
