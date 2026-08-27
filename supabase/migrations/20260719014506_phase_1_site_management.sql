begin;

revoke insert, update on table public.sites from authenticated;

drop policy if exists sites_insert_scoped on public.sites;
drop policy if exists sites_update_scoped on public.sites;

create unique index uq_sites_active_management_name
on public.sites (management_company_id, lower(name))
where deleted_at is null;

create or replace function public.create_site(
  p_tenant_id uuid,
  p_management_company_id uuid,
  p_name text,
  p_site_type public.site_type,
  p_address text,
  p_timezone text,
  p_contract_vehicle_limit integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  created_site public.sites%rowtype;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.admin_memberships as actor_membership
    where actor_membership.user_id = actor_user_id
      and actor_membership.role = 'SUPER_ADMIN'
      and actor_membership.scope_type = 'PLATFORM'
      and actor_membership.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'ROLE_FORBIDDEN';
  end if;
  if p_tenant_id is null or p_management_company_id is null or not exists (
    select 1
    from public.management_companies as parent_company
    join public.tenants as parent_tenant
      on parent_tenant.id = parent_company.tenant_id
    where parent_company.id = p_management_company_id
      and parent_company.tenant_id = p_tenant_id
      and parent_company.status = 'ACTIVE'
      and parent_company.deleted_at is null
      and parent_tenant.status = 'ACTIVE'
      and parent_tenant.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INACTIVE_OR_INVALID_PARENT';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;
  if p_site_type is null then
    raise exception using errcode = '22023', message = 'INVALID_SITE_TYPE';
  end if;
  if p_address is not null and length(trim(p_address)) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
  end if;
  if p_timezone is null
    or length(trim(p_timezone)) not between 1 and 64
    or not exists (
      select 1
      from pg_catalog.pg_timezone_names as timezone_name
      where timezone_name.name = trim(p_timezone)
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_TIMEZONE';
  end if;
  if p_contract_vehicle_limit is null
    or p_contract_vehicle_limit < 0
    or p_contract_vehicle_limit > 1000000
  then
    raise exception using errcode = '22023', message = 'INVALID_CONTRACT_VEHICLE_LIMIT';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  insert into public.sites (
    tenant_id,
    management_company_id,
    name,
    site_type,
    address,
    timezone,
    contract_vehicle_limit
  )
  values (
    p_tenant_id,
    p_management_company_id,
    trim(p_name),
    p_site_type,
    nullif(trim(p_address), ''),
    trim(p_timezone),
    p_contract_vehicle_limit
  )
  returning * into created_site;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  )
  values (
    created_site.tenant_id,
    created_site.id,
    'ADMIN',
    actor_user_id,
    'SITE_CREATED',
    'SITE',
    created_site.id,
    jsonb_build_object(
      'name', created_site.name,
      'siteType', created_site.site_type::text,
      'timezone', created_site.timezone,
      'hasAddress', created_site.address is not null,
      'contractVehicleLimit', created_site.contract_vehicle_limit,
      'status', created_site.status::text,
      'version', created_site.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', created_site.id, 'version', created_site.version);
end;
$$;

create or replace function public.update_site_operational(
  p_site_id uuid,
  p_expected_version integer,
  p_name text,
  p_site_type public.site_type,
  p_address text,
  p_timezone text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role public.admin_role;
  before_site public.sites%rowtype;
  updated_site public.sites%rowtype;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_site_id is null then
    raise exception using errcode = '22023', message = 'INVALID_SITE_ID';
  end if;

  select target_site.*
  into before_site
  from public.sites as target_site
  where target_site.id = p_site_id
    and target_site.deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'SITE_NOT_FOUND_OR_FORBIDDEN';
  end if;

  select actor_membership.role
  into actor_role
  from public.admin_memberships as actor_membership
  where actor_membership.user_id = actor_user_id
    and actor_membership.status = 'ACTIVE'
    and actor_membership.role in (
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN'
    )
    and (
      actor_membership.scope_type = 'PLATFORM'
      or (
        actor_membership.scope_type = 'MANAGEMENT_COMPANY'
        and actor_membership.tenant_id = before_site.tenant_id
        and actor_membership.management_company_id = before_site.management_company_id
      )
      or (
        actor_membership.scope_type = 'SITE'
        and actor_membership.tenant_id = before_site.tenant_id
        and actor_membership.management_company_id = before_site.management_company_id
        and actor_membership.site_id = before_site.id
      )
    )
  order by case actor_membership.role
    when 'SUPER_ADMIN' then 1
    when 'PLATFORM_OPERATOR' then 2
    when 'MANAGEMENT_ADMIN' then 3
    when 'SITE_ADMIN' then 4
    else 99
  end
  limit 1;

  if actor_role is null then
    raise exception using errcode = '42501', message = 'SITE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if actor_role in ('SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'SITE_ADMIN')
    and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
  then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  if before_site.status = 'CLOSED' then
    raise exception using errcode = 'P0001', message = 'SITE_CLOSED';
  end if;
  if not exists (
    select 1
    from public.management_companies as parent_company
    join public.tenants as parent_tenant
      on parent_tenant.id = parent_company.tenant_id
    where parent_company.id = before_site.management_company_id
      and parent_company.tenant_id = before_site.tenant_id
      and parent_company.status = 'ACTIVE'
      and parent_company.deleted_at is null
      and parent_tenant.status = 'ACTIVE'
      and parent_tenant.deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'PARENT_NOT_ACTIVE';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;
  if p_site_type is null then
    raise exception using errcode = '22023', message = 'INVALID_SITE_TYPE';
  end if;
  if p_address is not null and length(trim(p_address)) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
  end if;
  if p_timezone is null
    or length(trim(p_timezone)) not between 1 and 64
    or not exists (
      select 1
      from pg_catalog.pg_timezone_names as timezone_name
      where timezone_name.name = trim(p_timezone)
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_TIMEZONE';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  update public.sites
  set
    name = trim(p_name),
    site_type = p_site_type,
    address = nullif(trim(p_address), ''),
    timezone = trim(p_timezone)
  where id = p_site_id
    and version = p_expected_version
    and deleted_at is null
  returning * into updated_site;

  if not found then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    before_data,
    after_data,
    reason,
    request_id
  )
  values (
    updated_site.tenant_id,
    updated_site.id,
    'ADMIN',
    actor_user_id,
    'SITE_OPERATIONAL_UPDATED',
    'SITE',
    updated_site.id,
    jsonb_build_object(
      'name', before_site.name,
      'siteType', before_site.site_type::text,
      'timezone', before_site.timezone,
      'hasAddress', before_site.address is not null,
      'version', before_site.version
    ),
    jsonb_build_object(
      'name', updated_site.name,
      'siteType', updated_site.site_type::text,
      'timezone', updated_site.timezone,
      'hasAddress', updated_site.address is not null,
      'addressChanged', before_site.address is distinct from updated_site.address,
      'version', updated_site.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', updated_site.id, 'version', updated_site.version);
end;
$$;

create or replace function public.update_site_contract(
  p_site_id uuid,
  p_expected_version integer,
  p_contract_vehicle_limit integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  before_site public.sites%rowtype;
  updated_site public.sites%rowtype;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.admin_memberships as actor_membership
    where actor_membership.user_id = actor_user_id
      and actor_membership.role = 'SUPER_ADMIN'
      and actor_membership.scope_type = 'PLATFORM'
      and actor_membership.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'ROLE_FORBIDDEN';
  end if;
  if p_site_id is null then
    raise exception using errcode = '22023', message = 'INVALID_SITE_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_contract_vehicle_limit is null
    or p_contract_vehicle_limit < 0
    or p_contract_vehicle_limit > 1000000
  then
    raise exception using errcode = '22023', message = 'INVALID_CONTRACT_VEHICLE_LIMIT';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  select target_site.*
  into before_site
  from public.sites as target_site
  join public.management_companies as parent_company
    on parent_company.id = target_site.management_company_id
    and parent_company.tenant_id = target_site.tenant_id
  join public.tenants as parent_tenant
    on parent_tenant.id = target_site.tenant_id
  where target_site.id = p_site_id
    and target_site.status <> 'CLOSED'
    and target_site.deleted_at is null
    and parent_company.status = 'ACTIVE'
    and parent_company.deleted_at is null
    and parent_tenant.status = 'ACTIVE'
    and parent_tenant.deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'SITE_OR_PARENT_NOT_ACTIVE';
  end if;

  update public.sites
  set contract_vehicle_limit = p_contract_vehicle_limit
  where id = p_site_id
    and version = p_expected_version
    and deleted_at is null
  returning * into updated_site;

  if not found then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    before_data,
    after_data,
    reason,
    request_id
  )
  values (
    updated_site.tenant_id,
    updated_site.id,
    'ADMIN',
    actor_user_id,
    'SITE_CONTRACT_LIMIT_UPDATED',
    'SITE',
    updated_site.id,
    jsonb_build_object(
      'contractVehicleLimit', before_site.contract_vehicle_limit,
      'version', before_site.version
    ),
    jsonb_build_object(
      'contractVehicleLimit', updated_site.contract_vehicle_limit,
      'version', updated_site.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', updated_site.id, 'version', updated_site.version);
end;
$$;

create or replace function public.change_site_status(
  p_site_id uuid,
  p_expected_version integer,
  p_next_status public.organization_status,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role public.admin_role;
  before_site public.sites%rowtype;
  updated_site public.sites%rowtype;
  audit_action text;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_site_id is null then
    raise exception using errcode = '22023', message = 'INVALID_SITE_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_next_status is null then
    raise exception using errcode = '22023', message = 'INVALID_STATUS';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  select target_site.*
  into before_site
  from public.sites as target_site
  where target_site.id = p_site_id
    and target_site.deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'SITE_NOT_FOUND_OR_FORBIDDEN';
  end if;

  select actor_membership.role
  into actor_role
  from public.admin_memberships as actor_membership
  where actor_membership.user_id = actor_user_id
    and actor_membership.status = 'ACTIVE'
    and (
      (
        p_next_status in ('ACTIVE', 'SUSPENDED')
        and actor_membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
        and actor_membership.scope_type = 'PLATFORM'
      )
      or (
        p_next_status = 'CLOSED'
        and actor_membership.role = 'SUPER_ADMIN'
        and actor_membership.scope_type = 'PLATFORM'
      )
    )
  order by case actor_membership.role
    when 'SUPER_ADMIN' then 1
    when 'PLATFORM_OPERATOR' then 2
    else 99
  end
  limit 1;

  if actor_role is null then
    raise exception using errcode = '42501', message = 'SITE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if actor_role = 'SUPER_ADMIN' and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  if not (
    (before_site.status = 'ACTIVE' and p_next_status in ('SUSPENDED', 'CLOSED'))
    or (before_site.status = 'SUSPENDED' and p_next_status in ('ACTIVE', 'CLOSED'))
  ) then
    raise exception using errcode = '22023', message = 'INVALID_STATUS_TRANSITION';
  end if;
  if p_next_status = 'ACTIVE' and not exists (
    select 1
    from public.management_companies as parent_company
    join public.tenants as parent_tenant
      on parent_tenant.id = parent_company.tenant_id
    where parent_company.id = before_site.management_company_id
      and parent_company.tenant_id = before_site.tenant_id
      and parent_company.status = 'ACTIVE'
      and parent_company.deleted_at is null
      and parent_tenant.status = 'ACTIVE'
      and parent_tenant.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'PARENT_NOT_ACTIVE';
  end if;
  if p_next_status = 'CLOSED' and exists (
    select 1
    from public.contracts as active_contract
    where active_contract.tenant_id = before_site.tenant_id
      and active_contract.management_company_id = before_site.management_company_id
      and active_contract.site_id = before_site.id
      and active_contract.status = 'ACTIVE'
      and active_contract.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'ACTIVE_CONTRACT_EXISTS';
  end if;

  update public.sites
  set status = p_next_status
  where id = p_site_id
    and version = p_expected_version
    and deleted_at is null
  returning * into updated_site;

  if not found then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  audit_action := case updated_site.status
    when 'ACTIVE' then 'SITE_REACTIVATED'
    when 'SUSPENDED' then 'SITE_SUSPENDED'
    when 'CLOSED' then 'SITE_CLOSED'
  end;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    before_data,
    after_data,
    reason,
    request_id
  )
  values (
    updated_site.tenant_id,
    updated_site.id,
    'ADMIN',
    actor_user_id,
    audit_action,
    'SITE',
    updated_site.id,
    jsonb_build_object(
      'status', before_site.status::text,
      'version', before_site.version
    ),
    jsonb_build_object(
      'status', updated_site.status::text,
      'version', updated_site.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', updated_site.id, 'version', updated_site.version);
end;
$$;

revoke all on function public.create_site(
  uuid,
  uuid,
  text,
  public.site_type,
  text,
  text,
  integer,
  text,
  uuid
)
from public, anon;
revoke all on function public.update_site_operational(
  uuid,
  integer,
  text,
  public.site_type,
  text,
  text,
  text,
  uuid
)
from public, anon;
revoke all on function public.update_site_contract(uuid, integer, integer, text, uuid)
from public, anon;
revoke all on function public.change_site_status(
  uuid,
  integer,
  public.organization_status,
  text,
  uuid
)
from public, anon;

grant execute on function public.create_site(
  uuid,
  uuid,
  text,
  public.site_type,
  text,
  text,
  integer,
  text,
  uuid
)
to authenticated, service_role;
grant execute on function public.update_site_operational(
  uuid,
  integer,
  text,
  public.site_type,
  text,
  text,
  text,
  uuid
)
to authenticated, service_role;
grant execute on function public.update_site_contract(uuid, integer, integer, text, uuid)
to authenticated, service_role;
grant execute on function public.change_site_status(
  uuid,
  integer,
  public.organization_status,
  text,
  uuid
)
to authenticated, service_role;

comment on table public.sites is
  'Tenant-scoped Site registry. Browser sessions are read-only; audited RPC commands enforce role and scope.';

commit;
