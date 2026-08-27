begin;

drop function if exists public.update_management_company(
  uuid, integer, text, text, text, text, text, uuid
);
drop function if exists public.update_management_company(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, uuid
);

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
      'businessNumberRegistered', created_company.business_number is not null,
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

create or replace function public.update_management_company(
  p_company_id uuid,
  p_expected_version integer,
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
  before_company public.management_companies%rowtype;
  updated_company public.management_companies%rowtype;
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
  if p_company_id is null then
    raise exception using errcode = '22023', message = 'INVALID_COMPANY_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
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
    address = normalized_address,
    business_number = coalesce(normalized_business_number, before_company.business_number),
    representative_phone_encrypted =
      coalesce(
        nullif(trim(coalesce(p_representative_phone_encrypted, '')), ''),
        before_company.representative_phone_encrypted
      ),
    contact_name = normalized_contact_name,
    contact_phone_encrypted =
      coalesce(
        nullif(trim(coalesce(p_contact_phone_encrypted, '')), ''),
        before_company.contact_phone_encrypted
      ),
    contact_email = normalized_contact_email,
    operations_manager_name = normalized_operations_manager_name,
    operations_manager_phone_encrypted =
      coalesce(
        nullif(trim(coalesce(p_operations_manager_phone_encrypted, '')), ''),
        before_company.operations_manager_phone_encrypted
      ),
    operations_manager_email = normalized_operations_manager_email
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
      'businessNumberRegistered', before_company.business_number is not null,
      'representativePhonePresent', before_company.representative_phone_encrypted is not null,
      'contactName', before_company.contact_name,
      'contactPhonePresent', before_company.contact_phone_encrypted is not null,
      'contactEmail', before_company.contact_email,
      'operationsManagerName', before_company.operations_manager_name,
      'operationsManagerPhonePresent',
        before_company.operations_manager_phone_encrypted is not null,
      'operationsManagerEmail', before_company.operations_manager_email,
      'status', before_company.status::text,
      'version', before_company.version
    ),
    jsonb_build_object(
      'tenantId', updated_company.tenant_id,
      'name', updated_company.name,
      'managementCode', updated_company.management_code,
      'addressPresent', updated_company.address is not null,
      'businessNumberRegistered', updated_company.business_number is not null,
      'representativePhonePresent', updated_company.representative_phone_encrypted is not null,
      'contactName', updated_company.contact_name,
      'contactPhonePresent', updated_company.contact_phone_encrypted is not null,
      'contactEmail', updated_company.contact_email,
      'operationsManagerName', updated_company.operations_manager_name,
      'operationsManagerPhonePresent',
        updated_company.operations_manager_phone_encrypted is not null,
      'operationsManagerEmail', updated_company.operations_manager_email,
      'status', updated_company.status::text,
      'version', updated_company.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', updated_company.id, 'version', updated_company.version);
end;
$$;

revoke all on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
)
from public, anon;
revoke all on function public.update_management_company(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, uuid
)
from public, anon;

grant execute on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
)
to authenticated, service_role;
grant execute on function public.update_management_company(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, uuid
)
to authenticated, service_role;

comment on function public.update_management_company(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, uuid
) is
'Platform-only management company update. The server-owned management code is immutable; protected contact values are replaced only when a new encrypted value is provided.';

commit;
