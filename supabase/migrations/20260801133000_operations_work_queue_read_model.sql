begin;

create or replace function public.read_operations_work_queue(
  p_management_company_id uuid default null,
  p_site_id uuid default null,
  p_limit integer default 50,
  p_cursor text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cursor_created_at timestamptz;
  cursor_id uuid;
  result jsonb;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'OPERATIONS_WORK_QUEUE_NOT_ALLOWED';
  end if;
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_OPERATIONS_WORK_QUEUE_LIMIT';
  end if;
  if p_cursor is not null then
    begin
      cursor_created_at := split_part(p_cursor, '|', 1)::timestamptz;
      cursor_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception using errcode = '22023', message = 'INVALID_OPERATIONS_WORK_QUEUE_CURSOR';
    end;
  end if;

  with visible_sites as materialized (
    select
      site.tenant_id,
      site.id as site_id,
      site.management_company_id,
      site.name as site_name,
      company.name as management_company_name
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
  work_items as (
    select
      session.id,
      'CONTACT_REQUEST'::text as kind,
      'CONTACT_SESSIONS'::text as source,
      session.status::text as source_status,
      site.site_id,
      site.management_company_name,
      site.site_name,
      session.created_at,
      session.owner_notified_at as last_attempt_at,
      greatest(0, extract(epoch from (statement_timestamp() - session.created_at))::integer)
        as elapsed_seconds,
      session.version as source_version,
      jsonb_build_array('OPEN_SITE_WORKSPACE') as actions
    from public.contact_sessions as session
    join visible_sites as site
      on site.tenant_id = session.tenant_id and site.site_id = session.site_id
    where session.status in ('CREATED', 'MESSAGE_SUBMITTED', 'NOTIFICATION_QUEUED')

    union all

    select
      session.id,
      'UNANSWERED_CONTACT'::text,
      'CONTACT_SESSIONS'::text,
      session.status::text,
      site.site_id,
      site.management_company_name,
      site.site_name,
      session.created_at,
      session.owner_notified_at,
      greatest(0, extract(epoch from (statement_timestamp() - session.created_at))::integer),
      session.version,
      jsonb_build_array('OPEN_SITE_WORKSPACE')
    from public.contact_sessions as session
    join visible_sites as site
      on site.tenant_id = session.tenant_id and site.site_id = session.site_id
    where session.status in ('OWNER_NOTIFIED', 'OWNER_VIEWED', 'CALLER_VIEWED')
      and session.owner_replied_at is null

    union all

    select
      session.id,
      'ESCALATION'::text,
      'CONTACT_SESSIONS'::text,
      session.status::text,
      site.site_id,
      site.management_company_name,
      site.site_name,
      session.created_at,
      session.escalated_at,
      greatest(0, extract(epoch from (statement_timestamp() - session.created_at))::integer),
      session.version,
      jsonb_build_array('OPEN_SITE_WORKSPACE')
    from public.contact_sessions as session
    join visible_sites as site
      on site.tenant_id = session.tenant_id and site.site_id = session.site_id
    where session.status = 'ESCALATED'

    union all

    select
      delivery.id,
      'NOTIFICATION_FAILURE'::text,
      'NOTIFICATION_DELIVERIES'::text,
      delivery.status::text,
      site.site_id,
      site.management_company_name,
      site.site_name,
      delivery.created_at,
      coalesce(delivery.failed_at, delivery.sent_at, delivery.scheduled_at),
      greatest(0, extract(epoch from (statement_timestamp() - delivery.created_at))::integer),
      null::integer,
      jsonb_build_array('OPEN_SITE_WORKSPACE')
    from public.notification_deliveries as delivery
    join visible_sites as site
      on site.tenant_id = delivery.tenant_id and site.site_id = delivery.site_id
    where delivery.purpose <> 'OTP'
      and delivery.status in ('FAILED_RETRYABLE', 'FAILED_FINAL')

    union all

    select
      report.id,
      'REPORT_REVIEW'::text,
      'CONTACT_REPORTS'::text,
      report.status::text,
      site.site_id,
      site.management_company_name,
      site.site_name,
      report.created_at,
      null::timestamptz,
      greatest(0, extract(epoch from (statement_timestamp() - report.created_at))::integer),
      null::integer,
      jsonb_build_array('OPEN_REPORT')
    from public.contact_reports as report
    join visible_sites as site
      on site.tenant_id = report.tenant_id and site.site_id = report.site_id
    where report.status = 'OPEN'
  ),
  ordered_items as (
    select
      work_items.*,
      row_number() over (order by work_items.created_at desc, work_items.id desc) as row_number
    from work_items
    where cursor_created_at is null
      or (work_items.created_at, work_items.id) < (cursor_created_at, cursor_id)
  ),
  page_items as (
    select * from ordered_items where row_number <= p_limit
  ),
  page_tail as (
    select * from page_items where row_number = p_limit limit 1
  )
  select jsonb_build_object(
    'as_of', statement_timestamp(),
    'has_more', exists (select 1 from ordered_items where row_number = p_limit + 1),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'kind', item.kind,
            'source', item.source,
            'source_status', item.source_status,
            'source_version', item.source_version,
            'site_id', item.site_id,
            'management_company_name', item.management_company_name,
            'site_name', item.site_name,
            'created_at', item.created_at,
            'last_attempt_at', item.last_attempt_at,
            'elapsed_seconds', item.elapsed_seconds,
            'assignee_display_name', null,
            'priority', null,
            'sla', null,
            'actions', item.actions
          ) order by item.created_at desc, item.id desc
        )
        from page_items as item
      ),
      '[]'::jsonb
    ),
    'next_cursor', (
      select to_char(page_tail.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        || '|' || page_tail.id::text
      from page_tail
      where exists (select 1 from ordered_items where row_number = p_limit + 1)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.read_operations_work_queue(uuid, uuid, integer, text)
from public, anon;
grant execute on function public.read_operations_work_queue(uuid, uuid, integer, text)
to authenticated;

comment on function public.read_operations_work_queue(uuid, uuid, integer, text) is
  'Returns source-backed operations work items within the admin site scope. Assignee, priority, SLA, phone, message, OTP, destination hash, and provider identifiers are intentionally absent until persisted contracts exist.';

commit;
