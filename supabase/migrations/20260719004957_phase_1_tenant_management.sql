begin;

-- Tenant mutations are command-only. Browser sessions retain scoped reads but
-- cannot bypass Application Service validation, optimistic locking, or audit.
revoke insert, update on table public.tenants from authenticated;

drop policy if exists tenants_insert_platform on public.tenants;
drop policy if exists tenants_update_platform on public.tenants;

create or replace function public.create_tenant(
  p_name text,
  p_slug text,
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
  created_tenant public.tenants%rowtype;
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
  if p_slug is null
    or length(trim(p_slug)) not between 2 and 63
    or lower(trim(p_slug)) !~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'
  then
    raise exception using errcode = '22023', message = 'INVALID_SLUG';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  insert into public.tenants (name, slug)
  values (trim(p_name), lower(trim(p_slug)))
  returning * into created_tenant;

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
    created_tenant.id,
    'ADMIN',
    actor_user_id,
    'TENANT_CREATED',
    'TENANT',
    created_tenant.id,
    jsonb_build_object(
      'name', created_tenant.name,
      'slug', created_tenant.slug,
      'status', created_tenant.status::text,
      'version', created_tenant.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', created_tenant.id, 'version', created_tenant.version);
end;
$$;

create or replace function public.update_tenant(
  p_tenant_id uuid,
  p_expected_version integer,
  p_name text,
  p_slug text,
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
  before_tenant public.tenants%rowtype;
  updated_tenant public.tenants%rowtype;
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
  if p_tenant_id is null then
    raise exception using errcode = '22023', message = 'INVALID_TENANT_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;
  if p_slug is null
    or length(trim(p_slug)) not between 2 and 63
    or lower(trim(p_slug)) !~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'
  then
    raise exception using errcode = '22023', message = 'INVALID_SLUG';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  select *
  into before_tenant
  from public.tenants
  where id = p_tenant_id
    and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'TENANT_NOT_FOUND';
  end if;
  if before_tenant.status = 'CLOSED' then
    raise exception using errcode = 'P0001', message = 'TENANT_CLOSED';
  end if;

  update public.tenants
  set
    name = trim(p_name),
    slug = lower(trim(p_slug))
  where id = p_tenant_id
    and version = p_expected_version
    and deleted_at is null
  returning * into updated_tenant;

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
    updated_tenant.id,
    'ADMIN',
    actor_user_id,
    'TENANT_UPDATED',
    'TENANT',
    updated_tenant.id,
    jsonb_build_object(
      'name', before_tenant.name,
      'slug', before_tenant.slug,
      'status', before_tenant.status::text,
      'version', before_tenant.version
    ),
    jsonb_build_object(
      'name', updated_tenant.name,
      'slug', updated_tenant.slug,
      'status', updated_tenant.status::text,
      'version', updated_tenant.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', updated_tenant.id, 'version', updated_tenant.version);
end;
$$;

create or replace function public.change_tenant_status(
  p_tenant_id uuid,
  p_expected_version integer,
  p_next_status public.tenant_status,
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
  before_tenant public.tenants%rowtype;
  updated_tenant public.tenants%rowtype;
  audit_action text;
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
  if p_tenant_id is null then
    raise exception using errcode = '22023', message = 'INVALID_TENANT_ID';
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

  select *
  into before_tenant
  from public.tenants
  where id = p_tenant_id
    and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'TENANT_NOT_FOUND';
  end if;
  if not (
    (before_tenant.status = 'ACTIVE' and p_next_status in ('SUSPENDED', 'CLOSED'))
    or (before_tenant.status = 'SUSPENDED' and p_next_status in ('ACTIVE', 'CLOSED'))
  ) then
    raise exception using errcode = '22023', message = 'INVALID_STATUS_TRANSITION';
  end if;

  update public.tenants
  set status = p_next_status
  where id = p_tenant_id
    and version = p_expected_version
    and deleted_at is null
  returning * into updated_tenant;

  if not found then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  audit_action := case updated_tenant.status
    when 'ACTIVE' then 'TENANT_REACTIVATED'
    when 'SUSPENDED' then 'TENANT_SUSPENDED'
    when 'CLOSED' then 'TENANT_CLOSED'
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
    updated_tenant.id,
    'ADMIN',
    actor_user_id,
    audit_action,
    'TENANT',
    updated_tenant.id,
    jsonb_build_object('status', before_tenant.status::text, 'version', before_tenant.version),
    jsonb_build_object('status', updated_tenant.status::text, 'version', updated_tenant.version),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', updated_tenant.id, 'version', updated_tenant.version);
end;
$$;

revoke all on function public.create_tenant(text, text, text, uuid)
from public, anon;
revoke all on function public.update_tenant(uuid, integer, text, text, text, uuid)
from public, anon;
revoke all on function public.change_tenant_status(uuid, integer, public.tenant_status, text, uuid)
from public, anon;

grant execute on function public.create_tenant(text, text, text, uuid)
to authenticated, service_role;
grant execute on function public.update_tenant(uuid, integer, text, text, text, uuid)
to authenticated, service_role;
grant execute on function public.change_tenant_status(uuid, integer, public.tenant_status, text, uuid)
to authenticated, service_role;

comment on function public.create_tenant(text, text, text, uuid) is
  'AAL2 Super Admin command: atomically creates a Tenant and redacted audit row.';
comment on function public.update_tenant(uuid, integer, text, text, text, uuid) is
  'AAL2 Super Admin command: optimistically updates Tenant identity and audit.';
comment on function public.change_tenant_status(uuid, integer, public.tenant_status, text, uuid) is
  'AAL2 Super Admin command: applies Tenant lifecycle transition and audit.';

commit;
