begin;

alter table public.admin_memberships
  add column if not exists invitation_expires_at timestamptz;

create index if not exists idx_admin_memberships_invited_by_status
  on public.admin_memberships (invited_by, status, created_at desc);

create or replace function public.create_admin_account_invitation(
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
  existing_profile_status public.admin_profile_status;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
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

  if p_target_user_id is null or not exists (
    select 1 from auth.users as target_user where target_user.id = p_target_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_NOT_FOUND';
  end if;

  if p_target_user_id = actor_user_id then
    raise exception using errcode = '42501', message = 'SELF_ACTION_FORBIDDEN';
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
    join public.tenants as target_tenant on target_tenant.id = target_company.tenant_id
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
    join public.tenants as target_tenant on target_tenant.id = target_site.tenant_id
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

  if exists (
    select 1
    from public.admin_memberships as existing_membership
    where existing_membership.user_id = p_target_user_id
      and existing_membership.status in ('INVITED', 'ACTIVE')
  ) then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_ALREADY_EXISTS';
  end if;

  select profile.status
  into existing_profile_status
  from public.admin_profiles as profile
  where profile.user_id = p_target_user_id
  for update;

  if existing_profile_status is not null and existing_profile_status <> 'INVITED' then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ALREADY_DECIDED';
  end if;

  insert into public.admin_profiles (user_id, display_name, status)
  values (p_target_user_id, trim(p_display_name), 'INVITED')
  on conflict (user_id) do update
  set display_name = excluded.display_name,
      status = 'INVITED',
      updated_at = now(),
      version = public.admin_profiles.version + 1
  where public.admin_profiles.status = 'INVITED';

  get diagnostics affected_profile_count = row_count;
  if affected_profile_count <> 1 then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ALREADY_DECIDED';
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
    accepted_at,
    invitation_expires_at
  )
  values (
    created_membership_id,
    p_target_user_id,
    p_tenant_id,
    p_management_company_id,
    p_site_id,
    p_role,
    p_scope_type,
    'INVITED',
    actor_user_id,
    null,
    now() + interval '7 days'
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
    'ADMIN_ACCOUNT_INVITED',
    'ADMIN_PROFILE',
    p_target_user_id,
    jsonb_build_object('profileStatus', coalesce(existing_profile_status::text, 'ABSENT')),
    jsonb_build_object(
      'profileStatus', 'INVITED',
      'membershipStatus', 'INVITED',
      'role', p_role::text,
      'scopeType', p_scope_type::text,
      'invitationExpiresInDays', 7
    ),
    trim(p_reason),
    p_request_id
  );

  return created_membership_id;
end;
$$;

create or replace function public.accept_admin_account_invitation(
  p_membership_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_user_id uuid := auth.uid();
  invitation_user_id uuid;
  invitation_tenant_id uuid;
  invitation_site_id uuid;
  invitation_status public.admin_membership_status;
  invitation_expires_at timestamptz;
  profile_status public.admin_profile_status;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select membership.user_id,
         membership.tenant_id,
         membership.site_id,
         membership.status,
         membership.invitation_expires_at
  into invitation_user_id,
       invitation_tenant_id,
       invitation_site_id,
       invitation_status,
       invitation_expires_at
  from public.admin_memberships as membership
  where membership.id = p_membership_id
  for update;

  if invitation_user_id is null then
    raise exception using errcode = 'P0001', message = 'INVITATION_NOT_FOUND';
  end if;
  if invitation_user_id <> actor_user_id then
    raise exception using errcode = '42501', message = 'INVITATION_FORBIDDEN';
  end if;
  if invitation_status <> 'INVITED' then
    raise exception using errcode = 'P0001', message = 'INVITATION_ALREADY_DECIDED';
  end if;
  if invitation_expires_at is null or invitation_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'INVITATION_EXPIRED';
  end if;

  select profile.status
  into profile_status
  from public.admin_profiles as profile
  where profile.user_id = actor_user_id
  for update;

  if profile_status <> 'INVITED' then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ALREADY_DECIDED';
  end if;

  update public.admin_memberships
  set status = 'ACTIVE',
      accepted_at = now(),
      invitation_expires_at = null,
      updated_at = now(),
      version = version + 1
  where id = p_membership_id;

  update public.admin_profiles
  set status = 'ACTIVE',
      updated_at = now(),
      version = version + 1
  where user_id = actor_user_id;

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
    invitation_tenant_id,
    invitation_site_id,
    'ADMIN',
    actor_user_id,
    'ADMIN_ACCOUNT_INVITATION_ACCEPTED',
    'ADMIN_MEMBERSHIP',
    p_membership_id,
    jsonb_build_object('membershipStatus', 'INVITED', 'profileStatus', 'INVITED'),
    jsonb_build_object('membershipStatus', 'ACTIVE', 'profileStatus', 'ACTIVE'),
    'Invitation accepted by the invited administrator.',
    gen_random_uuid()
  );

  return p_membership_id;
end;
$$;

revoke all on function public.create_admin_account_invitation(
  uuid, text, public.admin_role, public.admin_scope_type, uuid, uuid, uuid, text, uuid
) from public;
grant execute on function public.create_admin_account_invitation(
  uuid, text, public.admin_role, public.admin_scope_type, uuid, uuid, uuid, text, uuid
) to authenticated, service_role;

revoke all on function public.accept_admin_account_invitation(uuid) from public;
grant execute on function public.accept_admin_account_invitation(uuid) to authenticated, service_role;

comment on function public.create_admin_account_invitation(
  uuid, text, public.admin_role, public.admin_scope_type, uuid, uuid, uuid, text, uuid
) is 'Creates a scoped administrator invitation without exposing invitation secrets to the browser.';

comment on function public.accept_admin_account_invitation(uuid) is
  'Atomically activates the authenticated invited administrator and membership.';

commit;
