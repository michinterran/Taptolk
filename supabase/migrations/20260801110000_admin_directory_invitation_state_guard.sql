begin;

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
    or p_status = 'INVITED'
    or (target.status = 'INVITED' and p_status <> 'REVOKED')
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

comment on function public.update_admin_membership_assignment(
  uuid, integer, public.admin_role, public.admin_scope_type, uuid, uuid, uuid,
  public.admin_membership_status, text, uuid
) is 'Updates an existing admin assignment. Invitation acceptance remains a separate authenticated lifecycle transition.';

commit;
