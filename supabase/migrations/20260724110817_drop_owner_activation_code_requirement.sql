begin;

create or replace function public.complete_owner_activation(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.qr_assets%rowtype;
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
  where qr_asset_id = target.id and status = 'ISSUED';
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

revoke all on function public.complete_owner_activation(jsonb) from public, anon, authenticated;
grant execute on function public.complete_owner_activation(jsonb) to service_role;

comment on function public.complete_owner_activation(jsonb) is
'Completes Owner activation with sticker possession plus verified phone proof; activation code validation is intentionally disabled.';

commit;
