begin;

create or replace function app_private.current_admin_can_read_tenant(
  target_tenant_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.admin_memberships as membership
    where membership.user_id = auth.uid()
      and membership.status = 'ACTIVE'
      and membership.role::text = any(allowed_roles)
      and (
        membership.scope_type = 'PLATFORM'
        or (
          target_tenant_id is not null
          and membership.tenant_id = target_tenant_id
        )
      )
  );
$$;

create or replace function app_private.current_admin_can_read_management_company(
  target_tenant_id uuid,
  target_management_company_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.admin_memberships as membership
    where membership.user_id = auth.uid()
      and membership.status = 'ACTIVE'
      and membership.role::text = any(allowed_roles)
      and (
        membership.scope_type = 'PLATFORM'
        or (
          target_tenant_id is not null
          and target_management_company_id is not null
          and membership.tenant_id = target_tenant_id
          and (
            membership.scope_type = 'TENANT'
            or (
              membership.scope_type in ('MANAGEMENT_COMPANY', 'SITE')
              and membership.management_company_id = target_management_company_id
            )
          )
        )
      )
  );
$$;

revoke all on function app_private.current_admin_can_read_tenant(uuid, text[])
from public, anon;
revoke all on function app_private.current_admin_can_read_management_company(uuid, uuid, text[])
from public, anon;
grant execute on function app_private.current_admin_can_read_tenant(uuid, text[])
to authenticated, service_role;
grant execute on function app_private.current_admin_can_read_management_company(uuid, uuid, text[])
to authenticated, service_role;

drop policy if exists tenants_select_scoped on public.tenants;
create policy tenants_select_scoped
on public.tenants
for select
to authenticated
using (
  app_private.current_admin_can_read_tenant(
    id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

drop policy if exists management_companies_select_scoped on public.management_companies;
create policy management_companies_select_scoped
on public.management_companies
for select
to authenticated
using (
  app_private.current_admin_can_read_management_company(
    tenant_id,
    id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

comment on function app_private.current_admin_can_read_tenant(uuid, text[]) is
  'Read-only parent visibility for active tenant descendants. Mutation scope remains unchanged.';
comment on function app_private.current_admin_can_read_management_company(uuid, uuid, text[]) is
  'Read-only parent visibility for active management-company descendants. Site row scope remains exact.';

commit;
