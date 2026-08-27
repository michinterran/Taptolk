begin;

create type public.abuse_event_type as enum (
  'RATE_LIMITED', 'CAPTCHA_FAILED', 'MESSAGE_BLOCKED', 'REPEATED_REQUEST'
);
create type public.contact_report_status as enum ('OPEN', 'REVIEWED', 'BLOCKED', 'DISMISSED');

create table public.abuse_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_asset_id uuid not null,
  session_id uuid,
  anonymous_hash text not null,
  network_hash text not null,
  event_type public.abuse_event_type not null,
  reason_code text not null,
  created_at timestamptz not null default now(),
  constraint fk_abuse_events_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id) on delete restrict,
  constraint fk_abuse_events_session
    foreign key (tenant_id, session_id)
    references public.contact_sessions (tenant_id, id) on delete restrict,
  constraint chk_abuse_events_hashes check (
    anonymous_hash ~ '^[0-9a-f]{64}$' and network_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_abuse_events_reason check (length(reason_code) between 3 and 64)
);

create table public.contact_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  session_id uuid not null,
  reporter_type public.contact_participant_type not null,
  reason_code text not null,
  status public.contact_report_status not null default 'OPEN',
  disposition_reason text,
  processed_by uuid references auth.users (id) on delete restrict,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_contact_reports_session
    foreign key (tenant_id, session_id)
    references public.contact_sessions (tenant_id, id) on delete restrict,
  constraint chk_contact_reports_reason check (length(reason_code) between 3 and 64),
  constraint chk_contact_reports_state check (
    (status = 'OPEN' and processed_by is null and processed_at is null and disposition_reason is null)
    or (
      status <> 'OPEN' and processed_by is not null and processed_at is not null
      and length(disposition_reason) between 3 and 500
    )
  )
);

create table public.caller_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  anonymous_hash text not null,
  network_hash text not null,
  reason_code text not null,
  blocked_by uuid not null references auth.users (id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fk_caller_blocks_site
    foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id) on delete restrict,
  constraint chk_caller_blocks_hashes check (
    anonymous_hash ~ '^[0-9a-f]{64}$' and network_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_caller_blocks_window check (
    expires_at > created_at and (revoked_at is null or revoked_at >= created_at)
  )
);

create unique index uq_caller_blocks_active
on public.caller_blocks (tenant_id, site_id, anonymous_hash)
where revoked_at is null;
create index idx_abuse_events_anon_created on public.abuse_events (anonymous_hash, created_at desc);
create index idx_contact_reports_site_status on public.contact_reports (site_id, status, created_at);

alter table public.abuse_events enable row level security;
alter table public.abuse_events force row level security;
alter table public.contact_reports enable row level security;
alter table public.contact_reports force row level security;
alter table public.caller_blocks enable row level security;
alter table public.caller_blocks force row level security;
revoke all on table public.abuse_events, public.contact_reports, public.caller_blocks
from public, anon, authenticated;
grant all on table public.abuse_events, public.contact_reports, public.caller_blocks to service_role;
grant select, update on table public.contact_reports to authenticated;
grant select on table public.caller_blocks to authenticated;

create policy contact_reports_admin_select on public.contact_reports
for select to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id, site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN', 'SITE_OPERATOR']
  )
);
create policy contact_reports_admin_update on public.contact_reports
for update to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id, site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
)
with check (
  app_private.current_admin_has_site_scope(
    tenant_id, site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
);
create policy caller_blocks_admin_select on public.caller_blocks
for select to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id, site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
);

create or replace function public.record_public_abuse_event(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset public.qr_assets%rowtype;
  created_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if (p_input ->> 'public_token_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'anonymous_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'network_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'event_type') not in (
      'RATE_LIMITED', 'CAPTCHA_FAILED', 'MESSAGE_BLOCKED', 'REPEATED_REQUEST'
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_ABUSE_EVENT';
  end if;
  select * into asset from public.qr_assets
  where public_token_hash = p_input ->> 'public_token_hash';
  if asset.id is null then
    raise exception using errcode = 'P0002', message = 'PUBLIC_CONTACT_UNAVAILABLE';
  end if;
  insert into public.abuse_events (
    tenant_id, site_id, qr_asset_id, anonymous_hash, network_hash, event_type, reason_code
  )
  values (
    asset.tenant_id, asset.site_id, asset.id,
    p_input ->> 'anonymous_hash', p_input ->> 'network_hash',
    (p_input ->> 'event_type')::public.abuse_event_type,
    coalesce(nullif(p_input ->> 'reason_code', ''), 'POLICY_BLOCKED')
  )
  returning id into created_id;
  return jsonb_build_object('recorded', true, 'event_id', created_id);
end;
$$;

create or replace function public.is_public_contact_blocked(
  p_public_token_hash text,
  p_anonymous_hash text,
  p_network_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset public.qr_assets%rowtype;
begin
  if auth.role() <> 'service_role'
    or p_public_token_hash !~ '^[0-9a-f]{64}$'
    or p_anonymous_hash !~ '^[0-9a-f]{64}$'
    or p_network_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = '42501', message = 'BLOCK_CHECK_NOT_ALLOWED';
  end if;
  select * into asset from public.qr_assets
  where public_token_hash = p_public_token_hash;
  if asset.id is null then
    raise exception using errcode = 'P0002', message = 'PUBLIC_CONTACT_UNAVAILABLE';
  end if;
  return exists (
    select 1
    from public.caller_blocks as block
    where block.tenant_id = asset.tenant_id
      and block.site_id = asset.site_id
      and block.revoked_at is null
      and block.expires_at > statement_timestamp()
      and (
        block.anonymous_hash = p_anonymous_hash
        or block.network_hash = p_network_hash
      )
  );
end;
$$;

create or replace function public.read_contact_escalation_state(
  p_session_token_hash text,
  p_anonymous_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session public.contact_sessions%rowtype;
  elapsed integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  select target.* into session
  from public.contact_sessions as target
  join public.session_participants as participant
    on participant.tenant_id = target.tenant_id and participant.session_id = target.id
    and participant.participant_type = 'CALLER' and participant.left_at is null
  where target.session_token_hash = p_session_token_hash
    and target.caller_anonymous_hash = p_anonymous_token_hash
    and participant.anonymous_token_hash = p_anonymous_token_hash;
  if session.id is null then
    raise exception using errcode = 'P0002', message = 'CONTACT_SESSION_UNAVAILABLE';
  end if;
  elapsed := floor(extract(epoch from (statement_timestamp() - session.created_at)));
  return jsonb_build_object(
    'stage', case when elapsed >= 180 then 'OFFICE_AVAILABLE'
                  when elapsed >= 60 then 'REMINDER' else 'WAITING' end,
    'office_available', elapsed >= 180 and session.status in ('OWNER_NOTIFIED', 'NOTIFICATION_QUEUED'),
    'elapsed_seconds', greatest(elapsed, 0)
  );
end;
$$;

create or replace function public.request_contact_office_alert(
  p_session_token_hash text,
  p_anonymous_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session public.contact_sessions%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  select target.* into session
  from public.contact_sessions as target
  join public.session_participants as participant
    on participant.tenant_id = target.tenant_id and participant.session_id = target.id
    and participant.participant_type = 'CALLER' and participant.left_at is null
  where target.session_token_hash = p_session_token_hash
    and target.caller_anonymous_hash = p_anonymous_token_hash
    and participant.anonymous_token_hash = p_anonymous_token_hash
  for update of target;
  if session.id is null
    or session.created_at > statement_timestamp() - interval '180 seconds'
    or session.status not in ('OWNER_NOTIFIED', 'NOTIFICATION_QUEUED')
  then
    raise exception using errcode = 'P0001', message = 'OFFICE_ALERT_NOT_AVAILABLE';
  end if;
  update public.contact_sessions
  set status = 'ESCALATED', escalated_at = statement_timestamp(),
      updated_at = statement_timestamp(), version = version + 1
  where tenant_id = session.tenant_id and id = session.id;
  insert into public.notification_deliveries (
    tenant_id, site_id, session_id, channel, purpose, destination_hash,
    idempotency_key, status
  )
  values (
    session.tenant_id, session.site_id, session.id, 'WEB_PUSH', 'ADMIN_ALERT',
    session.caller_anonymous_hash,
    encode(sha256(convert_to('admin-alert:' || session.id::text, 'UTF8')), 'hex'),
    'QUEUED'
  )
  on conflict (idempotency_key) do nothing;
  insert into public.audit_logs (
    tenant_id, site_id, actor_type, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    session.tenant_id, session.site_id, 'CALLER', 'SITE_OFFICE_ALERT_REQUESTED',
    'CONTACT_SESSION', session.id, jsonb_build_object('status', 'ESCALATED'),
    'SITE_OFFICE_ALERT_REQUESTED', gen_random_uuid()
  );
  return jsonb_build_object('status', 'ESCALATED');
end;
$$;

create or replace function public.report_contact_session(
  p_session_token_hash text,
  p_anonymous_token_hash text,
  p_reason_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session public.contact_sessions%rowtype;
  report_id uuid;
begin
  if auth.role() <> 'service_role' or length(p_reason_code) not between 3 and 64 then
    raise exception using errcode = '42501', message = 'REPORT_NOT_ALLOWED';
  end if;
  select target.* into session
  from public.contact_sessions as target
  join public.session_participants as participant
    on participant.tenant_id = target.tenant_id and participant.session_id = target.id
    and participant.participant_type = 'CALLER' and participant.left_at is null
  where target.session_token_hash = p_session_token_hash
    and target.caller_anonymous_hash = p_anonymous_token_hash
    and participant.anonymous_token_hash = p_anonymous_token_hash;
  if session.id is null then
    raise exception using errcode = 'P0002', message = 'CONTACT_SESSION_UNAVAILABLE';
  end if;
  insert into public.contact_reports (
    tenant_id, site_id, session_id, reporter_type, reason_code
  )
  values (session.tenant_id, session.site_id, session.id, 'CALLER', p_reason_code)
  returning id into report_id;
  return jsonb_build_object('report_id', report_id, 'status', 'OPEN');
end;
$$;

create or replace function public.process_contact_report(
  p_report_id uuid,
  p_status public.contact_report_status,
  p_reason text,
  p_block_hours integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  report public.contact_reports%rowtype;
  session public.contact_sessions%rowtype;
  last_network_hash text;
begin
  if auth.role() <> 'authenticated' or p_status not in ('REVIEWED', 'BLOCKED', 'DISMISSED')
    or length(trim(p_reason)) not between 3 and 500 or p_block_hours not between 1 and 720
  then
    raise exception using errcode = '42501', message = 'REPORT_PROCESS_NOT_ALLOWED';
  end if;
  select * into report from public.contact_reports where id = p_report_id for update;
  if report.id is null or report.status <> 'OPEN'
    or not app_private.current_admin_has_site_scope(
      report.tenant_id, report.site_id,
      array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
    )
  then
    raise exception using errcode = '42501', message = 'REPORT_PROCESS_NOT_ALLOWED';
  end if;
  select * into session from public.contact_sessions
  where tenant_id = report.tenant_id and id = report.session_id;
  select attempt.network_hash into last_network_hash
  from public.public_contact_attempts as attempt
  where attempt.tenant_id = report.tenant_id
    and attempt.site_id = report.site_id
    and attempt.qr_asset_id = session.qr_asset_id
    and attempt.anonymous_hash = session.caller_anonymous_hash
  order by attempt.created_at desc
  limit 1;
  if p_status = 'BLOCKED' and last_network_hash is null then
    raise exception using errcode = 'P0001', message = 'REPORT_BLOCK_EVIDENCE_MISSING';
  end if;
  update public.contact_reports
  set status = p_status, disposition_reason = trim(p_reason),
      processed_by = auth.uid(), processed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = report.id;
  if p_status = 'BLOCKED' then
    insert into public.caller_blocks (
      tenant_id, site_id, anonymous_hash, network_hash, reason_code,
      blocked_by, expires_at
    )
    values (
      report.tenant_id, report.site_id, session.caller_anonymous_hash,
      last_network_hash, 'ADMIN_REPORT_BLOCK', auth.uid(),
      statement_timestamp() + make_interval(hours => p_block_hours)
    )
    on conflict (tenant_id, site_id, anonymous_hash) where revoked_at is null
    do update set expires_at = excluded.expires_at, reason_code = excluded.reason_code;
  end if;
  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    report.tenant_id, report.site_id, 'ADMIN', auth.uid(), 'CONTACT_REPORT_PROCESSED',
    'CONTACT_REPORT', report.id, jsonb_build_object('status', p_status),
    trim(p_reason), gen_random_uuid()
  );
  return jsonb_build_object('status', p_status);
end;
$$;

revoke all on function public.record_public_abuse_event(jsonb) from public, anon, authenticated;
revoke all on function public.is_public_contact_blocked(text, text, text)
from public, anon, authenticated;
revoke all on function public.read_contact_escalation_state(text, text) from public, anon, authenticated;
revoke all on function public.request_contact_office_alert(text, text) from public, anon, authenticated;
revoke all on function public.report_contact_session(text, text, text) from public, anon, authenticated;
revoke all on function public.process_contact_report(uuid, public.contact_report_status, text, integer)
from public, anon;
grant execute on function public.record_public_abuse_event(jsonb) to service_role;
grant execute on function public.is_public_contact_blocked(text, text, text) to service_role;
grant execute on function public.read_contact_escalation_state(text, text) to service_role;
grant execute on function public.request_contact_office_alert(text, text) to service_role;
grant execute on function public.report_contact_session(text, text, text) to service_role;
grant execute on function public.process_contact_report(uuid, public.contact_report_status, text, integer)
to authenticated;

commit;
