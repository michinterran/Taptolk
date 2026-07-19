begin;

create table public.operations_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  contact_count integer not null,
  resolved_count integer not null,
  escalated_count integer not null,
  median_owner_response_ms integer,
  notification_sent_count integer not null,
  notification_retry_count integer not null,
  notification_failed_count integer not null,
  notification_recorded_cost numeric(14, 4) not null,
  notification_missing_cost_count integer not null,
  active_qr_count integer not null,
  completed_batch_count integer not null,
  created_at timestamptz not null default now(),
  constraint fk_operations_metric_snapshots_site
    foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id) on delete restrict,
  constraint uq_operations_metric_snapshots_window
    unique (tenant_id, site_id, window_start),
  constraint chk_operations_metric_snapshots_window
    check (window_end > window_start and window_end <= window_start + interval '1 hour'),
  constraint chk_operations_metric_snapshots_counts check (
    contact_count >= 0 and resolved_count >= 0 and escalated_count >= 0
    and (median_owner_response_ms is null or median_owner_response_ms >= 0)
    and notification_sent_count >= 0 and notification_retry_count >= 0
    and notification_failed_count >= 0 and notification_recorded_cost >= 0
    and notification_missing_cost_count >= 0 and active_qr_count >= 0
    and completed_batch_count >= 0
  )
);

create table public.privacy_cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  request_id uuid not null unique,
  status text not null,
  message_retention_hours integer not null,
  token_grace_hours integer not null,
  block_grace_hours integer not null,
  expired_session_count integer not null default 0,
  revoked_token_count integer not null default 0,
  revoked_block_count integer not null default 0,
  redacted_message_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint chk_privacy_cleanup_runs_status check (
    (status = 'RUNNING' and completed_at is null)
    or (status = 'SUCCESS' and completed_at is not null)
  ),
  constraint chk_privacy_cleanup_runs_policy check (
    message_retention_hours between 24 and 8760
    and token_grace_hours between 0 and 168
    and block_grace_hours between 0 and 168
  ),
  constraint chk_privacy_cleanup_runs_counts check (
    expired_session_count >= 0 and revoked_token_count >= 0
    and revoked_block_count >= 0 and redacted_message_count >= 0
  )
);

create index idx_operations_metric_snapshots_site_window
on public.operations_metric_snapshots (site_id, window_start desc);
create index idx_privacy_cleanup_runs_tenant_started
on public.privacy_cleanup_runs (tenant_id, started_at desc);

alter table public.operations_metric_snapshots enable row level security;
alter table public.operations_metric_snapshots force row level security;
alter table public.privacy_cleanup_runs enable row level security;
alter table public.privacy_cleanup_runs force row level security;

revoke all on table public.operations_metric_snapshots, public.privacy_cleanup_runs
from public, anon, authenticated;
grant all on table public.operations_metric_snapshots, public.privacy_cleanup_runs
to service_role;
grant select on table public.operations_metric_snapshots, public.privacy_cleanup_runs
to authenticated;

create policy operations_metric_snapshots_admin_select
on public.operations_metric_snapshots
for select to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id, site_id,
    array[
      'SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN',
      'SITE_ADMIN', 'SITE_OPERATOR', 'READ_ONLY'
    ]
  )
);

create policy privacy_cleanup_runs_admin_select
on public.privacy_cleanup_runs
for select to authenticated
using (
  exists (
    select 1 from public.sites as site
    where site.tenant_id = privacy_cleanup_runs.tenant_id
      and app_private.current_admin_has_site_scope(
        site.tenant_id, site.id,
        array[
          'SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN',
          'SITE_ADMIN', 'SITE_OPERATOR', 'READ_ONLY'
        ]
      )
  )
);

create or replace function app_private.guard_public_contact_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_table_name = 'messages'
    and tg_op = 'UPDATE'
    and auth.role() = 'service_role'
    and old.body <> '[REDACTED]'
    and new.body = '[REDACTED]'
    and (to_jsonb(new) - 'body') = (to_jsonb(old) - 'body')
  then
    return new;
  end if;
  raise exception using errcode = '23514', message = 'PUBLIC_CONTACT_HISTORY_IMMUTABLE';
end;
$$;

create or replace function public.aggregate_operations_metrics(
  p_tenant_id uuid,
  p_site_id uuid,
  p_window_start timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_id uuid;
  window_end timestamptz := p_window_start + interval '1 hour';
begin
  if auth.role() <> 'service_role'
    or date_trunc('hour', p_window_start) <> p_window_start
    or not exists (
      select 1 from public.sites
      where tenant_id = p_tenant_id and id = p_site_id
    )
  then
    raise exception using errcode = '42501', message = 'METRIC_AGGREGATION_NOT_ALLOWED';
  end if;

  insert into public.operations_metric_snapshots (
    tenant_id, site_id, window_start, window_end,
    contact_count, resolved_count, escalated_count, median_owner_response_ms,
    notification_sent_count, notification_retry_count, notification_failed_count,
    notification_recorded_cost, notification_missing_cost_count,
    active_qr_count, completed_batch_count
  )
  select
    p_tenant_id, p_site_id, p_window_start, window_end,
    (select count(*)::integer from public.contact_sessions
      where tenant_id = p_tenant_id and site_id = p_site_id
        and created_at >= p_window_start and created_at < window_end),
    (select count(*)::integer from public.contact_sessions
      where tenant_id = p_tenant_id and site_id = p_site_id and status = 'RESOLVED'
        and resolved_at >= p_window_start and resolved_at < window_end),
    (select count(*)::integer from public.contact_sessions
      where tenant_id = p_tenant_id and site_id = p_site_id and status = 'ESCALATED'
        and escalated_at >= p_window_start and escalated_at < window_end),
    (select round(percentile_cont(0.5) within group (
        order by extract(epoch from (owner_replied_at - created_at)) * 1000
      ))::integer
      from public.contact_sessions
      where tenant_id = p_tenant_id and site_id = p_site_id
        and owner_replied_at >= p_window_start and owner_replied_at < window_end),
    (select count(*)::integer from public.notification_deliveries
      where tenant_id = p_tenant_id and site_id = p_site_id
        and status in ('SENT', 'DELIVERED')
        and coalesce(sent_at, delivered_at, updated_at) >= p_window_start
        and coalesce(sent_at, delivered_at, updated_at) < window_end),
    (select count(*)::integer from public.notification_deliveries
      where tenant_id = p_tenant_id and site_id = p_site_id
        and status = 'FAILED_RETRYABLE'
        and updated_at >= p_window_start and updated_at < window_end),
    (select count(*)::integer from public.notification_deliveries
      where tenant_id = p_tenant_id and site_id = p_site_id
        and status = 'FAILED_FINAL'
        and updated_at >= p_window_start and updated_at < window_end),
    (select coalesce(sum(cost_amount), 0) from public.notification_deliveries
      where tenant_id = p_tenant_id and site_id = p_site_id
        and status in ('SENT', 'DELIVERED')
        and updated_at >= p_window_start and updated_at < window_end),
    (select count(*)::integer from public.notification_deliveries
      where tenant_id = p_tenant_id and site_id = p_site_id
        and status in ('SENT', 'DELIVERED') and cost_amount is null
        and updated_at >= p_window_start and updated_at < window_end),
    (select count(*)::integer from public.qr_assets
      where tenant_id = p_tenant_id and site_id = p_site_id and status = 'ACTIVE'),
    (select count(*)::integer from public.qr_batches
      where tenant_id = p_tenant_id and site_id = p_site_id
        and status in ('GENERATED', 'QUALITY_CHECKED', 'PRINT_FILE_READY', 'COMPLETED')
        and updated_at >= p_window_start and updated_at < window_end)
  on conflict (tenant_id, site_id, window_start)
  do update set
    window_end = excluded.window_end,
    contact_count = excluded.contact_count,
    resolved_count = excluded.resolved_count,
    escalated_count = excluded.escalated_count,
    median_owner_response_ms = excluded.median_owner_response_ms,
    notification_sent_count = excluded.notification_sent_count,
    notification_retry_count = excluded.notification_retry_count,
    notification_failed_count = excluded.notification_failed_count,
    notification_recorded_cost = excluded.notification_recorded_cost,
    notification_missing_cost_count = excluded.notification_missing_cost_count,
    active_qr_count = excluded.active_qr_count,
    completed_batch_count = excluded.completed_batch_count,
    created_at = statement_timestamp()
  returning id into snapshot_id;
  return snapshot_id;
end;
$$;

create or replace function public.read_operations_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'OPERATIONS_DASHBOARD_NOT_ALLOWED';
  end if;
  with visible_sites as (
    select site.tenant_id, site.id
    from public.sites as site
    where app_private.current_admin_has_site_scope(
      site.tenant_id, site.id,
      array[
        'SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN',
        'SITE_ADMIN', 'SITE_OPERATOR', 'READ_ONLY'
      ]
    )
  ),
  sessions as (
    select session.*
    from public.contact_sessions as session
    join visible_sites as site
      on site.tenant_id = session.tenant_id and site.id = session.site_id
    where session.created_at >= statement_timestamp() - interval '24 hours'
  ),
  deliveries as (
    select delivery.*
    from public.notification_deliveries as delivery
    join visible_sites as site
      on site.tenant_id = delivery.tenant_id and site.id = delivery.site_id
    where delivery.created_at >= statement_timestamp() - interval '24 hours'
  )
  select jsonb_build_object(
    'fresh_at', statement_timestamp(),
    'site_count', (select count(*)::integer from visible_sites),
    'contact_count', (select count(*)::integer from sessions),
    'unresolved_count', (select count(*)::integer from sessions
      where status not in ('RESOLVED', 'EXPIRED', 'BLOCKED', 'CANCELLED')),
    'escalated_count', (select count(*)::integer from sessions where status = 'ESCALATED'),
    'median_owner_response_ms', (select round(percentile_cont(0.5) within group (
      order by extract(epoch from (owner_replied_at - created_at)) * 1000
    ))::integer from sessions where owner_replied_at is not null),
    'notification_sent_count', (select count(*)::integer from deliveries
      where status in ('SENT', 'DELIVERED')),
    'notification_retry_count', (select count(*)::integer from deliveries
      where status = 'FAILED_RETRYABLE'),
    'notification_failed_count', (select count(*)::integer from deliveries
      where status = 'FAILED_FINAL'),
    'notification_recorded_cost', (select coalesce(sum(cost_amount), 0) from deliveries
      where status in ('SENT', 'DELIVERED')),
    'notification_missing_cost_count', (select count(*)::integer from deliveries
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
      on site.tenant_id = snapshot.tenant_id and site.id = snapshot.site_id)
  ) into result;
  return result;
end;
$$;

create or replace function public.run_privacy_cleanup(
  p_tenant_id uuid,
  p_message_retention_hours integer,
  p_token_grace_hours integer,
  p_block_grace_hours integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id uuid;
  expired_sessions integer;
  revoked_tokens integer;
  revoked_blocks integer;
  redacted_messages integer;
begin
  if auth.role() <> 'service_role'
    or p_message_retention_hours not between 24 and 8760
    or p_token_grace_hours not between 0 and 168
    or p_block_grace_hours not between 0 and 168
    or not exists (select 1 from public.tenants where id = p_tenant_id)
  then
    raise exception using errcode = '42501', message = 'PRIVACY_CLEANUP_NOT_ALLOWED';
  end if;
  insert into public.privacy_cleanup_runs (
    tenant_id, request_id, status, message_retention_hours,
    token_grace_hours, block_grace_hours
  )
  values (
    p_tenant_id, p_request_id, 'RUNNING', p_message_retention_hours,
    p_token_grace_hours, p_block_grace_hours
  )
  on conflict (request_id) do nothing
  returning id into run_id;
  if run_id is null then
    select id into run_id from public.privacy_cleanup_runs where request_id = p_request_id;
    return (
      select jsonb_build_object(
        'run_id', id, 'status', status,
        'expired_session_count', expired_session_count,
        'revoked_token_count', revoked_token_count,
        'revoked_block_count', revoked_block_count,
        'redacted_message_count', redacted_message_count
      )
      from public.privacy_cleanup_runs where id = run_id
    );
  end if;

  update public.contact_sessions
  set status = 'EXPIRED', updated_at = statement_timestamp()
  where tenant_id = p_tenant_id and expires_at <= statement_timestamp()
    and status not in ('RESOLVED', 'EXPIRED', 'BLOCKED', 'CANCELLED');
  get diagnostics expired_sessions = row_count;

  update public.response_tokens as token
  set revoked_at = statement_timestamp()
  from public.contact_sessions as session
  where session.tenant_id = p_tenant_id and session.id = token.session_id
    and token.revoked_at is null
    and token.expires_at <= statement_timestamp() - make_interval(hours => p_token_grace_hours);
  get diagnostics revoked_tokens = row_count;

  update public.caller_blocks
  set revoked_at = statement_timestamp()
  where tenant_id = p_tenant_id and revoked_at is null
    and expires_at <= statement_timestamp() - make_interval(hours => p_block_grace_hours);
  get diagnostics revoked_blocks = row_count;

  update public.messages as message
  set body = '[REDACTED]'
  where message.tenant_id = p_tenant_id
    and message.created_at <= statement_timestamp()
      - make_interval(hours => p_message_retention_hours)
    and message.body <> '[REDACTED]';
  get diagnostics redacted_messages = row_count;

  update public.privacy_cleanup_runs
  set status = 'SUCCESS', completed_at = statement_timestamp(),
      expired_session_count = expired_sessions,
      revoked_token_count = revoked_tokens,
      revoked_block_count = revoked_blocks,
      redacted_message_count = redacted_messages
  where id = run_id;

  insert into public.audit_logs (
    tenant_id, actor_type, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    p_tenant_id, 'SYSTEM', 'PRIVACY_CLEANUP_COMPLETED',
    'PRIVACY_CLEANUP_RUN', run_id,
    jsonb_build_object(
      'status', 'SUCCESS',
      'expired_count', expired_sessions,
      'revoked_recovery_count', revoked_tokens,
      'revoked_block_count', revoked_blocks,
      'redacted_content_count', redacted_messages
    ),
    'PRIVACY_RETENTION_POLICY', p_request_id
  );

  return jsonb_build_object(
    'run_id', run_id, 'status', 'SUCCESS',
    'expired_session_count', expired_sessions,
    'revoked_token_count', revoked_tokens,
    'revoked_block_count', revoked_blocks,
    'redacted_message_count', redacted_messages
  );
end;
$$;

create or replace function public.read_pilot_readiness_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dashboard jsonb;
begin
  dashboard := public.read_operations_dashboard();
  return dashboard || jsonb_build_object(
    'automated_dashboard_gate', true,
    'automated_cleanup_evidence_count', (
      select count(*)::integer from public.privacy_cleanup_runs as run
      where run.status = 'SUCCESS' and exists (
        select 1 from public.sites as site
        where site.tenant_id = run.tenant_id
          and app_private.current_admin_has_site_scope(
            site.tenant_id, site.id,
            array[
              'SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN',
              'SITE_ADMIN', 'SITE_OPERATOR', 'READ_ONLY'
            ]
          )
      )
    ),
    'manual_real_device_gate', false,
    'manual_screen_reader_gate', false,
    'manual_physical_print_gate', false
  );
end;
$$;

revoke all on function public.aggregate_operations_metrics(uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.read_operations_dashboard() from public, anon;
revoke all on function public.run_privacy_cleanup(uuid, integer, integer, integer, uuid)
from public, anon, authenticated;
revoke all on function public.read_pilot_readiness_snapshot() from public, anon;

grant execute on function public.aggregate_operations_metrics(uuid, uuid, timestamptz)
to service_role;
grant execute on function public.read_operations_dashboard() to authenticated;
grant execute on function public.run_privacy_cleanup(uuid, integer, integer, integer, uuid)
to service_role;
grant execute on function public.read_pilot_readiness_snapshot() to authenticated;

commit;
