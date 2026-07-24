begin;

create or replace function public.request_owner_session_reclaim_otp(p_input jsonb)
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
    or (p_input ->> 'plate_lookup_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'network_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'device_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'otp_hash') !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = '22023', message = 'OTP_INPUT_INVALID';
  end if;

  select asset.*
  into target
  from public.qr_assets as asset
  join public.qr_bindings as binding
    on binding.qr_asset_id = asset.id
    and binding.ended_at is null
    and binding.owner_id is not null
  join public.vehicles as vehicle
    on vehicle.tenant_id = binding.tenant_id
    and vehicle.site_id = binding.site_id
    and vehicle.id = binding.vehicle_id
    and vehicle.plate_lookup_hash = p_input ->> 'plate_lookup_hash'
  join public.owners as owner_row
    on owner_row.id = binding.owner_id
    and owner_row.phone_hash = p_input ->> 'phone_hash'
    and owner_row.status = 'ACTIVE'
  where asset.public_token_hash = p_input ->> 'public_token_hash'
    and asset.status = 'ACTIVE'
  for update of asset;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'RECLAIM_UNAVAILABLE';
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

create or replace function public.verify_owner_session_reclaim_otp(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge public.owner_otp_challenges%rowtype;
  target public.qr_assets%rowtype;
  owner_row public.owners%rowtype;
  device_id uuid;
  owner_session_id uuid;
  session_expiry timestamptz;
  next_attempt integer;
  request_id uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if (p_input ->> 'otp_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'public_token_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'device_hash') !~ '^[0-9a-f]{64}$'
    or (p_input ->> 'session_hash') !~ '^[0-9a-f]{64}$'
    or coalesce((p_input ->> 'session_ttl_seconds')::integer, 0) <> 43200
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
    or challenge.device_hash <> p_input ->> 'device_hash'
    or challenge.delivery_status <> 'SENT'
    or challenge.status <> 'PENDING'
  then
    raise exception using errcode = 'P0002', message = 'OTP_CHALLENGE_UNAVAILABLE';
  end if;
  if challenge.expires_at <= clock_timestamp() then
    update public.owner_otp_challenges set status = 'EXPIRED' where id = challenge.id;
    return jsonb_build_object('reclaimed', false, 'status', 'EXPIRED');
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
      'reclaimed', false,
      'status', case when next_attempt >= 5 then 'LOCKED' else 'MISMATCH' end,
      'attempt_count', next_attempt
    );
  end if;

  select asset.*
  into target
  from public.qr_assets as asset
  join public.qr_bindings as binding
    on binding.qr_asset_id = asset.id
    and binding.ended_at is null
    and binding.owner_id is not null
  join public.owners as owner_match
    on owner_match.id = binding.owner_id
    and owner_match.phone_hash = challenge.phone_hash
    and owner_match.status = 'ACTIVE'
  where asset.id = challenge.qr_asset_id
    and asset.public_token_hash = p_input ->> 'public_token_hash'
    and asset.status = 'ACTIVE'
  for update of asset;

  select owner_match.*
  into owner_row
  from public.qr_bindings as binding
  join public.owners as owner_match
    on owner_match.id = binding.owner_id
    and owner_match.phone_hash = challenge.phone_hash
    and owner_match.status = 'ACTIVE'
  where binding.qr_asset_id = target.id
    and binding.ended_at is null
    and binding.owner_id is not null
  for update of owner_match;

  if target.id is null or owner_row.id is null then
    raise exception using errcode = 'P0002', message = 'RECLAIM_UNAVAILABLE';
  end if;

  update public.owner_otp_challenges
  set status = 'VERIFIED', attempt_count = next_attempt, verified_at = clock_timestamp()
  where id = challenge.id;

  insert into public.owner_devices (owner_id, device_hash)
  values (owner_row.id, p_input ->> 'device_hash')
  on conflict (owner_id, device_hash)
  do update set status = 'ACTIVE', revoked_at = null, last_seen_at = clock_timestamp()
  returning id into device_id;

  session_expiry := clock_timestamp() + interval '43200 seconds';
  insert into public.owner_sessions (
    owner_id, owner_device_id, session_hash, expires_at
  )
  values (owner_row.id, device_id, p_input ->> 'session_hash', session_expiry)
  returning id into owner_session_id;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    target.tenant_id, target.site_id, 'OWNER', owner_row.id, 'OWNER_SESSION_RECLAIMED',
    'OWNER_SESSION', owner_session_id,
    jsonb_build_object(
      'ownerDeviceId', device_id,
      'qrAssetId', target.id
    ),
    'OWNER_SESSION_RECLAIM', request_id
  );

  return jsonb_build_object(
    'reclaimed', true,
    'session_expires_at', session_expiry
  );
end;
$$;

revoke all on function public.request_owner_session_reclaim_otp(jsonb)
from public, anon, authenticated;
revoke all on function public.verify_owner_session_reclaim_otp(jsonb)
from public, anon, authenticated;
grant execute on function public.request_owner_session_reclaim_otp(jsonb) to service_role;
grant execute on function public.verify_owner_session_reclaim_otp(jsonb) to service_role;

comment on function public.request_owner_session_reclaim_otp(jsonb) is
'Starts Owner session reclaim only when sticker, plate, and phone match the active binding.';
comment on function public.verify_owner_session_reclaim_otp(jsonb) is
'Verifies reclaim OTP and creates a hash-only Owner session without changing bindings.';

commit;
