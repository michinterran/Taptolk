begin;

create or replace function public.list_due_privacy_cleanup_tenants(
  p_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVER_ROLE_REQUIRED';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_LIMIT';
  end if;

  with latest_runs as (
    select
      run.tenant_id,
      max(run.started_at) as last_started_at
    from public.privacy_cleanup_runs as run
    group by run.tenant_id
  ),
  due_tenants as (
    select tenant.id, latest.last_started_at
    from public.tenants as tenant
    left join latest_runs as latest on latest.tenant_id = tenant.id
    where tenant.status = 'ACTIVE'
      and tenant.deleted_at is null
      and not exists (
        select 1
        from public.privacy_cleanup_runs as current_run
        where current_run.tenant_id = tenant.id
          and current_run.started_at >= date_trunc('hour', statement_timestamp())
      )
    order by
      latest.last_started_at asc nulls first,
      tenant.id asc
    limit p_limit
  )
  select jsonb_build_object(
    'tenant_ids',
    coalesce(jsonb_agg(due.id order by due.last_started_at asc nulls first, due.id asc), '[]'::jsonb)
  )
  into result
  from due_tenants as due;

  return result;
end;
$$;

revoke all on function public.list_due_privacy_cleanup_tenants(integer)
from public, anon, authenticated;
grant execute on function public.list_due_privacy_cleanup_tenants(integer)
to service_role;

comment on function public.list_due_privacy_cleanup_tenants(integer)
is 'Lists a bounded oldest-due set of active tenant ids for the server-only privacy cleanup scheduler.';

commit;
