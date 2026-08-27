begin;

alter table public.management_companies
  add column if not exists representative_phone_encrypted text,
  add column if not exists contact_email text,
  add column if not exists operations_manager_name text,
  add column if not exists operations_manager_phone_encrypted text,
  add column if not exists operations_manager_email text;

alter table public.management_companies
  drop constraint if exists chk_management_companies_contact_email,
  drop constraint if exists chk_management_companies_operations_manager_email,
  drop constraint if exists chk_management_companies_contact_name,
  drop constraint if exists chk_management_companies_operations_manager_name;

alter table public.management_companies
  add constraint chk_management_companies_contact_email
    check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add constraint chk_management_companies_operations_manager_email
    check (operations_manager_email is null or operations_manager_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add constraint chk_management_companies_contact_name
    check (contact_name is null or length(trim(contact_name)) between 1 and 100),
  add constraint chk_management_companies_operations_manager_name
    check (operations_manager_name is null or length(trim(operations_manager_name)) between 1 and 100);

create sequence if not exists public.management_company_code_seq;

drop function if exists public.create_management_company(uuid, text, text, text, text, text, uuid);

create or replace function public.create_management_company(
  p_name text,
  p_address text,
  p_business_number text,
  p_representative_phone_encrypted text,
  p_contact_name text,
  p_contact_phone_encrypted text,
  p_contact_email text,
  p_operations_manager_name text,
  p_operations_manager_phone_encrypted text,
  p_operations_manager_email text,
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
  created_tenant public.tenants%rowtype;
  generated_management_code text;
  generated_slug text;
  normalized_address text := nullif(trim(coalesce(p_address, '')), '');
  normalized_business_number text := nullif(trim(coalesce(p_business_number, '')), '');
  normalized_contact_email text := nullif(lower(trim(coalesce(p_contact_email, ''))), '');
  normalized_contact_name text := nullif(trim(coalesce(p_contact_name, '')), '');
  normalized_operations_manager_email text :=
    nullif(lower(trim(coalesce(p_operations_manager_email, ''))), '');
  normalized_operations_manager_name text :=
    nullif(trim(coalesce(p_operations_manager_name, '')), '');
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
  if p_name is null or length(trim(p_name)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;
  if normalized_address is not null and length(normalized_address) not between 2 and 300 then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
  end if;
  if normalized_business_number is not null
    and normalized_business_number !~ '^[0-9]{10}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_BUSINESS_NUMBER';
  end if;
  if normalized_contact_name is not null and length(normalized_contact_name) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_CONTACT_NAME';
  end if;
  if normalized_contact_email is not null
    and normalized_contact_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  then
    raise exception using errcode = '22023', message = 'INVALID_CONTACT_EMAIL';
  end if;
  if normalized_operations_manager_name is not null
    and length(normalized_operations_manager_name) > 100
  then
    raise exception using errcode = '22023', message = 'INVALID_OPERATIONS_MANAGER_NAME';
  end if;
  if normalized_operations_manager_email is not null
    and normalized_operations_manager_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  then
    raise exception using errcode = '22023', message = 'INVALID_OPERATIONS_MANAGER_EMAIL';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  generated_slug := 'mc-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
  generated_management_code :=
    'MC-' || to_char(now(), 'YYYYMM') || '-' ||
    lpad(nextval('public.management_company_code_seq')::text, 6, '0');

  insert into public.tenants (name, slug, status)
  values (trim(p_name), generated_slug, 'ACTIVE')
  returning * into created_tenant;

  insert into public.management_companies (
    tenant_id,
    name,
    management_code,
    address,
    business_number,
    representative_phone_encrypted,
    contact_name,
    contact_phone_encrypted,
    contact_email,
    operations_manager_name,
    operations_manager_phone_encrypted,
    operations_manager_email
  )
  values (
    created_tenant.id,
    trim(p_name),
    generated_management_code,
    normalized_address,
    normalized_business_number,
    nullif(trim(coalesce(p_representative_phone_encrypted, '')), ''),
    normalized_contact_name,
    nullif(trim(coalesce(p_contact_phone_encrypted, '')), ''),
    normalized_contact_email,
    normalized_operations_manager_name,
    nullif(trim(coalesce(p_operations_manager_phone_encrypted, '')), ''),
    normalized_operations_manager_email
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
      'representativePhonePresent', created_company.representative_phone_encrypted is not null,
      'contactName', created_company.contact_name,
      'contactPhonePresent', created_company.contact_phone_encrypted is not null,
      'contactEmail', created_company.contact_email,
      'operationsManagerName', created_company.operations_manager_name,
      'operationsManagerPhonePresent',
        created_company.operations_manager_phone_encrypted is not null,
      'operationsManagerEmail', created_company.operations_manager_email,
      'status', created_company.status::text,
      'version', created_company.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'id', created_company.id,
    'tenantId', created_company.tenant_id,
    'version', created_company.version
  );
end;
$$;

revoke all on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
)
from public, anon;

grant execute on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
)
to authenticated, service_role;

comment on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
) is
'Platform-only management company registration. Creates the tenant boundary, assigns an operator code, stores operating contacts, and writes an audit row.';

comment on column public.management_companies.representative_phone_encrypted is
'Encrypted public operating representative phone for management-company administration.';
comment on column public.management_companies.contact_email is
'Primary operating contact email for management-company administration.';
comment on column public.management_companies.operations_manager_name is
'Named operations manager for management-company administration.';
comment on column public.management_companies.operations_manager_phone_encrypted is
'Encrypted operations manager phone for management-company administration.';
comment on column public.management_companies.operations_manager_email is
'Operations manager email for management-company administration.';

commit;
