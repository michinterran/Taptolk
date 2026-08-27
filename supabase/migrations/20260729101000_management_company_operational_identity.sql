begin;

alter table public.tenants
  add column if not exists is_test_fixture boolean not null default false;

alter table public.management_companies
  add column if not exists management_code text,
  add column if not exists address text,
  add column if not exists is_test_fixture boolean not null default false;

alter table public.sites
  add column if not exists management_code text,
  add column if not exists is_test_fixture boolean not null default false;

update public.tenants
set is_test_fixture = true
where slug like 'e2e-%'
  and name like 'Taptolk E2E % Tenant %'
  and is_test_fixture = false;

update public.management_companies as company
set is_test_fixture = true
from public.tenants as tenant
where tenant.id = company.tenant_id
  and tenant.is_test_fixture
  and company.is_test_fixture = false;

update public.sites as site
set is_test_fixture = true
from public.management_companies as company
where company.id = site.management_company_id
  and company.is_test_fixture
  and site.is_test_fixture = false;

alter table public.management_companies
  drop constraint if exists chk_management_companies_management_code,
  drop constraint if exists chk_management_companies_address;

alter table public.sites
  drop constraint if exists chk_sites_management_code;

alter table public.management_companies
  add constraint chk_management_companies_management_code
    check (management_code is null or length(trim(management_code)) between 2 and 64),
  add constraint chk_management_companies_address
    check (address is null or length(trim(address)) between 2 and 300);

alter table public.sites
  add constraint chk_sites_management_code
    check (management_code is null or length(trim(management_code)) between 2 and 64);

create unique index if not exists uq_management_companies_active_management_code
on public.management_companies (tenant_id, lower(management_code))
where management_code is not null and deleted_at is null;

create unique index if not exists uq_sites_active_management_code
on public.sites (management_company_id, lower(management_code))
where management_code is not null and deleted_at is null;

create index if not exists idx_management_companies_fixture_status
on public.management_companies (is_test_fixture, status, created_at desc)
where deleted_at is null;

create index if not exists idx_sites_fixture_management_status
on public.sites (is_test_fixture, management_company_id, status)
where deleted_at is null;

drop function if exists public.create_management_company(uuid, text, text, text, uuid);
drop function if exists public.update_management_company(uuid, integer, text, text, text, uuid);

create or replace function public.create_management_company(
  p_tenant_id uuid,
  p_name text,
  p_management_code text,
  p_address text,
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
  normalized_management_code text := nullif(trim(coalesce(p_management_code, '')), '');
  normalized_address text := nullif(trim(coalesce(p_address, '')), '');
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
  if normalized_management_code is not null
    and length(normalized_management_code) not between 2 and 64
  then
    raise exception using errcode = '22023', message = 'INVALID_MANAGEMENT_CODE';
  end if;
  if normalized_address is not null and length(normalized_address) not between 2 and 300 then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
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
    management_code,
    address,
    business_number
  )
  values (
    p_tenant_id,
    trim(p_name),
    normalized_management_code,
    normalized_address,
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
      'managementCode', created_company.management_code,
      'addressPresent', created_company.address is not null,
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
  p_management_code text,
  p_address text,
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
  normalized_management_code text := nullif(trim(coalesce(p_management_code, '')), '');
  normalized_address text := nullif(trim(coalesce(p_address, '')), '');
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
  if normalized_management_code is not null
    and length(normalized_management_code) not between 2 and 64
  then
    raise exception using errcode = '22023', message = 'INVALID_MANAGEMENT_CODE';
  end if;
  if normalized_address is not null and length(normalized_address) not between 2 and 300 then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
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
    management_code = normalized_management_code,
    address = normalized_address,
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
      'managementCode', before_company.management_code,
      'addressPresent', before_company.address is not null,
      'businessNumber', before_company.business_number,
      'status', before_company.status::text,
      'version', before_company.version
    ),
    jsonb_build_object(
      'tenantId', updated_company.tenant_id,
      'name', updated_company.name,
      'managementCode', updated_company.management_code,
      'addressPresent', updated_company.address is not null,
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

revoke all on function public.create_management_company(uuid, text, text, text, text, text, uuid)
from public, anon;
revoke all on function public.update_management_company(uuid, integer, text, text, text, text, text, uuid)
from public, anon;

grant execute on function public.create_management_company(uuid, text, text, text, text, text, uuid)
to authenticated, service_role;
grant execute on function public.update_management_company(uuid, integer, text, text, text, text, text, uuid)
to authenticated, service_role;

comment on column public.tenants.is_test_fixture is
  'Marks deterministic E2E or staging fixture tenants so operator consoles can hide them by default.';
comment on column public.management_companies.management_code is
  'Operator-facing management company code. It is separate from the company name.';
comment on column public.management_companies.address is
  'Management company postal address for contract operations. Personal residence data is not stored here.';
comment on column public.management_companies.is_test_fixture is
  'Marks deterministic E2E or staging fixture companies so operator consoles can hide them by default.';
comment on column public.sites.management_code is
  'Operator-facing site code. It is separate from the site name.';
comment on column public.sites.is_test_fixture is
  'Marks deterministic E2E or staging fixture sites so operator consoles can hide them by default.';

commit;
