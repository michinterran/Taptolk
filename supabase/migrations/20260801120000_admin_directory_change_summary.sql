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
    select 1
    from public.admin_profiles as profile
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
      'created_at', membership.created_at,
      'last_changed_at', latest_change.created_at,
      'last_changed_action', latest_change.action,
      'last_changed_by_display_name', latest_change.actor_display_name
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
  left join lateral (
    select
      audit.created_at,
      audit.action,
      actor_profile.display_name as actor_display_name
    from public.audit_logs as audit
    left join public.admin_profiles as actor_profile on actor_profile.user_id = audit.actor_id
    where (
      audit.resource_type = 'ADMIN_MEMBERSHIP'
      and audit.resource_id = membership.id
    ) or (
      audit.resource_type = 'ADMIN_PROFILE'
      and audit.resource_id = membership.user_id
      and audit.action in (
        'ADMIN_ACCOUNT_APPROVED',
        'ADMIN_ACCOUNT_INVITED',
        'ADMIN_ACCOUNT_REJECTED'
      )
    )
    order by audit.created_at desc
    limit 1
  ) as latest_change on true
  where membership.user_id = auth.uid()
    or (
      membership.scope_type = 'PLATFORM'
      and exists (
        select 1
        from public.admin_memberships as actor
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

comment on function public.read_admin_account_directory() is
  'Returns the server-authorized administrator directory with a redacted latest change summary.';

commit;
