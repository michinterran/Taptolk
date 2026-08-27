begin;

create or replace function public.read_admin_account_directory()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'authenticated' or not exists (
    select 1 from public.admin_profiles as profile
    join public.admin_memberships as membership on membership.user_id = profile.user_id
    where profile.user_id = auth.uid()
      and profile.status = 'ACTIVE'
      and membership.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_DIRECTORY_NOT_ALLOWED';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'membership_id', membership.id,
      'user_id', membership.user_id,
      'display_name', profile.display_name,
      'profile_status', profile.status,
      'role', membership.role,
      'scope_type', membership.scope_type,
      'membership_status', membership.status,
      'tenant_id', membership.tenant_id,
      'tenant_name', tenant.name,
      'management_company_id', membership.management_company_id,
      'management_company_name', company.name,
      'site_id', membership.site_id,
      'site_name', site.name,
      'version', membership.version,
      'created_at', membership.created_at
    ) order by profile.display_name, membership.created_at
  ), '[]'::jsonb) into result
  from public.admin_memberships as membership
  join public.admin_profiles as profile on profile.user_id = membership.user_id
  left join public.tenants as tenant on tenant.id = membership.tenant_id
  left join public.management_companies as company
    on company.tenant_id = membership.tenant_id
    and company.id = membership.management_company_id
  left join public.sites as site
    on site.tenant_id = membership.tenant_id and site.id = membership.site_id
  where membership.user_id = auth.uid()
    or (
      membership.scope_type = 'PLATFORM'
      and exists (
        select 1 from public.admin_memberships as actor
        where actor.user_id = auth.uid()
          and actor.role = 'SUPER_ADMIN'
          and actor.scope_type = 'PLATFORM'
          and actor.status = 'ACTIVE'
      )
    )
    or (
      membership.tenant_id is not null
      and app_private.current_admin_has_scope(
        membership.tenant_id,
        membership.management_company_id,
        membership.site_id,
        array['SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
      )
    );

  return result;
end;
$$;

create or replace function public.update_admin_membership_assignment(
  p_membership_id uuid,
  p_expected_version integer,
  p_role public.admin_role,
  p_scope_type public.admin_scope_type,
  p_tenant_id uuid,
  p_management_company_id uuid,
  p_site_id uuid,
  p_status public.admin_membership_status,
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
  target public.admin_memberships%rowtype;
  actor_is_super boolean;
begin
  select * into target from public.admin_memberships where id = p_membership_id for update;
  actor_is_super := exists (
    select 1 from public.admin_memberships as actor
    join public.admin_profiles as profile on profile.user_id = actor.user_id
    where actor.user_id = actor_user_id
      and actor.role = 'SUPER_ADMIN'
      and actor.scope_type = 'PLATFORM'
      and actor.status = 'ACTIVE'
      and profile.status = 'ACTIVE'
  );

  if actor_user_id is null or target.id is null or target.user_id = actor_user_id
    or p_status not in ('ACTIVE', 'SUSPENDED', 'REVOKED')
    or p_reason is null or length(trim(p_reason)) not between 3 and 500
    or p_request_id is null
    or (
      not actor_is_super
      and (
        target.tenant_id is null
        or not app_private.current_admin_has_scope(
          target.tenant_id,
          target.management_company_id,
          target.site_id,
          array['MANAGEMENT_ADMIN', 'SITE_ADMIN']
        )
        or p_tenant_id is null
        or not app_private.current_admin_has_scope(
          p_tenant_id,
          p_management_company_id,
          p_site_id,
          array['MANAGEMENT_ADMIN', 'SITE_ADMIN']
        )
        or p_role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN')
      )
    )
  then
    raise exception using errcode = '42501', message = 'ADMIN_ASSIGNMENT_NOT_ALLOWED';
  end if;

  update public.admin_memberships
  set role = p_role,
      scope_type = p_scope_type,
      tenant_id = p_tenant_id,
      management_company_id = p_management_company_id,
      site_id = p_site_id,
      status = p_status
  where id = p_membership_id and version = p_expected_version;

  if not found then
    raise exception using errcode = '40001', message = 'ADMIN_ASSIGNMENT_CONFLICT';
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
  ) values (
    p_tenant_id,
    p_site_id,
    'ADMIN',
    actor_user_id,
    'ADMIN_MEMBERSHIP_ASSIGNMENT_UPDATED',
    'ADMIN_MEMBERSHIP',
    p_membership_id,
    jsonb_build_object(
      'role', target.role,
      'scopeType', target.scope_type,
      'status', target.status,
      'managementCompanyId', target.management_company_id,
      'siteId', target.site_id
    ),
    jsonb_build_object(
      'role', p_role,
      'scopeType', p_scope_type,
      'status', p_status,
      'managementCompanyId', p_management_company_id,
      'siteId', p_site_id
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', p_membership_id, 'status', p_status);
end;
$$;

create or replace function public.update_current_admin_profile(
  p_display_name text,
  p_expected_version integer,
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
  current_profile public.admin_profiles%rowtype;
  audit_tenant_id uuid;
begin
  select * into current_profile
  from public.admin_profiles
  where user_id = actor_user_id
  for update;

  if actor_user_id is null
    or current_profile.user_id is null
    or p_display_name is null
    or length(trim(p_display_name)) not between 1 and 100
    or p_reason is null
    or length(trim(p_reason)) not between 3 and 500
    or p_request_id is null
  then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_PROFILE';
  end if;

  update public.admin_profiles
  set display_name = trim(p_display_name)
  where user_id = actor_user_id and version = p_expected_version;

  if not found then
    raise exception using errcode = '40001', message = 'ADMIN_PROFILE_CONFLICT';
  end if;

  select tenant_id into audit_tenant_id
  from public.admin_memberships
  where user_id = actor_user_id and status = 'ACTIVE' and tenant_id is not null
  order by created_at
  limit 1;

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
  ) values (
    audit_tenant_id,
    'ADMIN',
    actor_user_id,
    'ADMIN_PROFILE_UPDATED',
    'ADMIN_PROFILE',
    actor_user_id,
    jsonb_build_object('displayName', current_profile.display_name),
    jsonb_build_object('displayName', trim(p_display_name)),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('userId', actor_user_id, 'displayName', trim(p_display_name));
end;
$$;

revoke all on function public.read_admin_account_directory() from public, anon;
grant execute on function public.read_admin_account_directory() to authenticated;

revoke all on function public.update_admin_membership_assignment(
  uuid, integer, public.admin_role, public.admin_scope_type, uuid, uuid, uuid,
  public.admin_membership_status, text, uuid
) from public, anon, authenticated;
grant execute on function public.update_admin_membership_assignment(
  uuid, integer, public.admin_role, public.admin_scope_type, uuid, uuid, uuid,
  public.admin_membership_status, text, uuid
) to authenticated;

revoke all on function public.update_current_admin_profile(text, integer, text, uuid)
from public, anon, authenticated;
grant execute on function public.update_current_admin_profile(text, integer, text, uuid)
to authenticated;

commit;
