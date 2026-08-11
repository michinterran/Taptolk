begin;

-- Keep the existing rolling-window RPC for other console surfaces. The operations
-- route uses this range-aware read model so custom periods remain truthful.
create or replace function public.read_operations_command_center_by_range(
  p_management_company_id uuid default null,
  p_site_id uuid default null,
  p_start_date date default current_date - 13,
  p_end_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  requested_days integer := p_end_date - p_start_date + 1;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'OPERATIONS_COMMAND_CENTER_NOT_ALLOWED';
  end if;
  if p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date
    or p_end_date > current_date
    or requested_days not between 1 and 90 then
    raise exception using errcode = '22023', message = 'INVALID_OPERATIONS_RANGE';
  end if;

  with visible_sites as materialized (
    select site.tenant_id, site.id, site.management_company_id, site.name
    from public.sites as site
    join public.management_companies as company
      on company.tenant_id = site.tenant_id
      and company.id = site.management_company_id
    join public.tenants as tenant
      on tenant.id = site.tenant_id
    where site.deleted_at is null
      and company.deleted_at is null
      and tenant.deleted_at is null
      and site.is_test_fixture = false
      and company.is_test_fixture = false
      and tenant.is_test_fixture = false
      and (p_management_company_id is null or site.management_company_id = p_management_company_id)
      and (p_site_id is null or site.id = p_site_id)
      and app_private.current_admin_has_site_scope(
        site.tenant_id,
        site.id,
        array[
          'SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN',
          'SITE_ADMIN', 'SITE_OPERATOR', 'READ_ONLY'
        ]
      )
  ),
  current_sessions as materialized (
    select session.*
    from public.contact_sessions as session
    join visible_sites as site
      on site.tenant_id = session.tenant_id and site.id = session.site_id
    where session.created_at >= statement_timestamp() - interval '24 hours'
  ),
  current_deliveries as materialized (
    select delivery.*
    from public.notification_deliveries as delivery
    join visible_sites as site
      on site.tenant_id = delivery.tenant_id and site.id = delivery.site_id
    where delivery.created_at >= statement_timestamp() - interval '24 hours'
  ),
  days as (
    select day::date as day
    from generate_series(p_start_date, p_end_date, interval '1 day') as day
  ),
  daily_sessions as (
    select session.created_at::date as day,
      count(*)::integer as contact_count,
      count(*) filter (
        where session.status not in ('RESOLVED', 'EXPIRED', 'BLOCKED', 'CANCELLED')
      )::integer as unresolved_count,
      count(*) filter (where session.status = 'ESCALATED')::integer as escalated_count
    from public.contact_sessions as session
    join visible_sites as site
      on site.tenant_id = session.tenant_id and site.id = session.site_id
    where session.created_at >= p_start_date
      and session.created_at < p_end_date + 1
    group by session.created_at::date
  ),
  daily_deliveries as (
    select delivery.created_at::date as day,
      count(*) filter (where delivery.status in ('SENT', 'DELIVERED'))::integer as sent_count,
      count(*) filter (where delivery.status = 'FAILED_FINAL')::integer as failed_count
    from public.notification_deliveries as delivery
    join visible_sites as site
      on site.tenant_id = delivery.tenant_id and site.id = delivery.site_id
    where delivery.created_at >= p_start_date
      and delivery.created_at < p_end_date + 1
    group by delivery.created_at::date
  ),
  daily_series as (
    select jsonb_agg(
      jsonb_build_object(
        'date', day.day,
        'contact_count', coalesce(session.contact_count, 0),
        'unresolved_count', coalesce(session.unresolved_count, 0),
        'escalated_count', coalesce(session.escalated_count, 0),
        'notification_sent_count', coalesce(delivery.sent_count, 0),
        'notification_failed_count', coalesce(delivery.failed_count, 0)
      ) order by day.day
    ) as value
    from days as day
    left join daily_sessions as session on session.day = day.day
    left join daily_deliveries as delivery on delivery.day = day.day
  ),
  site_performance as (
    select jsonb_agg(
      jsonb_build_object(
        'site_id', site.id,
        'site_name', site.name,
        'contact_count', coalesce(metric.contact_count, 0),
        'unresolved_count', coalesce(metric.unresolved_count, 0),
        'active_qr_count', coalesce(asset.active_qr_count, 0)
      ) order by coalesce(metric.unresolved_count, 0) desc,
        coalesce(metric.contact_count, 0) desc,
        site.name
    ) as value
    from visible_sites as site
    left join lateral (
      select count(*)::integer as contact_count,
        count(*) filter (
          where session.status not in ('RESOLVED', 'EXPIRED', 'BLOCKED', 'CANCELLED')
        )::integer as unresolved_count
      from public.contact_sessions as session
      where session.tenant_id = site.tenant_id
        and session.site_id = site.id
        and session.created_at >= p_start_date
        and session.created_at < p_end_date + 1
    ) as metric on true
    left join lateral (
      select count(*)::integer as active_qr_count
      from public.qr_assets as qr
      where qr.tenant_id = site.tenant_id and qr.site_id = site.id and qr.status = 'ACTIVE'
    ) as asset on true
  )
  select jsonb_build_object(
    'fresh_at', statement_timestamp(),
    'window_days', requested_days,
    'scope_management_company_name', (
      select company.name
      from public.management_companies as company
      where p_management_company_id is not null
        and company.id = p_management_company_id
        and company.is_test_fixture = false
        and exists (
          select 1 from visible_sites as site where site.management_company_id = company.id
        )
    ),
    'scope_site_name', (
      select site.name from visible_sites as site
      where p_site_id is not null and site.id = p_site_id
    ),
    'site_count', (select count(*)::integer from visible_sites),
    'contact_count', (select count(*)::integer from current_sessions),
    'unresolved_count', (select count(*)::integer from current_sessions
      where status not in ('RESOLVED', 'EXPIRED', 'BLOCKED', 'CANCELLED')),
    'escalated_count', (select count(*)::integer from current_sessions where status = 'ESCALATED'),
    'median_owner_response_ms', (select round(percentile_cont(0.5) within group (
      order by extract(epoch from (owner_replied_at - created_at)) * 1000
    ))::integer from current_sessions where owner_replied_at is not null),
    'notification_sent_count', (select count(*)::integer from current_deliveries
      where status in ('SENT', 'DELIVERED')),
    'notification_retry_count', (select count(*)::integer from current_deliveries
      where status = 'FAILED_RETRYABLE'),
    'notification_failed_count', (select count(*)::integer from current_deliveries
      where status = 'FAILED_FINAL'),
    'notification_recorded_cost', (select coalesce(sum(cost_amount), 0) from current_deliveries
      where status in ('SENT', 'DELIVERED')),
    'notification_missing_cost_count', (select count(*)::integer from current_deliveries
      where status in ('SENT', 'DELIVERED') and cost_amount is null),
    'open_report_count', (select count(*)::integer
      from public.contact_reports as report join visible_sites as site
      on site.tenant_id = report.tenant_id and site.id = report.site_id
      where report.status = 'OPEN'),
    'active_block_count', (select count(*)::integer
      from public.caller_blocks as block join visible_sites as site
      on site.tenant_id = block.tenant_id and site.id = block.site_id
      where block.revoked_at is null and block.expires_at > statement_timestamp()),
    'active_qr_count', (select count(*)::integer
      from public.qr_assets as asset join visible_sites as site
      on site.tenant_id = asset.tenant_id and site.id = asset.site_id
      where asset.status = 'ACTIVE'),
    'completed_batch_count', (select count(*)::integer
      from public.qr_batches as batch join visible_sites as site
      on site.tenant_id = batch.tenant_id and site.id = batch.site_id
      where batch.status in ('GENERATED', 'QUALITY_CHECKED', 'PRINT_FILE_READY', 'COMPLETED')),
    'latest_snapshot_at', (select max(snapshot.created_at)
      from public.operations_metric_snapshots as snapshot join visible_sites as site
      on site.tenant_id = snapshot.tenant_id and site.id = snapshot.site_id),
    'daily_series', coalesce((select value from daily_series), '[]'::jsonb),
    'site_performance', coalesce((select value from site_performance), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.read_operations_command_center_by_range(uuid, uuid, date, date)
from public, anon;
grant execute on function public.read_operations_command_center_by_range(uuid, uuid, date, date)
to authenticated;

comment on function public.read_operations_command_center_by_range(uuid, uuid, date, date) is
  'Returns authorized operations metrics for an explicit, non-fixture date range.';

-- Older local fixtures were created before the fixture flag migration. Their
-- stable E2E prefix is the migration boundary, not an application display rule.
update public.management_companies
set is_test_fixture = true
where is_test_fixture = false
  and name like 'Taptolk E2E %';

update public.tenants as tenant
set is_test_fixture = true
where tenant.is_test_fixture = false
  and exists (
    select 1
    from public.management_companies as company
    where company.tenant_id = tenant.id
      and company.is_test_fixture = true
      and company.name like 'Taptolk E2E %'
  );

update public.sites as site
set is_test_fixture = true
where site.is_test_fixture = false
  and exists (
    select 1
    from public.management_companies as company
    where company.id = site.management_company_id
      and company.is_test_fixture = true
  );

-- PostgREST caches the exposed function catalog. Refresh it for local and
-- hosted API processes after installing this new RPC.
select pg_notify('pgrst', 'reload schema');

commit;
