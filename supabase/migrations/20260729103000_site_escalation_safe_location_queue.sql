begin;

create table public.vehicle_site_contact_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  vehicle_id uuid not null,
  location_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_vehicle_site_contact_locations_vehicle
    foreign key (tenant_id, site_id, vehicle_id)
    references public.vehicles (tenant_id, site_id, id)
    on delete restrict,
  constraint uq_vehicle_site_contact_locations_vehicle unique (tenant_id, vehicle_id),
  constraint chk_vehicle_site_contact_locations_label check (
    length(trim(location_label)) between 2 and 160
    and location_label !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
    and regexp_replace(location_label, '[^0-9]', '', 'g') !~ '^0[0-9]{8,10}$'
  )
);

create index idx_vehicle_site_contact_locations_site_vehicle
on public.vehicle_site_contact_locations (tenant_id, site_id, vehicle_id);

alter table public.vehicle_site_contact_locations enable row level security;
alter table public.vehicle_site_contact_locations force row level security;

revoke all on table public.vehicle_site_contact_locations from public, anon, authenticated;
grant all on table public.vehicle_site_contact_locations to service_role;

create trigger trg_vehicle_site_contact_locations_touch
before update on public.vehicle_site_contact_locations
for each row execute function app_private.touch_versioned_row();

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
  site_contact_location text := nullif(trim(coalesce(p_input ->> 'site_contact_location', '')), '');
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
    or site_contact_location is null
    or length(site_contact_location) not between 2 and 160
    or site_contact_location ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
    or regexp_replace(site_contact_location, '[^0-9]', '', 'g') ~ '^0[0-9]{8,10}$'
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

  insert into public.vehicle_site_contact_locations (
    tenant_id, site_id, vehicle_id, location_label
  )
  values (target.tenant_id, target.site_id, vehicle_row.id, site_contact_location)
  on conflict (tenant_id, vehicle_id)
  do update set
    location_label = excluded.location_label,
    updated_at = statement_timestamp(),
    version = public.vehicle_site_contact_locations.version + 1;

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
      'ownerId', owner_row.id,
      'siteContactLocationProvided', true
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

create or replace function public.read_site_escalation_queue(p_site_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  site_row public.sites%rowtype;
begin
  if auth.role() <> 'authenticated' then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  select * into site_row
  from public.sites
  where id = p_site_id and deleted_at is null;
  if site_row.id is null
    or not app_private.current_admin_has_site_scope(
      site_row.tenant_id,
      site_row.id,
      array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN', 'SITE_OPERATOR']
    )
  then
    raise exception using errcode = '42501', message = 'SITE_ESCALATION_FORBIDDEN';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'session_id', queue.session_id,
          'created_at', queue.created_at,
          'escalated_at', queue.escalated_at,
          'reason_code', queue.reason_code,
          'status', queue.status,
          'vehicle_plate_last4', queue.vehicle_plate_last4,
          'site_contact_location', queue.site_contact_location,
          'site_address', site_row.address
        )
        order by queue.escalated_at desc nulls last, queue.created_at desc
      )
      from (
        select
          session.id as session_id,
          session.created_at,
          session.escalated_at,
          session.reason_code,
          session.status,
          vehicle.plate_last4 as vehicle_plate_last4,
          location.location_label as site_contact_location
        from public.contact_sessions as session
        join public.vehicles as vehicle
          on vehicle.tenant_id = session.tenant_id
          and vehicle.site_id = session.site_id
          and vehicle.id = session.vehicle_id
        left join public.vehicle_site_contact_locations as location
          on location.tenant_id = session.tenant_id
          and location.site_id = session.site_id
          and location.vehicle_id = session.vehicle_id
        where session.tenant_id = site_row.tenant_id
          and session.site_id = site_row.id
          and session.status = 'ESCALATED'
          and session.escalated_at is not null
          and session.expires_at > statement_timestamp()
        order by session.escalated_at desc nulls last, session.created_at desc
        limit 25
      ) as queue
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.complete_owner_activation(jsonb) from public, anon, authenticated;
grant execute on function public.complete_owner_activation(jsonb) to service_role;

revoke all on function public.read_site_escalation_queue(uuid) from public, anon;
grant execute on function public.read_site_escalation_queue(uuid) to authenticated, service_role;

comment on table public.vehicle_site_contact_locations is
  'Site-only owner-provided location labels for intercom or on-site escalation. Owner names and phone numbers do not belong here.';
comment on column public.vehicle_site_contact_locations.location_label is
  'Address detail or site call label shown only to scoped site operators during escalated contact handling.';
comment on function public.complete_owner_activation(jsonb) is
  'Completes Owner activation with sticker possession plus verified phone proof and a site-only contact location; activation code validation remains intentionally disabled.';
comment on function public.read_site_escalation_queue(uuid) is
  'Returns escalated site handling rows without Owner name, Owner phone, caller token, response token, or message body.';

commit;
