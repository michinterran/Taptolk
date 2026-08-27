begin;

create table public.owner_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete restrict,
  owner_device_id uuid not null references public.owner_devices (id) on delete restrict,
  endpoint_hash text not null unique,
  subscription jsonb not null,
  status text not null default 'ACTIVE',
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_owner_push_endpoint_hash check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_owner_push_status check (status in ('ACTIVE', 'REVOKED')),
  constraint chk_owner_push_subscription_shape check (
    jsonb_typeof(subscription) = 'object'
    and length(subscription ->> 'endpoint') between 16 and 2000
    and jsonb_typeof(subscription -> 'keys') = 'object'
    and length(subscription #>> '{keys,auth}') between 8 and 512
    and length(subscription #>> '{keys,p256dh}') between 16 and 512
  ),
  constraint chk_owner_push_state check (
    (status = 'ACTIVE' and revoked_at is null)
    or (status = 'REVOKED' and revoked_at is not null)
  )
);

create index idx_owner_push_owner_active
on public.owner_push_subscriptions (owner_id, last_seen_at desc)
where status = 'ACTIVE';
create index idx_owner_push_device_active
on public.owner_push_subscriptions (owner_device_id, last_seen_at desc)
where status = 'ACTIVE';

alter table public.owner_push_subscriptions enable row level security;
alter table public.owner_push_subscriptions force row level security;
revoke all on table public.owner_push_subscriptions from public, anon, authenticated;
grant all on table public.owner_push_subscriptions to service_role;

create or replace function app_private.owner_session_context(
  p_session_hash text,
  p_device_hash text
)
returns table(owner_id uuid, owner_device_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_session public.owner_sessions%rowtype;
  device public.owner_devices%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_session_hash !~ '^[0-9a-f]{64}$' or p_device_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'OWNER_SESSION_INVALID';
  end if;

  select * into owner_session
  from public.owner_sessions
  where session_hash = p_session_hash
    and status = 'ACTIVE'
    and expires_at > clock_timestamp()
  for update;
  if owner_session.id is null then
    raise exception using errcode = 'P0002', message = 'OWNER_SESSION_UNAVAILABLE';
  end if;

  select * into device
  from public.owner_devices
  where id = owner_session.owner_device_id
  for update;
  if device.id is null or device.device_hash <> p_device_hash or device.status <> 'ACTIVE' then
    raise exception using errcode = 'P0002', message = 'OWNER_SESSION_UNAVAILABLE';
  end if;

  update public.owner_sessions
  set last_seen_at = clock_timestamp()
  where id = owner_session.id;
  update public.owner_devices
  set last_seen_at = clock_timestamp()
  where id = device.id;

  owner_id := owner_session.owner_id;
  owner_device_id := device.id;
  return next;
end;
$$;

create or replace function public.list_owner_vehicles(
  p_session_hash text,
  p_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
begin
  select * into ctx from app_private.owner_session_context(p_session_hash, p_device_hash);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'vehicle_id', vehicle.id,
      'plate_last4', vehicle.plate_last4,
      'site_id', relationship.site_id,
      'site_display_name', site.name,
      'qr_status', asset.status
    ) order by relationship.started_at desc), '[]'::jsonb)
    from public.vehicle_owners as relationship
    join public.vehicles as vehicle
      on vehicle.tenant_id = relationship.tenant_id
      and vehicle.site_id = relationship.site_id
      and vehicle.id = relationship.vehicle_id
    join public.sites as site
      on site.tenant_id = relationship.tenant_id
      and site.id = relationship.site_id
    left join public.qr_bindings as binding
      on binding.tenant_id = relationship.tenant_id
      and binding.site_id = relationship.site_id
      and binding.vehicle_id = vehicle.id
      and binding.ended_at is null
      and binding.is_primary
    left join public.qr_assets as asset on asset.id = binding.qr_asset_id
    where relationship.owner_id = ctx.owner_id and relationship.ended_at is null
  );
end;
$$;

create or replace function public.list_owner_contact_messages(
  p_session_hash text,
  p_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
begin
  select * into ctx from app_private.owner_session_context(p_session_hash, p_device_hash);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'session_id', session.id,
      'status', session.status,
      'reason_code', session.reason_code,
      'caller_message', caller_message.body,
      'created_at', session.created_at,
      'vehicle_plate_last4', vehicle.plate_last4
    ) order by session.created_at), '[]'::jsonb)
    from public.contact_sessions as session
    join public.session_participants as participant
      on participant.tenant_id = session.tenant_id
      and participant.session_id = session.id
      and participant.participant_type = 'OWNER'
      and participant.owner_id = ctx.owner_id
      and participant.left_at is null
    join public.vehicles as vehicle
      on vehicle.tenant_id = session.tenant_id
      and vehicle.id = session.vehicle_id
    join lateral (
      select message.body
      from public.messages as message
      where message.tenant_id = session.tenant_id
        and message.session_id = session.id
        and message.sender_type = 'CALLER'
        and message.moderation_status = 'ACCEPTED'
      order by message.created_at
      limit 1
    ) as caller_message on true
    where session.status in ('NOTIFICATION_QUEUED', 'OWNER_NOTIFIED', 'OWNER_VIEWED')
      and session.expires_at > clock_timestamp()
  );
end;
$$;

create or replace function public.list_owner_contact_history(
  p_session_hash text,
  p_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
begin
  select * into ctx from app_private.owner_session_context(p_session_hash, p_device_hash);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'session_id', ordered.id,
      'created_at', ordered.created_at,
      'reason_code', ordered.reason_code,
      'result', case when ordered.owner_replied_at is null then 'UNANSWERED' else 'ANSWERED' end,
      'response_seconds', case
        when ordered.owner_replied_at is null then null
        else greatest(1, floor(extract(epoch from ordered.owner_replied_at - ordered.created_at)))::integer
      end
    ) order by ordered.created_at desc), '[]'::jsonb)
    from (
      select session.*
      from public.contact_sessions as session
      join public.session_participants as participant
        on participant.tenant_id = session.tenant_id
        and participant.session_id = session.id
        and participant.participant_type = 'OWNER'
        and participant.owner_id = ctx.owner_id
      where session.status not in ('NOTIFICATION_QUEUED', 'OWNER_NOTIFIED', 'OWNER_VIEWED')
         or session.expires_at <= clock_timestamp()
      order by session.created_at desc
      limit 50
    ) as ordered
  );
end;
$$;

create or replace function public.read_owner_push_subscription_state(
  p_session_hash text,
  p_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
begin
  select * into ctx from app_private.owner_session_context(p_session_hash, p_device_hash);
  return jsonb_build_object(
    'subscribed',
    exists (
      select 1
      from public.owner_push_subscriptions as subscription
      where subscription.owner_device_id = ctx.owner_device_id
        and subscription.status = 'ACTIVE'
    )
  );
end;
$$;

create or replace function public.save_owner_push_subscription(
  p_session_hash text,
  p_device_hash text,
  p_endpoint_hash text,
  p_subscription jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
begin
  if p_endpoint_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'OWNER_PUSH_INVALID';
  end if;
  select * into ctx from app_private.owner_session_context(p_session_hash, p_device_hash);
  insert into public.owner_push_subscriptions (
    owner_id, owner_device_id, endpoint_hash, subscription, status,
    last_seen_at, revoked_at, updated_at
  )
  values (
    ctx.owner_id, ctx.owner_device_id, p_endpoint_hash, p_subscription,
    'ACTIVE', clock_timestamp(), null, clock_timestamp()
  )
  on conflict (endpoint_hash)
  do update set
    owner_id = excluded.owner_id,
    owner_device_id = excluded.owner_device_id,
    subscription = excluded.subscription,
    status = 'ACTIVE',
    last_seen_at = clock_timestamp(),
    revoked_at = null,
    updated_at = clock_timestamp();
  return jsonb_build_object('subscribed', true);
end;
$$;

create or replace function public.revoke_owner_push_subscription(
  p_session_hash text,
  p_device_hash text,
  p_endpoint_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
begin
  if p_endpoint_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'OWNER_PUSH_INVALID';
  end if;
  select * into ctx from app_private.owner_session_context(p_session_hash, p_device_hash);
  update public.owner_push_subscriptions
  set status = 'REVOKED', revoked_at = clock_timestamp(), updated_at = clock_timestamp()
  where owner_device_id = ctx.owner_device_id
    and endpoint_hash = p_endpoint_hash
    and status = 'ACTIVE';
  return jsonb_build_object(
    'subscribed',
    exists (
      select 1
      from public.owner_push_subscriptions as subscription
      where subscription.owner_device_id = ctx.owner_device_id
        and subscription.status = 'ACTIVE'
    )
  );
end;
$$;

create or replace function app_private.enqueue_owner_web_push_delivery()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.participant_type <> 'OWNER' or new.owner_id is null then
    return new;
  end if;

  insert into public.notification_deliveries (
    tenant_id, site_id, session_id, owner_id, channel, purpose,
    destination_hash, idempotency_key, status
  )
  select
    session.tenant_id,
    session.site_id,
    session.id,
    new.owner_id,
    'WEB_PUSH',
    'OWNER_CONTACT',
    subscription.endpoint_hash,
    lower(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
    'QUEUED'
  from public.contact_sessions as session
  join public.owner_push_subscriptions as subscription
    on subscription.owner_id = new.owner_id
    and subscription.status = 'ACTIVE'
  where session.tenant_id = new.tenant_id
    and session.id = new.session_id
    and session.status = 'NOTIFICATION_QUEUED';
  return new;
end;
$$;

create trigger trg_owner_web_push_delivery_enqueue
after insert on public.session_participants
for each row execute function app_private.enqueue_owner_web_push_delivery();

create or replace function public.claim_web_push_notification_deliveries(
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
      where delivery.channel = 'WEB_PUSH'
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
          provider = 'WEB_PUSH',
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
      subscription.subscription,
      session.reason_code
    from updated
    join public.owner_push_subscriptions as subscription
      on subscription.owner_id = updated.owner_id
      and subscription.endpoint_hash = updated.destination_hash
      and subscription.status = 'ACTIVE'
    join public.contact_sessions as session
      on session.tenant_id = updated.tenant_id and session.id = updated.session_id
  loop
    return next jsonb_build_object(
      'delivery_id', claimed.delivery_id,
      'idempotency_key', claimed.idempotency_key,
      'lease_version', claimed.lease_version,
      'reason_code', claimed.reason_code,
      'subscription', claimed.subscription
    );
  end loop;
end;
$$;

revoke all on function app_private.owner_session_context(text, text)
from public, anon, authenticated;
revoke all on function public.list_owner_contact_messages(text, text)
from public, anon, authenticated;
revoke all on function public.list_owner_contact_history(text, text)
from public, anon, authenticated;
revoke all on function public.read_owner_push_subscription_state(text, text)
from public, anon, authenticated;
revoke all on function public.save_owner_push_subscription(text, text, text, jsonb)
from public, anon, authenticated;
revoke all on function public.revoke_owner_push_subscription(text, text, text)
from public, anon, authenticated;
revoke all on function app_private.enqueue_owner_web_push_delivery()
from public, anon, authenticated;
revoke all on function public.claim_web_push_notification_deliveries(text, integer, integer)
from public, anon, authenticated;

grant execute on function public.list_owner_contact_messages(text, text) to service_role;
grant execute on function public.list_owner_contact_history(text, text) to service_role;
grant execute on function public.read_owner_push_subscription_state(text, text) to service_role;
grant execute on function public.save_owner_push_subscription(text, text, text, jsonb) to service_role;
grant execute on function public.revoke_owner_push_subscription(text, text, text) to service_role;
grant execute on function public.claim_web_push_notification_deliveries(text, integer, integer)
to service_role;

comment on table public.owner_push_subscriptions is
'Service-only browser Web Push subscriptions for Owner devices. Endpoints are hash-addressed and never logged or returned.';
comment on function public.list_owner_contact_messages(text, text) is
'Lists active caller requests for the authenticated Owner device without phone data.';
comment on function public.list_owner_contact_history(text, text) is
'Lists recent Owner contact history. Missing response duration remains null, never zero.';

commit;
