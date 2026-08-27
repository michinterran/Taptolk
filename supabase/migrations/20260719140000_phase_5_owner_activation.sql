begin;

create type public.owner_status as enum ('ACTIVE', 'SUSPENDED', 'DELETED');
create type public.owner_device_status as enum ('ACTIVE', 'REVOKED');
create type public.owner_otp_status as enum ('PENDING', 'VERIFIED', 'LOCKED', 'EXPIRED');
create type public.owner_otp_delivery_status as enum ('PENDING', 'SENT', 'FAILED');
create type public.owner_proof_status as enum ('ISSUED', 'CONSUMED', 'EXPIRED');
create type public.owner_session_status as enum ('ACTIVE', 'REVOKED', 'EXPIRED');

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete restrict,
  phone_hash text not null unique,
  phone_ciphertext text not null,
  phone_key_version integer not null,
  phone_last4 text not null,
  status public.owner_status not null default 'ACTIVE',
  verified_at timestamptz not null,
  terms_version text not null,
  privacy_version text not null,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint chk_owners_phone_hash check (phone_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_owners_phone_ciphertext check (length(phone_ciphertext) between 20 and 1000),
  constraint chk_owners_phone_key_version check (phone_key_version >= 1),
  constraint chk_owners_phone_last4 check (phone_last4 ~ '^[0-9]{4}$'),
  constraint chk_owners_consent_versions check (
    terms_version ~ '^[A-Z0-9][A-Z0-9._-]{0,31}$'
    and privacy_version ~ '^[A-Z0-9][A-Z0-9._-]{0,31}$'
  )
);

create table public.owner_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete restrict,
  device_hash text not null,
  status public.owner_device_status not null default 'ACTIVE',
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint uq_owner_devices_owner_hash unique (owner_id, device_hash),
  constraint chk_owner_devices_hash check (device_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_owner_devices_state check (
    (status = 'ACTIVE' and revoked_at is null)
    or (status = 'REVOKED' and revoked_at is not null)
  )
);

create table public.vehicle_owners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  vehicle_id uuid not null,
  owner_id uuid not null references public.owners (id) on delete restrict,
  is_primary boolean not null default true,
  activation_source text not null default 'QR_ACTIVATION',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text,
  created_at timestamptz not null default now(),
  constraint fk_vehicle_owners_vehicle
    foreign key (tenant_id, site_id, vehicle_id)
    references public.vehicles (tenant_id, site_id, id)
    on delete restrict,
  constraint uq_vehicle_owners_tenant_id unique (tenant_id, id),
  constraint chk_vehicle_owners_activation_source
    check (activation_source in ('QR_ACTIVATION', 'ADMIN_LINK', 'TRANSFER')),
  constraint chk_vehicle_owners_ended check (
    (ended_at is null and ended_reason is null)
    or (
      ended_at is not null
      and ended_at >= started_at
      and length(trim(ended_reason)) between 3 and 500
    )
  )
);

create unique index uq_vehicle_owners_primary_active
on public.vehicle_owners (vehicle_id)
where ended_at is null and is_primary = true;

create index idx_vehicle_owners_owner_active
on public.vehicle_owners (owner_id, started_at desc)
where ended_at is null;

create table public.owner_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_asset_id uuid not null,
  public_token_hash text not null,
  phone_hash text not null,
  phone_ciphertext text not null,
  phone_key_version integer not null,
  phone_last4 text not null,
  network_hash text not null,
  device_hash text not null,
  otp_hash text not null,
  status public.owner_otp_status not null default 'PENDING',
  delivery_status public.owner_otp_delivery_status not null default 'PENDING',
  attempt_count integer not null default 0,
  send_count integer not null default 1,
  expires_at timestamptz not null,
  resend_after timestamptz not null,
  verified_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_owner_otp_challenges_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint chk_owner_otp_challenges_hashes check (
    public_token_hash ~ '^[0-9a-f]{64}$'
    and phone_hash ~ '^[0-9a-f]{64}$'
    and network_hash ~ '^[0-9a-f]{64}$'
    and device_hash ~ '^[0-9a-f]{64}$'
    and otp_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_owner_otp_challenges_phone check (
    length(phone_ciphertext) between 20 and 1000
    and phone_key_version >= 1
    and phone_last4 ~ '^[0-9]{4}$'
  ),
  constraint chk_owner_otp_challenges_counts check (
    attempt_count between 0 and 5 and send_count >= 1
  ),
  constraint chk_owner_otp_challenges_window check (
    expires_at > created_at and resend_after > created_at and resend_after < expires_at
  ),
  constraint chk_owner_otp_challenges_state check (
    (status = 'PENDING' and verified_at is null and locked_at is null)
    or (status = 'VERIFIED' and verified_at is not null and locked_at is null)
    or (status = 'LOCKED' and verified_at is null and locked_at is not null)
    or (status = 'EXPIRED' and verified_at is null)
  )
);

create index idx_owner_otp_phone_created
on public.owner_otp_challenges (phone_hash, created_at desc);
create index idx_owner_otp_network_created
on public.owner_otp_challenges (network_hash, created_at desc);
create index idx_owner_otp_device_created
on public.owner_otp_challenges (device_hash, created_at desc);
create index idx_owner_otp_qr_created
on public.owner_otp_challenges (qr_asset_id, created_at desc);

create table public.owner_phone_verification_proofs (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null unique references public.owner_otp_challenges (id) on delete restrict,
  tenant_id uuid not null,
  site_id uuid not null,
  qr_asset_id uuid not null,
  phone_hash text not null,
  proof_hash text not null unique,
  status public.owner_proof_status not null default 'ISSUED',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fk_owner_phone_proofs_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint chk_owner_phone_proofs_hashes check (
    phone_hash ~ '^[0-9a-f]{64}$' and proof_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_owner_phone_proofs_state check (
    (status = 'ISSUED' and consumed_at is null)
    or (status = 'CONSUMED' and consumed_at is not null)
    or (status = 'EXPIRED' and consumed_at is null)
  )
);

create table public.owner_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete restrict,
  owner_device_id uuid not null references public.owner_devices (id) on delete restrict,
  session_hash text not null unique,
  status public.owner_session_status not null default 'ACTIVE',
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chk_owner_sessions_hash check (session_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_owner_sessions_expiry check (expires_at > created_at),
  constraint chk_owner_sessions_state check (
    (status = 'ACTIVE' and revoked_at is null)
    or (status = 'REVOKED' and revoked_at is not null)
    or (status = 'EXPIRED' and revoked_at is null)
  )
);

create index idx_owner_sessions_owner_status
on public.owner_sessions (owner_id, status, expires_at);

alter table public.qr_bindings
  alter column created_by drop not null,
  add column created_by_owner_id uuid references public.owners (id) on delete restrict,
  add constraint fk_qr_bindings_owner
    foreign key (owner_id) references public.owners (id) on delete restrict,
  add constraint chk_qr_bindings_creation_actor
    check ((created_by is null) <> (created_by_owner_id is null));

alter table public.qr_activation_codes
  add constraint fk_qr_activation_codes_used_owner
    foreign key (used_by_owner_id) references public.owners (id) on delete restrict;

create trigger trg_owners_touch
before update on public.owners
for each row execute function app_private.touch_versioned_row();

create or replace function app_private.touch_owner_otp_challenge()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_owner_otp_challenges_touch
before update on public.owner_otp_challenges
for each row execute function app_private.touch_owner_otp_challenge();

alter table public.owners enable row level security;
alter table public.owners force row level security;
alter table public.owner_devices enable row level security;
alter table public.owner_devices force row level security;
alter table public.vehicle_owners enable row level security;
alter table public.vehicle_owners force row level security;
alter table public.owner_otp_challenges enable row level security;
alter table public.owner_otp_challenges force row level security;
alter table public.owner_phone_verification_proofs enable row level security;
alter table public.owner_phone_verification_proofs force row level security;
alter table public.owner_sessions enable row level security;
alter table public.owner_sessions force row level security;

revoke all on table public.owners from public, anon, authenticated;
revoke all on table public.owner_devices from public, anon, authenticated;
revoke all on table public.vehicle_owners from public, anon, authenticated;
revoke all on table public.owner_otp_challenges from public, anon, authenticated;
revoke all on table public.owner_phone_verification_proofs from public, anon, authenticated;
revoke all on table public.owner_sessions from public, anon, authenticated;

grant all on table public.owners to service_role;
grant all on table public.owner_devices to service_role;
grant all on table public.vehicle_owners to service_role;
grant all on table public.owner_otp_challenges to service_role;
grant all on table public.owner_phone_verification_proofs to service_role;
grant all on table public.owner_sessions to service_role;

create or replace function public.inspect_owner_activation(p_public_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.qr_assets%rowtype;
  site_name text;
  plate_last4 text;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_public_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_TOKEN_HASH';
  end if;

  select asset.*
  into target
  from public.qr_assets as asset
  where asset.public_token_hash = p_public_token_hash;

  if target.id is null or target.status not in ('IN_STOCK', 'ASSIGNED', 'ACTIVATION_PENDING') then
    raise exception using errcode = 'P0002', message = 'ACTIVATION_UNAVAILABLE';
  end if;

  select site.name
  into site_name
  from public.sites as site
  where site.tenant_id = target.tenant_id and site.id = target.site_id;

  select vehicle.plate_last4
  into plate_last4
  from public.qr_bindings as binding
  join public.vehicles as vehicle
    on vehicle.tenant_id = binding.tenant_id
    and vehicle.site_id = binding.site_id
    and vehicle.id = binding.vehicle_id
  where binding.qr_asset_id = target.id and binding.ended_at is null;

  return jsonb_build_object(
    'activatable', true,
    'assignment_mode', case when plate_last4 is null then 'SELF_REGISTRATION' else 'PREASSIGNED' end,
    'plate_last4', plate_last4,
    'qr_status', target.status,
    'site_display_name', site_name
  );
end;
$$;

create or replace function public.request_owner_activation_otp(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.qr_assets%rowtype;
  challenge_id uuid;
  created_time timestamptz := clock_timestamp();
  ttl_seconds integer := coalesce((p_input ->> 'ttl_seconds')::integer, 0);
  resend_seconds integer := coalesce((p_input ->> 'resend_seconds')::integer, 0);
  hourly_limit integer := coalesce((p_input ->> 'hourly_phone_limit')::integer, 0);
  daily_limit integer := coalesce((p_input ->> 'daily_phone_limit')::integer, 0);
  network_limit integer := coalesce((p_input ->> 'network_window_limit')::integer, 0);
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if ttl_seconds <> 180
    or resend_seconds <> 60
    or hourly_limit <> 5
    or daily_limit <> 10
    or network_limit <> 10
    or coalesce((p_input ->> 'attempt_limit')::integer, 0) <> 5
  then
    raise exception using errcode = '22023', message = 'OTP_POLICY_INVALID';
  end if;
  if (p_input ->> 'public_token_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'phone_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'network_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'device_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'otp_hash') !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = '22023', message = 'OTP_INPUT_INVALID';
  end if;

  select *
  into target
  from public.qr_assets
  where public_token_hash = p_input ->> 'public_token_hash'
  for update;

  if target.id is null or target.status not in ('IN_STOCK', 'ASSIGNED', 'ACTIVATION_PENDING') then
    raise exception using errcode = 'P0002', message = 'ACTIVATION_UNAVAILABLE';
  end if;
  if not exists (
    select 1 from public.qr_activation_codes as code
    where code.qr_asset_id = target.id
      and code.status = 'ISSUED'
      and (code.expires_at is null or code.expires_at > created_time)
  ) then
    raise exception using errcode = 'P0002', message = 'ACTIVATION_UNAVAILABLE';
  end if;
  if exists (
    select 1 from public.owner_otp_challenges as challenge
    where challenge.qr_asset_id = target.id
      and challenge.phone_hash = p_input ->> 'phone_hash'
      and challenge.resend_after > created_time
      and challenge.delivery_status <> 'FAILED'
  ) then
    raise exception using errcode = 'P0001', message = 'OTP_RESEND_COOLDOWN';
  end if;
  if (
    select count(*) from public.owner_otp_challenges
    where phone_hash = p_input ->> 'phone_hash'
      and created_at > created_time - interval '1 hour'
      and delivery_status <> 'FAILED'
  ) >= hourly_limit then
    raise exception using errcode = 'P0001', message = 'OTP_PHONE_HOURLY_LIMIT';
  end if;
  if (
    select count(*) from public.owner_otp_challenges
    where phone_hash = p_input ->> 'phone_hash'
      and created_at > created_time - interval '1 day'
      and delivery_status <> 'FAILED'
  ) >= daily_limit then
    raise exception using errcode = 'P0001', message = 'OTP_PHONE_DAILY_LIMIT';
  end if;
  if (
    select count(*) from public.owner_otp_challenges
    where network_hash = p_input ->> 'network_hash'
      and created_at > created_time - interval '10 minutes'
      and delivery_status <> 'FAILED'
  ) >= network_limit or (
    select count(*) from public.owner_otp_challenges
    where device_hash = p_input ->> 'device_hash'
      and created_at > created_time - interval '10 minutes'
      and delivery_status <> 'FAILED'
  ) >= network_limit then
    raise exception using errcode = 'P0001', message = 'OTP_NETWORK_LIMIT';
  end if;

  insert into public.owner_otp_challenges (
    tenant_id, site_id, qr_asset_id, public_token_hash,
    phone_hash, phone_ciphertext, phone_key_version, phone_last4,
    network_hash, device_hash, otp_hash, expires_at, resend_after
  )
  values (
    target.tenant_id, target.site_id, target.id, p_input ->> 'public_token_hash',
    p_input ->> 'phone_hash', p_input ->> 'phone_ciphertext',
    (p_input ->> 'phone_key_version')::integer, p_input ->> 'phone_last4',
    p_input ->> 'network_hash', p_input ->> 'device_hash', p_input ->> 'otp_hash',
    created_time + make_interval(secs => ttl_seconds),
    created_time + make_interval(secs => resend_seconds)
  )
  returning id into challenge_id;

  return jsonb_build_object(
    'challenge_id', challenge_id,
    'expires_at', created_time + make_interval(secs => ttl_seconds),
    'resend_after', created_time + make_interval(secs => resend_seconds)
  );
end;
$$;

create or replace function public.mark_owner_otp_delivery(
  p_challenge_id uuid,
  p_status public.owner_otp_delivery_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_status not in ('SENT', 'FAILED') then
    raise exception using errcode = '22023', message = 'DELIVERY_STATUS_INVALID';
  end if;
  update public.owner_otp_challenges
  set delivery_status = p_status
  where id = p_challenge_id and delivery_status = 'PENDING';
  if not found then
    raise exception using errcode = 'P0002', message = 'CHALLENGE_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.verify_owner_activation_otp(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge public.owner_otp_challenges%rowtype;
  proof_expiry timestamptz;
  next_attempt integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if (p_input ->> 'otp_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'proof_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'public_token_hash') !~ '^[0-9a-f]{64}$'
    or coalesce((p_input ->> 'proof_ttl_seconds')::integer, 0) <> 300
  then
    raise exception using errcode = '22023', message = 'OTP_VERIFY_INPUT_INVALID';
  end if;

  select *
  into challenge
  from public.owner_otp_challenges
  where id = (p_input ->> 'challenge_id')::uuid
  for update;

  if challenge.id is null
    or challenge.public_token_hash <> p_input ->> 'public_token_hash'
    or challenge.delivery_status <> 'SENT'
    or challenge.status <> 'PENDING'
  then
    raise exception using errcode = 'P0002', message = 'OTP_CHALLENGE_UNAVAILABLE';
  end if;
  if challenge.expires_at <= clock_timestamp() then
    update public.owner_otp_challenges set status = 'EXPIRED' where id = challenge.id;
    return jsonb_build_object('verified', false, 'status', 'EXPIRED');
  end if;

  next_attempt := challenge.attempt_count + 1;
  if challenge.otp_hash <> p_input ->> 'otp_hash' then
    update public.owner_otp_challenges
    set
      attempt_count = next_attempt,
      status = case when next_attempt >= 5 then 'LOCKED' else 'PENDING' end,
      locked_at = case when next_attempt >= 5 then clock_timestamp() else null end
    where id = challenge.id;
    return jsonb_build_object(
      'verified', false,
      'status', case when next_attempt >= 5 then 'LOCKED' else 'MISMATCH' end,
      'attempt_count', next_attempt
    );
  end if;

  proof_expiry := clock_timestamp() + interval '300 seconds';
  update public.owner_otp_challenges
  set status = 'VERIFIED', attempt_count = next_attempt, verified_at = clock_timestamp()
  where id = challenge.id;

  insert into public.owner_phone_verification_proofs (
    challenge_id, tenant_id, site_id, qr_asset_id, phone_hash, proof_hash, expires_at
  )
  values (
    challenge.id, challenge.tenant_id, challenge.site_id, challenge.qr_asset_id,
    challenge.phone_hash, p_input ->> 'proof_hash', proof_expiry
  );

  return jsonb_build_object('verified', true, 'expires_at', proof_expiry);
end;
$$;

create or replace function public.complete_owner_activation(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.qr_assets%rowtype;
  activation_code public.qr_activation_codes%rowtype;
  proof public.owner_phone_verification_proofs%rowtype;
  challenge public.owner_otp_challenges%rowtype;
  owner_row public.owners%rowtype;
  vehicle_row public.vehicles%rowtype;
  binding_row public.qr_bindings%rowtype;
  device_id uuid;
  session_expiry timestamptz;
  request_id uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if (p_input ->> 'public_token_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'activation_code_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'proof_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'session_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'device_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'plate_lookup_hash') !~ '^[0-9a-f]{64}$'
    or coalesce((p_input ->> 'session_ttl_seconds')::integer, 0) <> 43200
    or (p_input ->> 'terms_version') !~ '^[A-Z0-9][A-Z0-9._-]{0,31}$'
    or (p_input ->> 'privacy_version') !~ '^[A-Z0-9][A-Z0-9._-]{0,31}$'
  then
    raise exception using errcode = '22023', message = 'ACTIVATION_INPUT_INVALID';
  end if;

  select * into target
  from public.qr_assets
  where public_token_hash = p_input ->> 'public_token_hash'
  for update;
  if target.id is null or target.status not in ('IN_STOCK', 'ASSIGNED', 'ACTIVATION_PENDING') then
    raise exception using errcode = 'P0002', message = 'ACTIVATION_UNAVAILABLE';
  end if;

  select * into activation_code
  from public.qr_activation_codes
  where qr_asset_id = target.id
  for update;
  if activation_code.id is null
    or activation_code.code_hash <> p_input ->> 'activation_code_hash'
    or activation_code.status <> 'ISSUED'
    or (activation_code.expires_at is not null and activation_code.expires_at <= clock_timestamp())
  then
    raise exception using errcode = 'P0002', message = 'ACTIVATION_UNAVAILABLE';
  end if;

  select * into proof
  from public.owner_phone_verification_proofs
  where proof_hash = p_input ->> 'proof_hash'
  for update;
  if proof.id is null
    or proof.qr_asset_id <> target.id
    or proof.status <> 'ISSUED'
    or proof.expires_at <= clock_timestamp()
  then
    raise exception using errcode = 'P0002', message = 'PHONE_PROOF_UNAVAILABLE';
  end if;
  select * into challenge
  from public.owner_otp_challenges
  where id = proof.challenge_id;

  select * into binding_row
  from public.qr_bindings
  where qr_asset_id = target.id and ended_at is null
  for update;

  if binding_row.id is not null then
    select * into vehicle_row
    from public.vehicles
    where id = binding_row.vehicle_id
    for update;
    if vehicle_row.plate_lookup_hash <> p_input ->> 'plate_lookup_hash' then
      raise exception using errcode = 'P0002', message = 'ACTIVATION_UNAVAILABLE';
    end if;
  else
    select * into vehicle_row
    from public.vehicles
    where site_id = target.site_id
      and plate_lookup_hash = p_input ->> 'plate_lookup_hash'
    for update;
    if vehicle_row.id is null then
      insert into public.vehicles (
        tenant_id, site_id, plate_lookup_hash, plate_ciphertext,
        plate_key_version, plate_last4, status
      )
      values (
        target.tenant_id, target.site_id, p_input ->> 'plate_lookup_hash',
        p_input ->> 'plate_ciphertext', (p_input ->> 'plate_key_version')::integer,
        p_input ->> 'plate_last4', 'ACTIVE'
      )
      returning * into vehicle_row;
    elsif exists (
      select 1 from public.qr_bindings
      where vehicle_id = vehicle_row.id and ended_at is null and is_primary
    ) then
      raise exception using errcode = '23505', message = 'VEHICLE_ALREADY_BOUND';
    end if;
  end if;

  select * into owner_row
  from public.owners
  where phone_hash = proof.phone_hash
  for update;
  if owner_row.id is null then
    insert into public.owners (
      phone_hash, phone_ciphertext, phone_key_version, phone_last4,
      verified_at, terms_version, privacy_version, consented_at
    )
    values (
      challenge.phone_hash, challenge.phone_ciphertext, challenge.phone_key_version,
      challenge.phone_last4, challenge.verified_at, p_input ->> 'terms_version',
      p_input ->> 'privacy_version', clock_timestamp()
    )
    returning * into owner_row;
  else
    update public.owners
    set
      phone_ciphertext = challenge.phone_ciphertext,
      phone_key_version = challenge.phone_key_version,
      phone_last4 = challenge.phone_last4,
      verified_at = challenge.verified_at,
      terms_version = p_input ->> 'terms_version',
      privacy_version = p_input ->> 'privacy_version',
      consented_at = clock_timestamp(),
      status = 'ACTIVE'
    where id = owner_row.id
    returning * into owner_row;
  end if;

  if binding_row.id is null then
    insert into public.qr_bindings (
      tenant_id, site_id, qr_asset_id, vehicle_id, owner_id, assignment_method,
      created_by_owner_id
    )
    values (
      target.tenant_id, target.site_id, target.id, vehicle_row.id, owner_row.id,
      'OWNER_ACTIVATION', owner_row.id
    )
    returning * into binding_row;
  else
    if binding_row.owner_id is not null and binding_row.owner_id <> owner_row.id then
      raise exception using errcode = '23505', message = 'BINDING_OWNER_CONFLICT';
    end if;
    update public.qr_bindings set owner_id = owner_row.id
    where id = binding_row.id
    returning * into binding_row;
  end if;

  insert into public.vehicle_owners (
    tenant_id, site_id, vehicle_id, owner_id, is_primary, activation_source
  )
  values (
    target.tenant_id, target.site_id, vehicle_row.id, owner_row.id, true, 'QR_ACTIVATION'
  );

  insert into public.qr_asset_status_logs (
    tenant_id, management_company_id, site_id, batch_id, qr_asset_id,
    from_status, to_status, reason_code, actor_type, actor_id
  )
  values (
    target.tenant_id, target.management_company_id, target.site_id, target.batch_id,
    target.id, target.status, 'ACTIVATION_PENDING', 'OWNER_ACTIVATION_STARTED',
    'OWNER', owner_row.id
  );
  insert into public.qr_asset_status_logs (
    tenant_id, management_company_id, site_id, batch_id, qr_asset_id,
    from_status, to_status, reason_code, actor_type, actor_id
  )
  values (
    target.tenant_id, target.management_company_id, target.site_id, target.batch_id,
    target.id, 'ACTIVATION_PENDING', 'ACTIVE', 'OWNER_ACTIVATION_COMPLETED',
    'OWNER', owner_row.id
  );

  update public.qr_assets
  set
    status = 'ACTIVE',
    current_vehicle_id = vehicle_row.id,
    current_binding_id = binding_row.id,
    activated_at = clock_timestamp()
  where id = target.id;
  update public.vehicles set status = 'ACTIVE' where id = vehicle_row.id;
  update public.qr_activation_codes
  set status = 'USED', used_at = clock_timestamp(), used_by_owner_id = owner_row.id
  where id = activation_code.id;
  update public.owner_phone_verification_proofs
  set status = 'CONSUMED', consumed_at = clock_timestamp()
  where id = proof.id;

  insert into public.owner_devices (owner_id, device_hash)
  values (owner_row.id, p_input ->> 'device_hash')
  on conflict (owner_id, device_hash)
  do update set status = 'ACTIVE', revoked_at = null, last_seen_at = clock_timestamp()
  returning id into device_id;

  session_expiry := clock_timestamp() + interval '43200 seconds';
  insert into public.owner_sessions (
    owner_id, owner_device_id, session_hash, expires_at
  )
  values (owner_row.id, device_id, p_input ->> 'session_hash', session_expiry);

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    target.tenant_id, target.site_id, 'OWNER', owner_row.id, 'OWNER_QR_ACTIVATED',
    'QR_ASSET', target.id,
    jsonb_build_object(
      'status', 'ACTIVE',
      'bindingId', binding_row.id,
      'vehicleId', vehicle_row.id,
      'ownerId', owner_row.id
    ),
    'OWNER_ACTIVATION', request_id
  );

  return jsonb_build_object(
    'owner_id', owner_row.id,
    'vehicle_id', vehicle_row.id,
    'vehicle_plate_last4', vehicle_row.plate_last4,
    'qr_status', 'ACTIVE',
    'session_expires_at', session_expiry
  );
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
  select * into device from public.owner_devices where id = owner_session.owner_device_id;
  if device.device_hash <> p_device_hash or device.status <> 'ACTIVE' then
    raise exception using errcode = 'P0002', message = 'OWNER_SESSION_UNAVAILABLE';
  end if;
  update public.owner_sessions set last_seen_at = clock_timestamp()
  where id = owner_session.id;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'vehicle_id', vehicle.id,
      'plate_last4', vehicle.plate_last4,
      'site_id', relationship.site_id,
      'qr_status', asset.status
    ) order by relationship.started_at desc), '[]'::jsonb)
    from public.vehicle_owners as relationship
    join public.vehicles as vehicle on vehicle.id = relationship.vehicle_id
    left join public.qr_bindings as binding
      on binding.vehicle_id = vehicle.id and binding.ended_at is null and binding.is_primary
    left join public.qr_assets as asset on asset.id = binding.qr_asset_id
    where relationship.owner_id = owner_session.owner_id and relationship.ended_at is null
  );
end;
$$;

revoke all on function public.inspect_owner_activation(text) from public, anon, authenticated;
revoke all on function public.request_owner_activation_otp(jsonb) from public, anon, authenticated;
revoke all on function public.mark_owner_otp_delivery(uuid, public.owner_otp_delivery_status)
from public, anon, authenticated;
revoke all on function public.verify_owner_activation_otp(jsonb) from public, anon, authenticated;
revoke all on function public.complete_owner_activation(jsonb) from public, anon, authenticated;
revoke all on function public.list_owner_vehicles(text, text) from public, anon, authenticated;
revoke all on function app_private.touch_owner_otp_challenge()
from public, anon, authenticated;

grant execute on function public.inspect_owner_activation(text) to service_role;
grant execute on function public.request_owner_activation_otp(jsonb) to service_role;
grant execute on function public.mark_owner_otp_delivery(uuid, public.owner_otp_delivery_status)
to service_role;
grant execute on function public.verify_owner_activation_otp(jsonb) to service_role;
grant execute on function public.complete_owner_activation(jsonb) to service_role;
grant execute on function public.list_owner_vehicles(text, text) to service_role;

comment on table public.owner_otp_challenges is
'Service-only hash/encrypted OTP lifecycle. Raw phone and OTP values are forbidden.';
comment on table public.owner_phone_verification_proofs is
'Service-only one-use phone verification proofs stored as hashes.';
comment on table public.owner_sessions is
'Service-only Owner sessions. Only a session hash is persisted.';

commit;
