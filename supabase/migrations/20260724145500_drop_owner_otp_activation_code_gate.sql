begin;

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

revoke all on function public.request_owner_activation_otp(jsonb) from public, anon, authenticated;
grant execute on function public.request_owner_activation_otp(jsonb) to service_role;

comment on function public.request_owner_activation_otp(jsonb) is
'Requests Owner activation OTP for sticker-possession activation; visible activation code entry is intentionally not required.';

commit;
