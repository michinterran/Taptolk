begin;

create type public.response_token_scope as enum ('CONTACT_REPLY');

create table public.response_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  session_id uuid not null,
  delivery_id uuid not null,
  token_hash text not null unique,
  scope public.response_token_scope not null default 'CONTACT_REPLY',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fk_response_tokens_session
    foreign key (tenant_id, session_id)
    references public.contact_sessions (tenant_id, id)
    on delete cascade,
  constraint fk_response_tokens_delivery
    foreign key (delivery_id)
    references public.notification_deliveries (id)
    on delete cascade,
  constraint chk_response_tokens_hash check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_response_tokens_window check (
    expires_at > created_at
    and (revoked_at is null or revoked_at >= created_at)
    and (used_at is null or used_at >= created_at)
  ),
  constraint chk_response_tokens_use check (
    used_at is null or revoked_at is not null
  )
);

create unique index uq_response_tokens_active_contact_reply
on public.response_tokens (session_id)
where scope = 'CONTACT_REPLY' and revoked_at is null and used_at is null;
create index idx_response_tokens_hash_active
on public.response_tokens (token_hash, expires_at)
where revoked_at is null;

alter table public.notification_deliveries
  add column lease_owner text,
  add column lease_version integer not null default 0,
  add column lease_expires_at timestamptz,
  add column first_attempted_at timestamptz,
  add column last_attempted_at timestamptz,
  add column archived_at timestamptz,
  add constraint chk_notification_delivery_lease check (
    (
      status = 'PROCESSING'
      and lease_owner is not null
      and length(lease_owner) between 8 and 100
      and lease_expires_at is not null
    )
    or (
      status <> 'PROCESSING'
      and lease_owner is null
      and lease_expires_at is null
    )
  ),
  add constraint chk_notification_delivery_attempts check (
    lease_version >= 0
    and retry_count between 0 and max_retries
    and max_retries between 1 and 10
  ),
  add constraint chk_notification_delivery_archive check (
    (status = 'FAILED_FINAL' and archived_at is not null)
    or (status <> 'FAILED_FINAL' and archived_at is null)
  );

create index idx_notification_deliveries_claim
on public.notification_deliveries (scheduled_at, created_at)
where status in ('QUEUED', 'FAILED_RETRYABLE', 'PROCESSING');

alter table public.response_tokens enable row level security;
alter table public.response_tokens force row level security;
revoke all on table public.response_tokens from public, anon, authenticated;
grant all on table public.response_tokens to service_role;

create or replace function public.claim_notification_deliveries(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed record;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if length(p_worker_id) not between 8 and 100
    or p_limit not between 1 and 100
    or p_lease_seconds not between 5 and 300
  then
    raise exception using errcode = '22023', message = 'INVALID_NOTIFICATION_CLAIM';
  end if;

  for claimed in
    with candidates as (
      select delivery.id
      from public.notification_deliveries as delivery
      where delivery.channel = 'SMS'
        and delivery.purpose = 'OWNER_CONTACT'
        and (
          (
            delivery.status in ('QUEUED', 'FAILED_RETRYABLE')
            and delivery.scheduled_at <= statement_timestamp()
          )
          or (
            delivery.status = 'PROCESSING'
            and delivery.lease_expires_at <= statement_timestamp()
          )
        )
      order by delivery.scheduled_at, delivery.created_at
      for update skip locked
      limit p_limit
    ),
    updated as (
      update public.notification_deliveries as delivery
      set status = 'PROCESSING',
          provider = 'STAGING_SAFE',
          lease_owner = p_worker_id,
          lease_version = delivery.lease_version + 1,
          lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds),
          first_attempted_at = coalesce(delivery.first_attempted_at, statement_timestamp()),
          last_attempted_at = statement_timestamp(),
          updated_at = statement_timestamp()
      from candidates
      where delivery.id = candidates.id
      returning delivery.*
    )
    select
      updated.id as delivery_id,
      updated.tenant_id,
      updated.session_id,
      updated.owner_id,
      updated.idempotency_key,
      updated.lease_version,
      owner.phone_ciphertext as destination_ciphertext,
      session.reason_code,
      vehicle.plate_last4,
      site.name as site_display_name
    from updated
    join public.owners as owner on owner.id = updated.owner_id and owner.status = 'ACTIVE'
    join public.contact_sessions as session
      on session.tenant_id = updated.tenant_id and session.id = updated.session_id
    join public.vehicles as vehicle
      on vehicle.tenant_id = session.tenant_id and vehicle.id = session.vehicle_id
    join public.sites as site
      on site.tenant_id = updated.tenant_id and site.id = updated.site_id
  loop
    update public.response_tokens
    set revoked_at = statement_timestamp()
    where session_id = claimed.session_id
      and scope = 'CONTACT_REPLY'
      and revoked_at is null
      and used_at is null;

    return next jsonb_build_object(
      'delivery_id', claimed.delivery_id,
      'destination_ciphertext', claimed.destination_ciphertext,
      'idempotency_key', claimed.idempotency_key,
      'lease_version', claimed.lease_version,
      'reason_code', claimed.reason_code,
      'vehicle_plate_last4', claimed.plate_last4,
      'site_display_name', claimed.site_display_name
    );
  end loop;
end;
$$;

create or replace function public.attach_notification_response_token(
  p_delivery_id uuid,
  p_worker_id text,
  p_lease_version integer,
  p_token_hash text,
  p_ttl_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery public.notification_deliveries%rowtype;
  token_row public.response_tokens%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_ttl_seconds <> 3600 then
    raise exception using errcode = '22023', message = 'INVALID_RESPONSE_TOKEN';
  end if;
  select * into delivery
  from public.notification_deliveries
  where id = p_delivery_id
  for update;
  if delivery.status <> 'PROCESSING'
    or delivery.lease_owner <> p_worker_id
    or delivery.lease_version <> p_lease_version
    or delivery.lease_expires_at <= statement_timestamp()
  then
    raise exception using errcode = 'P0001', message = 'NOTIFICATION_LEASE_LOST';
  end if;
  insert into public.response_tokens (
    tenant_id, session_id, delivery_id, token_hash, expires_at
  )
  values (
    delivery.tenant_id, delivery.session_id, delivery.id, p_token_hash,
    statement_timestamp() + make_interval(secs => p_ttl_seconds)
  )
  returning * into token_row;
  return jsonb_build_object('expires_at', token_row.expires_at);
end;
$$;

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
  select * into delivery from public.notification_deliveries where id = p_delivery_id for update;
  if delivery.status = 'SENT' and delivery.provider_message_id = p_provider_message_id then
    return jsonb_build_object('status', 'SENT', 'replayed', true);
  end if;
  if delivery.status <> 'PROCESSING'
    or delivery.lease_owner <> p_worker_id
    or delivery.lease_version <> p_lease_version
    or delivery.lease_expires_at <= statement_timestamp()
  then
    raise exception using errcode = 'P0001', message = 'NOTIFICATION_LEASE_LOST';
  end if;
  update public.notification_deliveries
  set status = 'SENT', provider_message_id = p_provider_message_id,
      sent_at = statement_timestamp(), error_code = null,
      lease_owner = null, lease_expires_at = null, updated_at = statement_timestamp()
  where id = delivery.id;
  update public.contact_sessions
  set status = 'OWNER_NOTIFIED', owner_notified_at = statement_timestamp(),
      updated_at = statement_timestamp(), version = version + 1
  where tenant_id = delivery.tenant_id and id = delivery.session_id
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

create or replace function public.record_notification_failure(
  p_delivery_id uuid,
  p_worker_id text,
  p_lease_version integer,
  p_error_code text,
  p_final boolean,
  p_next_attempt_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery public.notification_deliveries%rowtype;
  final_failure boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_error_code not in (
    'AUTH_ERROR', 'INVALID_RECIPIENT', 'RATE_LIMIT',
    'TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'UNKNOWN'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ERROR';
  end if;
  select * into delivery from public.notification_deliveries where id = p_delivery_id for update;
  if delivery.status <> 'PROCESSING'
    or delivery.lease_owner <> p_worker_id
    or delivery.lease_version <> p_lease_version
  then
    raise exception using errcode = 'P0001', message = 'NOTIFICATION_LEASE_LOST';
  end if;
  final_failure := p_final or delivery.retry_count + 1 >= delivery.max_retries;
  update public.notification_deliveries
  set status = case when final_failure then 'FAILED_FINAL'::public.notification_status
                    else 'FAILED_RETRYABLE'::public.notification_status end,
      retry_count = delivery.retry_count + 1,
      scheduled_at = case when final_failure then delivery.scheduled_at else p_next_attempt_at end,
      failed_at = statement_timestamp(), error_code = p_error_code,
      archived_at = case when final_failure then statement_timestamp() else null end,
      lease_owner = null, lease_expires_at = null, updated_at = statement_timestamp()
  where id = delivery.id;
  if final_failure then
    update public.contact_sessions
    set status = 'NOTIFICATION_FAILED', updated_at = statement_timestamp(), version = version + 1
    where tenant_id = delivery.tenant_id and id = delivery.session_id
      and status in ('NOTIFICATION_QUEUED', 'OWNER_NOTIFIED');
    update public.response_tokens
    set revoked_at = statement_timestamp()
    where delivery_id = delivery.id and revoked_at is null;
  end if;
  insert into public.audit_logs (
    tenant_id, site_id, actor_type, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    delivery.tenant_id, delivery.site_id, 'SYSTEM',
    case when final_failure then 'OWNER_NOTIFICATION_FAILED_FINAL'
         else 'OWNER_NOTIFICATION_RETRY_SCHEDULED' end,
    'NOTIFICATION_DELIVERY', delivery.id,
    jsonb_build_object(
      'status', case when final_failure then 'FAILED_FINAL' else 'FAILED_RETRYABLE' end,
      'errorCode', p_error_code, 'attempt', delivery.lease_version
    ),
    p_error_code, gen_random_uuid()
  );
  return jsonb_build_object(
    'status', case when final_failure then 'FAILED_FINAL' else 'FAILED_RETRYABLE' end
  );
end;
$$;

create or replace function public.inspect_owner_response(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_RESPONSE_TOKEN';
  end if;
  select jsonb_build_object(
    'reason_code', session.reason_code,
    'caller_message', caller_message.body,
    'vehicle_plate_last4', vehicle.plate_last4,
    'site_display_name', site.name,
    'expires_at', token.expires_at
  )
  into result
  from public.response_tokens as token
  join public.contact_sessions as session
    on session.tenant_id = token.tenant_id and session.id = token.session_id
  join public.vehicles as vehicle
    on vehicle.tenant_id = session.tenant_id and vehicle.id = session.vehicle_id
  join public.sites as site
    on site.tenant_id = session.tenant_id and site.id = session.site_id
  join lateral (
    select message.body
    from public.messages as message
    where message.session_id = session.id and message.sender_type = 'CALLER'
    order by message.created_at
    limit 1
  ) as caller_message on true
  where token.token_hash = p_token_hash
    and token.scope = 'CONTACT_REPLY'
    and token.revoked_at is null
    and token.used_at is null
    and token.expires_at > statement_timestamp()
    and session.status in ('OWNER_NOTIFIED', 'OWNER_VIEWED');
  if result is null then
    raise exception using errcode = 'P0002', message = 'OWNER_RESPONSE_UNAVAILABLE';
  end if;
  return result;
end;
$$;

create or replace function public.submit_owner_response(
  p_token_hash text,
  p_reply_code text,
  p_body text,
  p_body_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  token public.response_tokens%rowtype;
  session public.contact_sessions%rowtype;
  owner_id uuid;
  stored_body text;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_body_hash !~ '^[0-9a-f]{64}$'
    or p_reply_code not in (
      'MOVING_NOW', 'MOVE_IN_3_MINUTES', 'MOVE_IN_5_MINUTES', 'MOVE_IN_10_MINUTES',
      'CANNOT_MOVE_NOW', 'CONTACT_SITE_OFFICE', 'CUSTOM'
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_OWNER_REPLY';
  end if;
  stored_body := case p_reply_code
    when 'MOVING_NOW' then '지금 이동하겠습니다.'
    when 'MOVE_IN_3_MINUTES' then '3분 이내 이동하겠습니다.'
    when 'MOVE_IN_5_MINUTES' then '5분 이내 이동하겠습니다.'
    when 'MOVE_IN_10_MINUTES' then '10분 이내 이동하겠습니다.'
    when 'CANNOT_MOVE_NOW' then '지금은 이동하기 어렵습니다.'
    when 'CONTACT_SITE_OFFICE' then '관리사무소에 문의해 주세요.'
    else trim(p_body)
  end;
  if length(stored_body) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_OWNER_REPLY';
  end if;
  select * into token
  from public.response_tokens
  where token_hash = p_token_hash
  for update;
  if token.id is null or token.revoked_at is not null or token.used_at is not null
    or token.expires_at <= statement_timestamp()
  then
    raise exception using errcode = 'P0002', message = 'OWNER_RESPONSE_UNAVAILABLE';
  end if;
  select * into session
  from public.contact_sessions
  where tenant_id = token.tenant_id and id = token.session_id
  for update;
  if session.status not in ('OWNER_NOTIFIED', 'OWNER_VIEWED') or session.owner_message_count >= 3 then
    raise exception using errcode = 'P0002', message = 'OWNER_RESPONSE_UNAVAILABLE';
  end if;
  select participant.owner_id into owner_id
  from public.session_participants as participant
  where participant.tenant_id = session.tenant_id
    and participant.session_id = session.id
    and participant.participant_type = 'OWNER'
    and participant.left_at is null;
  insert into public.messages (
    tenant_id, session_id, sender_type, sender_owner_id, message_type,
    body, body_hash, reply_code
  )
  values (
    session.tenant_id, session.id, 'OWNER', owner_id, 'TEMPLATE',
    stored_body, p_body_hash, p_reply_code
  );
  update public.contact_sessions
  set status = 'OWNER_REPLIED', owner_message_count = owner_message_count + 1,
      owner_replied_at = statement_timestamp(), updated_at = statement_timestamp(),
      version = version + 1
  where tenant_id = session.tenant_id and id = session.id;
  update public.response_tokens
  set used_at = statement_timestamp(), revoked_at = statement_timestamp()
  where id = token.id;
  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    session.tenant_id, session.site_id, 'OWNER', owner_id, 'OWNER_CONTACT_REPLIED',
    'CONTACT_SESSION', session.id,
    jsonb_build_object('status', 'OWNER_REPLIED', 'replyCode', p_reply_code),
    'OWNER_CONTACT_REPLIED', gen_random_uuid()
  );
  return jsonb_build_object('status', 'OWNER_REPLIED');
end;
$$;

revoke all on function public.claim_notification_deliveries(text, integer, integer)
from public, anon, authenticated;
revoke all on function public.attach_notification_response_token(uuid, text, integer, text, integer)
from public, anon, authenticated;
revoke all on function public.record_notification_sent(uuid, text, integer, text)
from public, anon, authenticated;
revoke all on function public.record_notification_failure(uuid, text, integer, text, boolean, timestamptz)
from public, anon, authenticated;
revoke all on function public.inspect_owner_response(text) from public, anon, authenticated;
revoke all on function public.submit_owner_response(text, text, text, text)
from public, anon, authenticated;

grant execute on function public.claim_notification_deliveries(text, integer, integer) to service_role;
grant execute on function public.attach_notification_response_token(uuid, text, integer, text, integer)
to service_role;
grant execute on function public.record_notification_sent(uuid, text, integer, text) to service_role;
grant execute on function public.record_notification_failure(uuid, text, integer, text, boolean, timestamptz)
to service_role;
grant execute on function public.inspect_owner_response(text) to service_role;
grant execute on function public.submit_owner_response(text, text, text, text) to service_role;

comment on table public.response_tokens is
  'Hash-only, short-lived CONTACT_REPLY authorization. Raw token is never persisted.';

commit;
