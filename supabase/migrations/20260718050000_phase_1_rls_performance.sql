begin;

drop policy if exists admin_profiles_select_self on public.admin_profiles;
create policy admin_profiles_select_self
on public.admin_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists admin_profiles_update_self on public.admin_profiles;
create policy admin_profiles_update_self
on public.admin_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists admin_memberships_select_scoped on public.admin_memberships;
create policy admin_memberships_select_scoped
on public.admin_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
);

drop policy if exists contracts_mutate_scoped on public.contracts;

create policy contracts_insert_scoped
on public.contracts
for insert
to authenticated
with check (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN']
  )
);

create policy contracts_update_scoped
on public.contracts
for update
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN']
  )
)
with check (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN']
  )
);

commit;
