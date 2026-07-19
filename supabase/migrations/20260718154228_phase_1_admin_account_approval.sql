begin;

create or replace function public.approve_admin_account(
  p_target_user_id uuid,
  p_display_name text,
  p_role public.admin_role,
  p_scope_type public.admin_scope_type,
  p_tenant_id uuid,
  p_management_company_id uuid,
  p_site_id uuid,
  p_reason text,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_user_id uuid := auth.uid();
  created_membership_id uuid := gen_random_uuid();
  affected_profile_count integer;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;

  if p_target_user_id is null or not exists (
    select 1
    from public.admin_memberships as actor_membership
    where actor_membership.user_id = actor_user_id
      and actor_membership.role = 'SUPER_ADMIN'
      and actor_membership.scope_type = 'PLATFORM'
      and actor_membership.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'ROLE_FORBIDDEN';
  end if;

  if p_target_user_id = actor_user_id then
    raise exception using errcode = '42501', message = 'SELF_ACTION_FORBIDDEN';
  end if;

  if not exists (
    select 1
    from auth.users as target_user
    where target_user.id = p_target_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_NOT_FOUND';
  end if;

  if p_display_name is null or length(trim(p_display_name)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_DISPLAY_NAME';
  end if;

  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  if not (
    (
      p_role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
      and p_scope_type = 'PLATFORM'
      and p_tenant_id is null
      and p_management_company_id is null
      and p_site_id is null
    )
    or (
      p_role = 'MANAGEMENT_ADMIN'
      and p_scope_type = 'MANAGEMENT_COMPANY'
      and p_tenant_id is not null
      and p_management_company_id is not null
      and p_site_id is null
    )
    or (
      p_role in ('SITE_ADMIN', 'SITE_OPERATOR')
      and p_scope_type = 'SITE'
      and p_tenant_id is not null
      and p_management_company_id is not null
      and p_site_id is not null
    )
    or (
      p_role = 'READ_ONLY'
      and (
        (
          p_scope_type = 'TENANT'
          and p_tenant_id is not null
          and p_management_company_id is null
          and p_site_id is null
        )
        or (
          p_scope_type = 'MANAGEMENT_COMPANY'
          and p_tenant_id is not null
          and p_management_company_id is not null
          and p_site_id is null
        )
        or (
          p_scope_type = 'SITE'
          and p_tenant_id is not null
          and p_management_company_id is not null
          and p_site_id is not null
        )
      )
    )
  ) then
    raise exception using errcode = '22023', message = 'INVALID_SCOPE';
  end if;

  if p_scope_type = 'TENANT' and not exists (
    select 1
    from public.tenants as target_tenant
    where target_tenant.id = p_tenant_id
      and target_tenant.status = 'ACTIVE'
      and target_tenant.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INACTIVE_OR_INVALID_SCOPE';
  end if;

  if p_scope_type = 'MANAGEMENT_COMPANY' and not exists (
    select 1
    from public.management_companies as target_company
    join public.tenants as target_tenant
      on target_tenant.id = target_company.tenant_id
    where target_company.id = p_management_company_id
      and target_company.tenant_id = p_tenant_id
      and target_company.status = 'ACTIVE'
      and target_company.deleted_at is null
      and target_tenant.status = 'ACTIVE'
      and target_tenant.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INACTIVE_OR_INVALID_SCOPE';
  end if;

  if p_scope_type = 'SITE' and not exists (
    select 1
    from public.sites as target_site
    join public.management_companies as target_company
      on target_company.tenant_id = target_site.tenant_id
      and target_company.id = target_site.management_company_id
    join public.tenants as target_tenant
      on target_tenant.id = target_site.tenant_id
    where target_site.id = p_site_id
      and target_site.tenant_id = p_tenant_id
      and target_site.management_company_id = p_management_company_id
      and target_site.status = 'ACTIVE'
      and target_site.deleted_at is null
      and target_company.status = 'ACTIVE'
      and target_company.deleted_at is null
      and target_tenant.status = 'ACTIVE'
      and target_tenant.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INACTIVE_OR_INVALID_SCOPE';
  end if;

  insert into public.admin_profiles as profile (
    user_id,
    display_name,
    status
  )
  values (
    p_target_user_id,
    trim(p_display_name),
    'ACTIVE'
  )
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    status = 'ACTIVE'
  where profile.status = 'INVITED';

  get diagnostics affected_profile_count = row_count;
  if affected_profile_count <> 1 then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ALREADY_DECIDED';
  end if;

  if exists (
    select 1
    from public.admin_memberships as existing_membership
    where existing_membership.user_id = p_target_user_id
      and existing_membership.status in ('INVITED', 'ACTIVE')
  ) then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_ALREADY_EXISTS';
  end if;

  insert into public.admin_memberships (
    id,
    user_id,
    tenant_id,
    management_company_id,
    site_id,
    role,
    scope_type,
    status,
    invited_by,
    accepted_at
  )
  values (
    created_membership_id,
    p_target_user_id,
    p_tenant_id,
    p_management_company_id,
    p_site_id,
    p_role,
    p_scope_type,
    'ACTIVE',
    actor_user_id,
    now()
  );

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
    p_tenant_id,
    p_site_id,
    'ADMIN',
    actor_user_id,
    'ADMIN_ACCOUNT_APPROVED',
    'ADMIN_PROFILE',
    p_target_user_id,
    jsonb_build_object('profileStatus', 'PENDING'),
    jsonb_build_object(
      'profileStatus', 'ACTIVE',
      'role', p_role::text,
      'scopeType', p_scope_type::text
    ),
    trim(p_reason),
    p_request_id
  );

  return created_membership_id;
end;
$$;

create or replace function public.reject_admin_account(
  p_target_user_id uuid,
  p_display_name text,
  p_reason text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_user_id uuid := auth.uid();
  affected_profile_count integer;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;

  if p_target_user_id is null or not exists (
    select 1
    from public.admin_memberships as actor_membership
    where actor_membership.user_id = actor_user_id
      and actor_membership.role = 'SUPER_ADMIN'
      and actor_membership.scope_type = 'PLATFORM'
      and actor_membership.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'ROLE_FORBIDDEN';
  end if;

  if p_target_user_id = actor_user_id then
    raise exception using errcode = '42501', message = 'SELF_ACTION_FORBIDDEN';
  end if;

  if not exists (
    select 1
    from auth.users as target_user
    where target_user.id = p_target_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_NOT_FOUND';
  end if;

  if p_display_name is null or length(trim(p_display_name)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_DISPLAY_NAME';
  end if;

  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  insert into public.admin_profiles as profile (
    user_id,
    display_name,
    status
  )
  values (
    p_target_user_id,
    trim(p_display_name),
    'CLOSED'
  )
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    status = 'CLOSED'
  where profile.status = 'INVITED';

  get diagnostics affected_profile_count = row_count;
  if affected_profile_count <> 1 then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ALREADY_DECIDED';
  end if;

  update public.admin_memberships
  set status = 'REVOKED'
  where user_id = p_target_user_id
    and status = 'INVITED';

  insert into public.audit_logs (
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
    'ADMIN',
    actor_user_id,
    'ADMIN_ACCOUNT_REJECTED',
    'ADMIN_PROFILE',
    p_target_user_id,
    jsonb_build_object('profileStatus', 'PENDING'),
    jsonb_build_object('profileStatus', 'CLOSED'),
    trim(p_reason),
    p_request_id
  );
end;
$$;

revoke all on function public.approve_admin_account(
  uuid,
  text,
  public.admin_role,
  public.admin_scope_type,
  uuid,
  uuid,
  uuid,
  text,
  uuid
) from public, anon;
revoke all on function public.reject_admin_account(uuid, text, text, uuid)
from public, anon;

grant execute on function public.approve_admin_account(
  uuid,
  text,
  public.admin_role,
  public.admin_scope_type,
  uuid,
  uuid,
  uuid,
  text,
  uuid
) to authenticated, service_role;
grant execute on function public.reject_admin_account(uuid, text, text, uuid)
to authenticated, service_role;

comment on function public.approve_admin_account(
  uuid,
  text,
  public.admin_role,
  public.admin_scope_type,
  uuid,
  uuid,
  uuid,
  text,
  uuid
) is
  'Atomic admin approval command. Revalidates AAL2 and active platform Super Admin membership.';
comment on function public.reject_admin_account(uuid, text, text, uuid) is
  'Atomic admin rejection command. Preserves the Auth identity and records a redacted audit event.';

commit;
