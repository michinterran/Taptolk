begin;

create type public.contact_session_status as enum (
  'CREATED',
  'MESSAGE_SUBMITTED',
  'NOTIFICATION_QUEUED',
  'OWNER_NOTIFIED',
  'OWNER_VIEWED',
  'OWNER_REPLIED',
  'CALLER_VIEWED',
  'RESOLVED',
  'NOTIFICATION_FAILED',
  'ESCALATED',
  'EXPIRED',
  'BLOCKED',
  'CANCELLED'
);
create type public.contact_participant_type as enum ('CALLER', 'OWNER', 'ADMIN');
create type public.contact_message_type as enum ('TEMPLATE', 'FREE_TEXT', 'SYSTEM');
create type public.message_moderation_status as enum ('ACCEPTED', 'BLOCKED', 'EVIDENCE_LOCKED');
create type public.notification_channel as enum ('SMS', 'WEB_PUSH');
create type public.notification_purpose as enum (
  'OWNER_CONTACT',
  'CALLER_REPLY',
  'OTP',
  'ADMIN_ALERT'
);
create type public.notification_status as enum (
  'QUEUED',
  'PROCESSING',
  'SENT',
  'DELIVERED',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'CANCELLED'
);

create table public.contact_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_asset_id uuid not null,
  vehicle_id uuid not null,
  session_token_hash text not null unique,
  caller_anonymous_hash text not null,
  reason_code text not null,
  status public.contact_session_status not null default 'CREATED',
  caller_message_count integer not null default 0,
  owner_message_count integer not null default 0,
  owner_notified_at timestamptz,
  owner_viewed_at timestamptz,
  owner_replied_at timestamptz,
  caller_viewed_at timestamptz,
  escalated_at timestamptz,
  resolved_at timestamptz,
  expires_at timestamptz not null,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_contact_sessions_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint fk_contact_sessions_vehicle
    foreign key (tenant_id, site_id, vehicle_id)
    references public.vehicles (tenant_id, site_id, id)
    on delete restrict,
  constraint uq_contact_sessions_tenant_id unique (tenant_id, id),
  constraint chk_contact_sessions_hashes check (
    session_token_hash ~ '^[0-9a-f]{64}$'
    and caller_anonymous_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_contact_sessions_reason check (
    reason_code in (
      'MOVE_REQUEST',
      'EXIT_BLOCKED',
      'DOUBLE_PARKED',
      'VEHICLE_NOT_MOVING',
      'LIGHT_ON',
      'WINDOW_OPEN',
      'VEHICLE_DAMAGE',
      'ACCIDENT_CONTACT',
      'OTHER'
    )
  ),
  constraint chk_contact_sessions_counts check (
    caller_message_count between 0 and 3
    and owner_message_count between 0 and 3
  ),
  constraint chk_contact_sessions_expiry check (expires_at > created_at),
  constraint chk_contact_sessions_blocked check (
    (status = 'BLOCKED' and length(trim(blocked_reason)) between 3 and 500)
    or (status <> 'BLOCKED' and blocked_reason is null)
  )
);

create index idx_contact_sessions_qr_open
on public.contact_sessions (qr_asset_id, caller_anonymous_hash, reason_code, created_at desc);
create index idx_contact_sessions_tenant_status
on public.contact_sessions (tenant_id, status, created_at desc);

create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  session_id uuid not null,
  participant_type public.contact_participant_type not null,
  owner_id uuid references public.owners (id) on delete restrict,
  anonymous_token_hash text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  constraint fk_session_participants_session
    foreign key (tenant_id, session_id)
    references public.contact_sessions (tenant_id, id)
    on delete restrict,
  constraint chk_session_participants_identity check (
    (
      participant_type = 'CALLER'
      and owner_id is null
      and anonymous_token_hash ~ '^[0-9a-f]{64}$'
    )
    or (
      participant_type = 'OWNER'
      and owner_id is not null
      and anonymous_token_hash is null
    )
    or (
      participant_type = 'ADMIN'
      and owner_id is null
      and anonymous_token_hash is null
    )
  ),
  constraint chk_session_participants_left check (
    left_at is null or left_at >= joined_at
  )
);

create unique index uq_session_participants_active_caller
on public.session_participants (session_id)
where participant_type = 'CALLER' and left_at is null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  session_id uuid not null,
  sender_type public.contact_participant_type not null,
  sender_owner_id uuid references public.owners (id) on delete restrict,
  message_type public.contact_message_type not null,
  reason_code text,
  body text not null,
  body_hash text not null,
  reply_code text,
  moderation_status public.message_moderation_status not null default 'ACCEPTED',
  created_at timestamptz not null default now(),
  constraint fk_messages_session
    foreign key (tenant_id, session_id)
    references public.contact_sessions (tenant_id, id)
    on delete restrict,
  constraint chk_messages_sender check (
    (sender_type = 'OWNER' and sender_owner_id is not null)
    or (sender_type <> 'OWNER' and sender_owner_id is null)
  ),
  constraint chk_messages_reason check (
    reason_code is null
    or reason_code in (
      'MOVE_REQUEST',
      'EXIT_BLOCKED',
      'DOUBLE_PARKED',
      'VEHICLE_NOT_MOVING',
      'LIGHT_ON',
      'WINDOW_OPEN',
      'VEHICLE_DAMAGE',
      'ACCIDENT_CONTACT',
      'OTHER'
    )
  ),
  constraint chk_messages_body check (
    length(trim(body)) between 1 and 200
    and body !~* '(https?://|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})'
  ),
  constraint chk_messages_hash check (body_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_messages_reply_code check (
    reply_code is null or reply_code ~ '^[A-Z0-9][A-Z0-9_]{1,63}$'
  )
);

create index idx_messages_session_created
on public.messages (session_id, created_at);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  session_id uuid,
  owner_id uuid references public.owners (id) on delete restrict,
  channel public.notification_channel not null,
  purpose public.notification_purpose not null,
  destination_hash text not null,
  provider text not null default 'UNASSIGNED',
  provider_message_id text,
  idempotency_key text not null unique,
  status public.notification_status not null default 'QUEUED',
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  error_code text,
  cost_amount numeric(12, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_notification_deliveries_site
    foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id)
    on delete restrict,
  constraint fk_notification_deliveries_session
    foreign key (tenant_id, session_id)
    references public.contact_sessions (tenant_id, id)
    on delete restrict,
  constraint chk_notification_deliveries_destination_hash
    check (destination_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_notification_deliveries_idempotency_key
    check (idempotency_key ~ '^[0-9a-f]{64}$'),
  constraint chk_notification_deliveries_counts check (
    retry_count between 0 and max_retries and max_retries between 0 and 10
  ),
  constraint chk_notification_deliveries_provider check (
    length(trim(provider)) between 2 and 64
  ),
  constraint chk_notification_deliveries_error check (
    error_code is null or error_code ~ '^[A-Z0-9][A-Z0-9_]{1,63}$'
  ),
  constraint chk_notification_deliveries_cost check (
    cost_amount is null or cost_amount >= 0
  )
);

create index idx_notification_deliveries_status_scheduled
on public.notification_deliveries (status, scheduled_at);

create table public.public_contact_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_asset_id uuid not null,
  session_id uuid,
  anonymous_hash text not null,
  network_hash text not null,
  user_agent_hash text not null,
  message_hash text not null,
  result text not null,
  created_at timestamptz not null default now(),
  constraint fk_public_contact_attempts_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint fk_public_contact_attempts_session
    foreign key (tenant_id, session_id)
    references public.contact_sessions (tenant_id, id)
    on delete restrict,
  constraint chk_public_contact_attempts_hashes check (
    anonymous_hash ~ '^[0-9a-f]{64}$'
    and network_hash ~ '^[0-9a-f]{64}$'
    and user_agent_hash ~ '^[0-9a-f]{64}$'
    and message_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_public_contact_attempts_result check (
    result in ('CREATED', 'MERGED', 'BLOCKED')
  )
);

create index idx_public_contact_attempts_anon_qr
on public.public_contact_attempts (anonymous_hash, qr_asset_id, created_at desc);
create index idx_public_contact_attempts_anon_created
on public.public_contact_attempts (anonymous_hash, created_at desc);
create index idx_public_contact_attempts_network_qr
on public.public_contact_attempts (network_hash, qr_asset_id, created_at desc);
create index idx_public_contact_attempts_qr_created
on public.public_contact_attempts (qr_asset_id, created_at desc);

create trigger trg_contact_sessions_touch
before update on public.contact_sessions
for each row execute function app_private.touch_versioned_row();

create or replace function app_private.guard_public_contact_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '23514', message = 'PUBLIC_CONTACT_HISTORY_IMMUTABLE';
end;
$$;

create trigger trg_messages_immutable
before update or delete on public.messages
for each row execute function app_private.guard_public_contact_append_only();
create trigger trg_public_contact_attempts_immutable
before update or delete on public.public_contact_attempts
for each row execute function app_private.guard_public_contact_append_only();

alter table public.contact_sessions enable row level security;
alter table public.contact_sessions force row level security;
alter table public.session_participants enable row level security;
alter table public.session_participants force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_deliveries force row level security;
alter table public.public_contact_attempts enable row level security;
alter table public.public_contact_attempts force row level security;

revoke all on table public.contact_sessions from public, anon, authenticated;
revoke all on table public.session_participants from public, anon, authenticated;
revoke all on table public.messages from public, anon, authenticated;
revoke all on table public.notification_deliveries from public, anon, authenticated;
revoke all on table public.public_contact_attempts from public, anon, authenticated;
grant all on table public.contact_sessions to service_role;
grant all on table public.session_participants to service_role;
grant all on table public.messages to service_role;
grant all on table public.notification_deliveries to service_role;
grant all on table public.public_contact_attempts to service_role;

create or replace function public.inspect_public_contact(p_public_token_hash text)
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
  if p_public_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_TOKEN_HASH';
  end if;

  select jsonb_build_object(
    'qr_status', 'ACTIVE',
    'vehicle', jsonb_build_object(
      'plate_last4', vehicle.plate_last4,
      'color', null,
      'type', null
    ),
    'contact_enabled', true,
    'site_display_name', site.name
  )
  into result
  from public.qr_assets as asset
  join public.sites as site
    on site.tenant_id = asset.tenant_id and site.id = asset.site_id
  join public.qr_bindings as binding
    on binding.id = asset.current_binding_id
    and binding.qr_asset_id = asset.id
    and binding.ended_at is null
    and binding.is_primary
  join public.vehicles as vehicle
    on vehicle.id = binding.vehicle_id
    and vehicle.tenant_id = asset.tenant_id
    and vehicle.site_id = asset.site_id
    and vehicle.status = 'ACTIVE'
  join public.vehicle_owners as relationship
    on relationship.vehicle_id = vehicle.id
    and relationship.owner_id = binding.owner_id
    and relationship.ended_at is null
    and relationship.is_primary
  join public.owners as owner
    on owner.id = relationship.owner_id and owner.status = 'ACTIVE'
  where asset.public_token_hash = p_public_token_hash
    and asset.status = 'ACTIVE'
    and site.status = 'ACTIVE'
    and exists (
      select 1
      from public.contracts as contract
      where contract.tenant_id = asset.tenant_id
        and contract.management_company_id = asset.management_company_id
        and (contract.site_id is null or contract.site_id = asset.site_id)
        and contract.status = 'ACTIVE'
        and contract.start_date <= current_date
        and (contract.end_date is null or contract.end_date >= current_date)
    );

  if result is null then
    raise exception using errcode = 'P0002', message = 'PUBLIC_CONTACT_UNAVAILABLE';
  end if;
  return result;
end;
$$;

create or replace function public.create_public_contact_session(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.qr_assets%rowtype;
  binding_row public.qr_bindings%rowtype;
  vehicle_row public.vehicles%rowtype;
  relationship public.vehicle_owners%rowtype;
  owner_row public.owners%rowtype;
  existing_session public.contact_sessions%rowtype;
  created_session public.contact_sessions%rowtype;
  created_time timestamptz := clock_timestamp();
  request_id uuid := gen_random_uuid();
  duplicate_seconds integer := coalesce((p_input ->> 'duplicate_merge_seconds')::integer, 0);
  anon_window integer := coalesce((p_input ->> 'anonymous_global_window_seconds')::integer, 0);
  anon_limit integer := coalesce((p_input ->> 'anonymous_global_limit')::integer, 0);
  ip_window integer := coalesce((p_input ->> 'ip_qr_window_seconds')::integer, 0);
  ip_limit integer := coalesce((p_input ->> 'ip_qr_limit')::integer, 0);
  qr_window integer := coalesce((p_input ->> 'qr_global_window_seconds')::integer, 0);
  qr_limit integer := coalesce((p_input ->> 'qr_global_limit')::integer, 0);
  ttl_seconds integer := coalesce((p_input ->> 'session_ttl_seconds')::integer, 0);
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if duplicate_seconds <> 180
    or anon_window <> 600
    or anon_limit <> 5
    or ip_window <> 600
    or ip_limit <> 3
    or qr_window <> 60
    or qr_limit <> 5
    or ttl_seconds <> 3600
  then
    raise exception using errcode = '22023', message = 'CONTACT_POLICY_INVALID';
  end if;
  if (p_input ->> 'public_token_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'anonymous_token_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'session_token_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'network_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'user_agent_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'message_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'idempotency_key') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'plate_last4') !~ '^[0-9]{4}$'
    or (p_input ->> 'message_mode') not in ('TEMPLATE', 'FREE_TEXT')
    or length(trim(p_input ->> 'message')) not between 1 and 200
  then
    raise exception using errcode = '22023', message = 'CONTACT_INPUT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      concat_ws(
        ':',
        p_input ->> 'anonymous_token_hash',
        p_input ->> 'public_token_hash',
        p_input ->> 'reason_code'
      ),
      0
    )
  );

  select * into target
  from public.qr_assets
  where public_token_hash = p_input ->> 'public_token_hash'
  for update;
  if target.id is null or target.status <> 'ACTIVE' then
    raise exception using errcode = 'P0002', message = 'PUBLIC_CONTACT_UNAVAILABLE';
  end if;

  select * into binding_row
  from public.qr_bindings
  where id = target.current_binding_id
    and qr_asset_id = target.id
    and ended_at is null
    and is_primary
  for update;
  select * into vehicle_row
  from public.vehicles
  where id = binding_row.vehicle_id
    and tenant_id = target.tenant_id
    and site_id = target.site_id
    and status = 'ACTIVE'
  for update;
  select * into relationship
  from public.vehicle_owners
  where vehicle_id = vehicle_row.id
    and owner_id = binding_row.owner_id
    and ended_at is null
    and is_primary
  for update;
  select * into owner_row
  from public.owners
  where id = relationship.owner_id and status = 'ACTIVE'
  for update;

  if binding_row.id is null
    or vehicle_row.id is null
    or relationship.id is null
    or owner_row.id is null
    or vehicle_row.plate_last4 <> p_input ->> 'plate_last4'
    or not exists (
      select 1 from public.sites as site
      where site.tenant_id = target.tenant_id
        and site.id = target.site_id
        and site.status = 'ACTIVE'
    )
    or not exists (
      select 1 from public.contracts as contract
      where contract.tenant_id = target.tenant_id
        and contract.management_company_id = target.management_company_id
        and (contract.site_id is null or contract.site_id = target.site_id)
        and contract.status = 'ACTIVE'
        and contract.start_date <= current_date
        and (contract.end_date is null or contract.end_date >= current_date)
    )
  then
    raise exception using errcode = 'P0002', message = 'PUBLIC_CONTACT_UNAVAILABLE';
  end if;

  select * into existing_session
  from public.contact_sessions
  where qr_asset_id = target.id
    and caller_anonymous_hash = p_input ->> 'anonymous_token_hash'
    and reason_code = p_input ->> 'reason_code'
    and created_at > created_time - make_interval(secs => duplicate_seconds)
    and expires_at > created_time
    and status not in ('RESOLVED', 'EXPIRED', 'BLOCKED', 'CANCELLED')
  order by created_at desc
  limit 1
  for update;

  if existing_session.id is not null then
    if existing_session.session_token_hash <> p_input ->> 'session_token_hash' then
      raise exception using errcode = 'P0001', message = 'CONTACT_DUPLICATE_SESSION_CONFLICT';
    end if;
    insert into public.public_contact_attempts (
      tenant_id, site_id, qr_asset_id, session_id, anonymous_hash,
      network_hash, user_agent_hash, message_hash, result
    )
    values (
      target.tenant_id, target.site_id, target.id, existing_session.id,
      p_input ->> 'anonymous_token_hash', p_input ->> 'network_hash',
      p_input ->> 'user_agent_hash', p_input ->> 'message_hash', 'MERGED'
    );
    return jsonb_build_object(
      'merged', true,
      'status', existing_session.status,
      'reason_code', existing_session.reason_code,
      'caller_message_count', existing_session.caller_message_count,
      'owner_messages', '[]'::jsonb,
      'expires_at', existing_session.expires_at,
      'version', existing_session.version
    );
  end if;

  if (
    select count(*) from public.public_contact_attempts
    where anonymous_hash = p_input ->> 'anonymous_token_hash'
      and result = 'CREATED'
      and created_at > created_time - make_interval(secs => anon_window)
  ) >= anon_limit
    or (
      select count(*) from public.public_contact_attempts
      where network_hash = p_input ->> 'network_hash'
        and qr_asset_id = target.id
        and result = 'CREATED'
        and created_at > created_time - make_interval(secs => ip_window)
    ) >= ip_limit
    or (
      select count(*) from public.public_contact_attempts
      where qr_asset_id = target.id
        and result = 'CREATED'
        and created_at > created_time - make_interval(secs => qr_window)
    ) >= qr_limit
  then
    insert into public.public_contact_attempts (
      tenant_id, site_id, qr_asset_id, anonymous_hash,
      network_hash, user_agent_hash, message_hash, result
    )
    values (
      target.tenant_id, target.site_id, target.id,
      p_input ->> 'anonymous_token_hash', p_input ->> 'network_hash',
      p_input ->> 'user_agent_hash', p_input ->> 'message_hash', 'BLOCKED'
    );
    raise exception using errcode = 'P0001', message = 'CONTACT_RATE_LIMITED';
  end if;

  insert into public.contact_sessions (
    tenant_id, site_id, qr_asset_id, vehicle_id, session_token_hash,
    caller_anonymous_hash, reason_code, status, caller_message_count, expires_at
  )
  values (
    target.tenant_id, target.site_id, target.id, vehicle_row.id,
    p_input ->> 'session_token_hash', p_input ->> 'anonymous_token_hash',
    p_input ->> 'reason_code', 'NOTIFICATION_QUEUED', 1,
    created_time + make_interval(secs => ttl_seconds)
  )
  returning * into created_session;

  insert into public.session_participants (
    tenant_id, session_id, participant_type, anonymous_token_hash
  )
  values (
    target.tenant_id, created_session.id, 'CALLER', p_input ->> 'anonymous_token_hash'
  );
  insert into public.session_participants (
    tenant_id, session_id, participant_type, owner_id
  )
  values (target.tenant_id, created_session.id, 'OWNER', owner_row.id);

  insert into public.messages (
    tenant_id, session_id, sender_type, message_type, reason_code, body, body_hash
  )
  values (
    target.tenant_id, created_session.id, 'CALLER',
    (p_input ->> 'message_mode')::public.contact_message_type,
    p_input ->> 'reason_code', p_input ->> 'message', p_input ->> 'message_hash'
  );

  insert into public.notification_deliveries (
    tenant_id, site_id, session_id, owner_id, channel, purpose,
    destination_hash, idempotency_key, status
  )
  values (
    target.tenant_id, target.site_id, created_session.id, owner_row.id,
    'SMS', 'OWNER_CONTACT', owner_row.phone_hash,
    p_input ->> 'idempotency_key', 'QUEUED'
  );

  insert into public.public_contact_attempts (
    tenant_id, site_id, qr_asset_id, session_id, anonymous_hash,
    network_hash, user_agent_hash, message_hash, result
  )
  values (
    target.tenant_id, target.site_id, target.id, created_session.id,
    p_input ->> 'anonymous_token_hash', p_input ->> 'network_hash',
    p_input ->> 'user_agent_hash', p_input ->> 'message_hash', 'CREATED'
  );

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    target.tenant_id, target.site_id, 'CALLER', 'PUBLIC_CONTACT_CREATED',
    'CONTACT_SESSION', created_session.id,
    jsonb_build_object(
      'status', 'NOTIFICATION_QUEUED',
      'reasonCode', created_session.reason_code,
      'qrAssetId', target.id
    ),
    'PUBLIC_CONTACT_CREATED', request_id
  );

  return jsonb_build_object(
    'merged', false,
    'status', created_session.status,
    'reason_code', created_session.reason_code,
    'caller_message_count', created_session.caller_message_count,
    'owner_messages', '[]'::jsonb,
    'expires_at', created_session.expires_at,
    'version', created_session.version
  );
end;
$$;

create or replace function public.read_public_contact_session(
  p_session_token_hash text,
  p_anonymous_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.contact_sessions%rowtype;
  owner_messages jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_session_token_hash !~ '^[0-9a-f]{64}$'
    or p_anonymous_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_SESSION_HASH';
  end if;

  select session.* into target
  from public.contact_sessions as session
  join public.session_participants as participant
    on participant.tenant_id = session.tenant_id
    and participant.session_id = session.id
    and participant.participant_type = 'CALLER'
    and participant.left_at is null
  where session.session_token_hash = p_session_token_hash
    and session.caller_anonymous_hash = p_anonymous_token_hash
    and participant.anonymous_token_hash = p_anonymous_token_hash;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'CONTACT_SESSION_UNAVAILABLE';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'reply_code', message.reply_code,
        'body', message.body,
        'created_at', message.created_at
      )
      order by message.created_at
    ),
    '[]'::jsonb
  )
  into owner_messages
  from public.messages as message
  where message.session_id = target.id
    and message.sender_type = 'OWNER'
    and message.moderation_status = 'ACCEPTED';

  return jsonb_build_object(
    'status', target.status,
    'reason_code', target.reason_code,
    'caller_message_count', target.caller_message_count,
    'owner_messages', owner_messages,
    'expires_at', target.expires_at,
    'version', target.version
  );
end;
$$;

revoke all on function public.inspect_public_contact(text) from public, anon, authenticated;
revoke all on function public.create_public_contact_session(jsonb)
from public, anon, authenticated;
revoke all on function public.read_public_contact_session(text, text)
from public, anon, authenticated;
revoke all on function app_private.guard_public_contact_append_only()
from public, anon, authenticated;

grant execute on function public.inspect_public_contact(text) to service_role;
grant execute on function public.create_public_contact_session(jsonb) to service_role;
grant execute on function public.read_public_contact_session(text, text) to service_role;

comment on table public.contact_sessions is
  'Hash-only caller Contact Session scope. Direct browser access is denied.';
comment on table public.messages is
  'Immutable bounded session message content. Message bodies are prohibited from logs and audit.';
comment on table public.public_contact_attempts is
  'Hash-only append ledger for public rate enforcement and duplicate merge.';
comment on table public.notification_deliveries is
  'Phase 6 creates QUEUED intents only. Provider delivery is owned by Phase 7.';

commit;
