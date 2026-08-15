begin;

create table public.solapi_delivery_reports (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references public.notification_deliveries (id) on delete restrict,
  provider_message_id text not null,
  status_code text not null,
  outcome text not null,
  provider_reported_at timestamptz not null,
  provider_received_at timestamptz,
  received_at timestamptz not null default statement_timestamp(),
  constraint uq_solapi_delivery_reports_event
    unique (provider_message_id, status_code, provider_reported_at),
  constraint chk_solapi_delivery_reports_message_id
    check (provider_message_id ~ '^[A-Za-z0-9_-]{8,200}$'),
  constraint chk_solapi_delivery_reports_status_code
    check (status_code ~ '^[0-9]{4}$'),
  constraint chk_solapi_delivery_reports_outcome
    check (outcome in ('PENDING', 'DELIVERED', 'FAILED')),
  constraint chk_solapi_delivery_reports_timestamps
    check (
      provider_reported_at <= received_at + interval '5 minutes'
      and provider_reported_at >= received_at - interval '366 days'
      and (
        provider_received_at is null
        or provider_received_at <= received_at + interval '5 minutes'
      )
    )
);

create index idx_solapi_delivery_reports_delivery_received
on public.solapi_delivery_reports (delivery_id, received_at desc)
where delivery_id is not null;

create index idx_solapi_delivery_reports_unmatched_received
on public.solapi_delivery_reports (received_at desc)
where delivery_id is null;

create table public.solapi_account_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  check_status text not null,
  balance_amount numeric(14, 2),
  point_amount numeric(14, 2),
  warning_threshold_amount numeric(14, 2) not null,
  auto_recharge_enabled boolean,
  low_balance_alert_enabled boolean,
  source text not null,
  error_code text,
  captured_at timestamptz not null default statement_timestamp(),
  constraint chk_solapi_account_health_status
    check (check_status in ('CHECKED', 'UNAVAILABLE')),
  constraint chk_solapi_account_health_amounts
    check (
      warning_threshold_amount >= 0
      and (balance_amount is null or balance_amount >= 0)
      and (point_amount is null or point_amount >= 0)
    ),
  constraint chk_solapi_account_health_source
    check (source in ('CRON', 'DISPATCH', 'WEBHOOK', 'MANUAL')),
  constraint chk_solapi_account_health_error
    check (
      (
        check_status = 'CHECKED'
        and balance_amount is not null
        and point_amount is not null
        and error_code is null
      )
      or (
        check_status = 'UNAVAILABLE'
        and balance_amount is null
        and point_amount is null
        and auto_recharge_enabled is null
        and low_balance_alert_enabled is null
        and error_code in (
          'CONFIGURATION_UNAVAILABLE', 'PROVIDER_UNAVAILABLE', 'REPOSITORY_UNAVAILABLE'
        )
      )
    )
);

create index idx_solapi_account_health_snapshots_captured
on public.solapi_account_health_snapshots (captured_at desc);

alter table public.solapi_delivery_reports enable row level security;
alter table public.solapi_delivery_reports force row level security;
alter table public.solapi_account_health_snapshots enable row level security;
alter table public.solapi_account_health_snapshots force row level security;

revoke all on table public.solapi_delivery_reports from public, anon, authenticated;
revoke all on table public.solapi_account_health_snapshots from public, anon, authenticated;
grant all on table public.solapi_delivery_reports to service_role;
grant all on table public.solapi_account_health_snapshots to service_role;

comment on table public.solapi_delivery_reports is
  'Service-only, redacted SOLAPI delivery receipts. Phone numbers, message bodies, sender numbers, network codes, and raw webhook payloads are intentionally absent.';
comment on table public.solapi_account_health_snapshots is
  'Service-only SOLAPI balance and alert-state snapshots. Account identifiers and payment details are intentionally absent.';

create or replace function public.record_solapi_delivery_report(
  p_provider_message_id text,
  p_status_code text,
  p_provider_reported_at timestamptz,
  p_provider_received_at timestamptz default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery public.notification_deliveries%rowtype;
  event_outcome text;
  previous_status public.notification_status;
  event_id uuid;
  effective_received_at timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_provider_message_id !~ '^[A-Za-z0-9_-]{8,200}$'
    or p_status_code !~ '^[0-9]{4}$'
    or p_provider_reported_at is null
    or p_provider_reported_at > statement_timestamp() + interval '5 minutes'
    or p_provider_reported_at < statement_timestamp() - interval '366 days'
    or (
      p_provider_received_at is not null
      and p_provider_received_at > statement_timestamp() + interval '5 minutes'
    )
    or (p_idempotency_key is not null and p_idempotency_key !~ '^[0-9a-f]{64}$')
  then
    raise exception using errcode = '22023', message = 'INVALID_SOLAPI_DELIVERY_REPORT';
  end if;

  event_outcome := case
    when p_status_code = '4000' then 'DELIVERED'
    when p_status_code in ('2000', '3000') then 'PENDING'
    else 'FAILED'
  end;
  effective_received_at := coalesce(p_provider_received_at, p_provider_reported_at);

  select candidate.* into delivery
  from public.notification_deliveries as candidate
  where candidate.channel = 'SMS'
    and (
      candidate.provider_message_id = p_provider_message_id
      or (
        p_idempotency_key is not null
        and candidate.idempotency_key = p_idempotency_key
        and candidate.provider_message_id is null
      )
    )
  order by (candidate.provider_message_id = p_provider_message_id) desc
  limit 1
  for update;

  insert into public.solapi_delivery_reports (
    delivery_id,
    provider_message_id,
    status_code,
    outcome,
    provider_reported_at,
    provider_received_at
  )
  values (
    delivery.id,
    p_provider_message_id,
    p_status_code,
    event_outcome,
    p_provider_reported_at,
    p_provider_received_at
  )
  on conflict (provider_message_id, status_code, provider_reported_at)
  do update set delivery_id = coalesce(public.solapi_delivery_reports.delivery_id, excluded.delivery_id)
  returning id into event_id;

  if delivery.id is null then
    return jsonb_build_object(
      'event_id', event_id,
      'matched', false,
      'outcome', event_outcome
    );
  end if;

  previous_status := delivery.status;

  if event_outcome = 'PENDING' then
    update public.notification_deliveries
    set provider = 'SOLAPI',
        provider_message_id = coalesce(provider_message_id, p_provider_message_id),
        updated_at = statement_timestamp()
    where id = delivery.id;
  elsif event_outcome = 'DELIVERED'
    and delivery.status not in ('DELIVERED', 'CANCELLED')
  then
    update public.notification_deliveries
    set provider = 'SOLAPI',
        provider_message_id = coalesce(provider_message_id, p_provider_message_id),
        status = 'DELIVERED',
        sent_at = coalesce(sent_at, p_provider_reported_at),
        delivered_at = coalesce(delivered_at, effective_received_at),
        failed_at = null,
        error_code = null,
        lease_owner = null,
        lease_expires_at = null,
        updated_at = statement_timestamp()
    where id = delivery.id;
  elsif event_outcome = 'FAILED'
    and delivery.status not in ('DELIVERED', 'FAILED_FINAL', 'CANCELLED')
  then
    update public.notification_deliveries
    set provider = 'SOLAPI',
        provider_message_id = coalesce(provider_message_id, p_provider_message_id),
        status = 'FAILED_FINAL',
        failed_at = coalesce(failed_at, p_provider_reported_at),
        error_code = 'PROVIDER_DELIVERY_FAILED',
        archived_at = coalesce(archived_at, statement_timestamp()),
        lease_owner = null,
        lease_expires_at = null,
        updated_at = statement_timestamp()
    where id = delivery.id;

    update public.contact_sessions
    set status = 'NOTIFICATION_FAILED',
        updated_at = statement_timestamp(),
        version = version + 1
    where tenant_id = delivery.tenant_id
      and id = delivery.session_id
      and status in ('NOTIFICATION_QUEUED', 'OWNER_NOTIFIED');

    update public.response_tokens
    set revoked_at = statement_timestamp()
    where delivery_id = delivery.id and revoked_at is null;
  end if;

  if event_outcome in ('DELIVERED', 'FAILED')
    and previous_status is distinct from (
      select current_delivery.status
      from public.notification_deliveries as current_delivery
      where current_delivery.id = delivery.id
    )
  then
    insert into public.audit_logs (
      tenant_id,
      site_id,
      actor_type,
      action,
      resource_type,
      resource_id,
      after_data,
      reason,
      request_id
    )
    values (
      delivery.tenant_id,
      delivery.site_id,
      'SYSTEM',
      case
        when event_outcome = 'DELIVERED' then 'OWNER_NOTIFICATION_DELIVERED'
        else 'OWNER_NOTIFICATION_PROVIDER_FAILED'
      end,
      'NOTIFICATION_DELIVERY',
      delivery.id,
      jsonb_build_object('status', event_outcome, 'providerStatusCode', p_status_code),
      case
        when event_outcome = 'DELIVERED' then 'SOLAPI_DELIVERY_CONFIRMED'
        else 'SOLAPI_DELIVERY_FAILED'
      end,
      gen_random_uuid()
    );
  end if;

  return jsonb_build_object(
    'event_id', event_id,
    'matched', true,
    'outcome', event_outcome
  );
end;
$$;

create or replace function public.record_solapi_delivery_report_batch(p_reports jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  report jsonb;
  recorded jsonb;
  results jsonb := '[]'::jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if jsonb_typeof(p_reports) <> 'array'
    or jsonb_array_length(p_reports) not between 1 and 100
  then
    raise exception using errcode = '22023', message = 'INVALID_SOLAPI_DELIVERY_REPORT_BATCH';
  end if;

  for report in select value from jsonb_array_elements(p_reports)
  loop
    recorded := public.record_solapi_delivery_report(
      report ->> 'providerMessageId',
      report ->> 'statusCode',
      (report ->> 'providerReportedAt')::timestamptz,
      nullif(report ->> 'providerReceivedAt', '')::timestamptz,
      nullif(report ->> 'idempotencyKey', '')
    );
    results := results || jsonb_build_array(recorded);
  end loop;

  return results;
exception when invalid_text_representation or datetime_field_overflow then
  raise exception using errcode = '22023', message = 'INVALID_SOLAPI_DELIVERY_REPORT_BATCH';
end;
$$;

create or replace function public.record_solapi_account_health(
  p_check_status text,
  p_warning_threshold_amount numeric,
  p_source text,
  p_balance_amount numeric default null,
  p_point_amount numeric default null,
  p_auto_recharge_enabled boolean default null,
  p_low_balance_alert_enabled boolean default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.solapi_account_health_snapshots (
    check_status,
    balance_amount,
    point_amount,
    warning_threshold_amount,
    auto_recharge_enabled,
    low_balance_alert_enabled,
    source,
    error_code
  )
  values (
    p_check_status,
    p_balance_amount,
    p_point_amount,
    p_warning_threshold_amount,
    p_auto_recharge_enabled,
    p_low_balance_alert_enabled,
    p_source,
    p_error_code
  )
  returning id into snapshot_id;

  return jsonb_build_object('snapshot_id', snapshot_id, 'status', p_check_status);
end;
$$;

create or replace function public.read_solapi_operations_health(
  p_management_company_id uuid default null,
  p_site_id uuid default null,
  p_balance_stale_minutes integer default 1500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  has_platform_scope boolean;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'SOLAPI_OPERATIONS_HEALTH_NOT_ALLOWED';
  end if;
  if p_balance_stale_minutes not between 60 and 10080 then
    raise exception using errcode = '22023', message = 'INVALID_SOLAPI_BALANCE_STALE_WINDOW';
  end if;

  select exists (
    select 1
    from public.admin_profiles as profile
    join public.admin_memberships as membership on membership.user_id = profile.user_id
    where profile.user_id = auth.uid()
      and profile.status = 'ACTIVE'
      and membership.status = 'ACTIVE'
      and membership.scope_type = 'PLATFORM'
      and membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
  ) into has_platform_scope;

  with visible_sites as materialized (
    select site.tenant_id, site.id
    from public.sites as site
    join public.management_companies as company
      on company.tenant_id = site.tenant_id
      and company.id = site.management_company_id
    join public.tenants as tenant on tenant.id = site.tenant_id
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
  scoped_deliveries as materialized (
    select delivery.*
    from public.notification_deliveries as delivery
    join visible_sites as site
      on site.tenant_id = delivery.tenant_id and site.id = delivery.site_id
    where delivery.channel = 'SMS'
      and delivery.created_at >= statement_timestamp() - interval '24 hours'
  ),
  latest_balance as (
    select snapshot.*
    from public.solapi_account_health_snapshots as snapshot
    order by snapshot.captured_at desc
    limit 1
  )
  select jsonb_build_object(
    'fresh_at', statement_timestamp(),
    'delivery_delivered_count', (
      select count(*)::integer from scoped_deliveries where status = 'DELIVERED'
    ),
    'delivery_pending_report_count', (
      select count(*)::integer from scoped_deliveries where status = 'SENT'
    ),
    'delivery_failed_count', (
      select count(*)::integer from scoped_deliveries where status = 'FAILED_FINAL'
    ),
    'webhook_last_received_at', (
      select max(report.received_at)
      from public.solapi_delivery_reports as report
      join scoped_deliveries as delivery on delivery.id = report.delivery_id
    ),
    'webhook_unmatched_count', case
      when has_platform_scope then (
        select count(*)::integer
        from public.solapi_delivery_reports as report
        where report.delivery_id is null
          and report.received_at >= statement_timestamp() - interval '24 hours'
      )
      else 0
    end,
    'balance_visible', has_platform_scope,
    'balance_status', case
      when not has_platform_scope then 'HIDDEN'
      when not exists (select 1 from latest_balance) then 'UNAVAILABLE'
      when (select check_status from latest_balance) = 'UNAVAILABLE' then 'UNAVAILABLE'
      when (select captured_at from latest_balance)
        < statement_timestamp() - make_interval(mins => p_balance_stale_minutes)
      then 'STALE'
      when (select balance_amount from latest_balance)
        <= (select warning_threshold_amount from latest_balance)
      then 'LOW'
      else 'HEALTHY'
    end,
    'balance_amount', case when has_platform_scope then (
      select balance_amount from latest_balance where check_status = 'CHECKED'
    ) end,
    'balance_warning_threshold_amount', case when has_platform_scope then (
      select warning_threshold_amount from latest_balance
    ) end,
    'balance_auto_recharge_enabled', case when has_platform_scope then (
      select auto_recharge_enabled from latest_balance where check_status = 'CHECKED'
    ) end,
    'balance_low_alert_enabled', case when has_platform_scope then (
      select low_balance_alert_enabled from latest_balance where check_status = 'CHECKED'
    ) end,
    'balance_captured_at', case when has_platform_scope then (
      select captured_at from latest_balance
    ) end
  ) into result;

  return result;
end;
$$;

-- A delivery result can race the SDK acknowledgement. Treat a matching terminal
-- provider result as the durable outcome instead of attempting to regress it to SENT.
create or replace function public.record_notification_sent(
  p_delivery_id uuid,
  p_worker_id text,
  p_lease_version integer,
  p_provider_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery public.notification_deliveries%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if length(p_provider_message_id) not between 8 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_RECEIPT';
  end if;

  select * into delivery
  from public.notification_deliveries
  where id = p_delivery_id
  for update;

  if delivery.provider_message_id = p_provider_message_id
    and delivery.status in ('SENT', 'DELIVERED', 'FAILED_FINAL')
  then
    return jsonb_build_object('status', delivery.status, 'replayed', true);
  end if;
  if delivery.status <> 'PROCESSING'
    or delivery.lease_owner <> p_worker_id
    or delivery.lease_version <> p_lease_version
    or delivery.lease_expires_at <= statement_timestamp()
  then
    raise exception using errcode = 'P0001', message = 'NOTIFICATION_LEASE_LOST';
  end if;

  update public.notification_deliveries
  set status = 'SENT',
      provider = case when channel = 'SMS' then 'SOLAPI' else provider end,
      provider_message_id = p_provider_message_id,
      sent_at = statement_timestamp(),
      error_code = null,
      lease_owner = null,
      lease_expires_at = null,
      updated_at = statement_timestamp()
  where id = delivery.id;

  update public.contact_sessions
  set status = 'OWNER_NOTIFIED',
      owner_notified_at = statement_timestamp(),
      updated_at = statement_timestamp(),
      version = version + 1
  where tenant_id = delivery.tenant_id
    and id = delivery.session_id
    and status = 'NOTIFICATION_QUEUED';

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    delivery.tenant_id, delivery.site_id, 'SYSTEM', 'OWNER_NOTIFICATION_SENT',
    'NOTIFICATION_DELIVERY', delivery.id,
    jsonb_build_object('status', 'SENT', 'attempt', delivery.lease_version),
    'OWNER_NOTIFICATION_SENT', gen_random_uuid()
  );

  return jsonb_build_object('status', 'SENT', 'replayed', false);
end;
$$;

update public.notification_deliveries
set provider = 'SOLAPI', updated_at = statement_timestamp()
where channel = 'SMS'
  and provider_message_id is not null
  and provider <> 'SOLAPI';

revoke all on function public.record_solapi_delivery_report(text, text, timestamptz, timestamptz, text)
from public, anon, authenticated;
revoke all on function public.record_solapi_delivery_report_batch(jsonb)
from public, anon, authenticated;
revoke all on function public.record_solapi_account_health(text, numeric, text, numeric, numeric, boolean, boolean, text)
from public, anon, authenticated;
revoke all on function public.read_solapi_operations_health(uuid, uuid, integer)
from public, anon;

grant execute on function public.record_solapi_delivery_report(text, text, timestamptz, timestamptz, text)
to service_role;
grant execute on function public.record_solapi_delivery_report_batch(jsonb)
to service_role;
grant execute on function public.record_solapi_account_health(text, numeric, text, numeric, numeric, boolean, boolean, text)
to service_role;
grant execute on function public.read_solapi_operations_health(uuid, uuid, integer)
to authenticated;

comment on function public.record_solapi_delivery_report(text, text, timestamptz, timestamptz, text) is
  'Records a redacted, idempotent SOLAPI delivery report and applies terminal delivery state using service-role only.';
comment on function public.record_solapi_delivery_report_batch(jsonb) is
  'Records up to 100 redacted SOLAPI delivery reports in one service-role transaction.';
comment on function public.record_solapi_account_health(text, numeric, text, numeric, numeric, boolean, boolean, text) is
  'Records a redacted SOLAPI account health snapshot using service-role only.';
comment on function public.read_solapi_operations_health(uuid, uuid, integer) is
  'Returns scoped SMS delivery health. Provider account balance is included only for active platform operators.';

commit;
