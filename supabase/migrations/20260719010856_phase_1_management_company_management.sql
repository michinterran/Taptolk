begin;

revoke insert, update on table public.management_companies from authenticated;

drop policy if exists management_companies_insert_platform
on public.management_companies;
drop policy if exists management_companies_update_platform
on public.management_companies;

alter table public.management_companies
add constraint chk_management_companies_business_number
check (business_number is null or business_number ~ '^[0-9]{10}$')
not valid;

alter table public.management_companies
validate constraint chk_management_companies_business_number;

create unique index uq_management_companies_active_business_number
on public.management_companies (tenant_id, business_number)
where business_number is not null and deleted_at is null;

create or replace function public.create_management_company(
  p_tenant_id uuid,
  p_name text,
  p_business_number text,
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
  created_company public.management_companies%rowtype;
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
  if p_tenant_id is null or not exists (
    select 1
    from public.tenants as target_tenant
    where target_tenant.id = p_tenant_id
      and target_tenant.status = 'ACTIVE'
      and target_tenant.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INACTIVE_OR_INVALID_TENANT';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;
  if p_business_number is not null
    and trim(p_business_number) !~ '^[0-9]{10}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_BUSINESS_NUMBER';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  insert into public.management_companies (
    tenant_id,
    name,
    business_number
  )
  values (
    p_tenant_id,
    trim(p_name),
    nullif(trim(p_business_number), '')
  )
  returning * into created_company;

  insert into public.audit_logs (
    tenant_id,
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
    created_company.tenant_id,
    'ADMIN',
    actor_user_id,
    'MANAGEMENT_COMPANY_CREATED',
    'MANAGEMENT_COMPANY',
    created_company.id,
    jsonb_build_object(
      'tenantId', created_company.tenant_id,
      'name', created_company.name,
      'businessNumber', created_company.business_number,
      'status', created_company.status::text,
      'version', created_company.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', created_company.id, 'version', created_company.version);
end;
$$;

create or replace function public.update_management_company(
  p_company_id uuid,
  p_expected_version integer,
  p_name text,
  p_business_number text,
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
  before_company public.management_companies%rowtype;
  updated_company public.management_companies%rowtype;
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
  if p_company_id is null then
    raise exception using errcode = '22023', message = 'INVALID_COMPANY_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;
  if p_business_number is not null
    and trim(p_business_number) !~ '^[0-9]{10}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_BUSINESS_NUMBER';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  select company.*
  into before_company
  from public.management_companies as company
  join public.tenants as parent_tenant
    on parent_tenant.id = company.tenant_id
  where company.id = p_company_id
    and company.deleted_at is null
    and parent_tenant.status = 'ACTIVE'
    and parent_tenant.deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'COMPANY_OR_TENANT_NOT_ACTIVE';
  end if;
  if before_company.status = 'CLOSED' then
    raise exception using errcode = 'P0001', message = 'COMPANY_CLOSED';
  end if;

  update public.management_companies
  set
    name = trim(p_name),
    business_number = nullif(trim(p_business_number), '')
  where id = p_company_id
    and version = p_expected_version
    and deleted_at is null
  returning * into updated_company;

  if not found then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  insert into public.audit_logs (
    tenant_id,
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
    updated_company.tenant_id,
    'ADMIN',
    actor_user_id,
    'MANAGEMENT_COMPANY_UPDATED',
    'MANAGEMENT_COMPANY',
    updated_company.id,
    jsonb_build_object(
      'tenantId', before_company.tenant_id,
      'name', before_company.name,
      'businessNumber', before_company.business_number,
      'status', before_company.status::text,
      'version', before_company.version
    ),
    jsonb_build_object(
      'tenantId', updated_company.tenant_id,
      'name', updated_company.name,
      'businessNumber', updated_company.business_number,
      'status', updated_company.status::text,
      'version', updated_company.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', updated_company.id, 'version', updated_company.version);
end;
$$;

create or replace function public.change_management_company_status(
  p_company_id uuid,
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
  before_company public.management_companies%rowtype;
  updated_company public.management_companies%rowtype;
  audit_action text;
  parent_tenant_status public.tenant_status;
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
  if p_company_id is null then
    raise exception using errcode = '22023', message = 'INVALID_COMPANY_ID';
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

  select company.*
  into before_company
  from public.management_companies as company
  join public.tenants as parent_tenant
    on parent_tenant.id = company.tenant_id
  where company.id = p_company_id
    and company.deleted_at is null
    and parent_tenant.deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'COMPANY_NOT_FOUND';
  end if;

  select parent_tenant.status
  into parent_tenant_status
  from public.tenants as parent_tenant
  where parent_tenant.id = before_company.tenant_id
    and parent_tenant.deleted_at is null;
  if not (
    (before_company.status = 'ACTIVE' and p_next_status in ('SUSPENDED', 'CLOSED'))
    or (before_company.status = 'SUSPENDED' and p_next_status in ('ACTIVE', 'CLOSED'))
  ) then
    raise exception using errcode = '22023', message = 'INVALID_STATUS_TRANSITION';
  end if;
  if p_next_status = 'ACTIVE' and parent_tenant_status <> 'ACTIVE' then
    raise exception using errcode = '22023', message = 'PARENT_TENANT_NOT_ACTIVE';
  end if;
  if p_next_status in ('SUSPENDED', 'CLOSED') and exists (
    select 1
    from public.sites as child_site
    where child_site.tenant_id = before_company.tenant_id
      and child_site.management_company_id = before_company.id
      and child_site.status = 'ACTIVE'
      and child_site.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'ACTIVE_SITE_EXISTS';
  end if;

  update public.management_companies
  set status = p_next_status
  where id = p_company_id
    and version = p_expected_version
    and deleted_at is null
  returning * into updated_company;

  if not found then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  audit_action := case updated_company.status
    when 'ACTIVE' then 'MANAGEMENT_COMPANY_REACTIVATED'
    when 'SUSPENDED' then 'MANAGEMENT_COMPANY_SUSPENDED'
    when 'CLOSED' then 'MANAGEMENT_COMPANY_CLOSED'
  end;

  insert into public.audit_logs (
    tenant_id,
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
    updated_company.tenant_id,
    'ADMIN',
    actor_user_id,
    audit_action,
    'MANAGEMENT_COMPANY',
    updated_company.id,
    jsonb_build_object(
      'status', before_company.status::text,
      'version', before_company.version
    ),
    jsonb_build_object(
      'status', updated_company.status::text,
      'version', updated_company.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', updated_company.id, 'version', updated_company.version);
end;
$$;

revoke all on function public.create_management_company(uuid, text, text, text, uuid)
from public, anon;
revoke all on function public.update_management_company(uuid, integer, text, text, text, uuid)
from public, anon;
revoke all on function public.change_management_company_status(
  uuid,
  integer,
  public.organization_status,
  text,
  uuid
)
from public, anon;

grant execute on function public.create_management_company(uuid, text, text, text, uuid)
to authenticated, service_role;
grant execute on function public.update_management_company(uuid, integer, text, text, text, uuid)
to authenticated, service_role;
grant execute on function public.change_management_company_status(
  uuid,
  integer,
  public.organization_status,
  text,
  uuid
)
to authenticated, service_role;

commit;
