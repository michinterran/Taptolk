begin;

create or replace function public.provision_public_contact_staging_fixture(
  p_tenant_id uuid,
  p_management_company_id uuid,
  p_site_id uuid,
  p_requester_id uuid,
  p_approver_id uuid,
  p_public_token_hash text,
  p_activation_code_hash text,
  p_phone_hash text,
  p_plate_hash text,
  p_plate_last4 text,
  p_fixture_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_label text := upper(trim(coalesce(p_fixture_label, '')));
  owner_label text;
  base jsonb;
  asset public.qr_assets%rowtype;
  owner_id uuid := gen_random_uuid();
  vehicle_id uuid := gen_random_uuid();
  binding_id uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if normalized_label !~ '^PC-[A-Z0-9]{8,24}$'
    or p_public_token_hash !~ '^[0-9a-f]{64}$'
    or p_activation_code_hash !~ '^[0-9a-f]{64}$'
    or p_phone_hash !~ '^[0-9a-f]{64}$'
    or p_plate_hash !~ '^[0-9a-f]{64}$'
    or p_plate_last4 !~ '^[0-9]{4}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_PUBLIC_CONTACT_FIXTURE_SCOPE';
  end if;
  owner_label := 'OA-' || substr(replace(normalized_label, '-', ''), 3);

  select public.provision_owner_activation_staging_fixture(
    p_tenant_id,
    p_management_company_id,
    p_site_id,
    p_requester_id,
    p_approver_id,
    p_public_token_hash,
    p_activation_code_hash,
    owner_label
  )
  into base;

  select * into asset
  from public.qr_assets
  where id = (base ->> 'asset_id')::uuid
  for update;

  insert into public.owners (
    id, phone_hash, phone_ciphertext, phone_key_version, phone_last4,
    verified_at, terms_version, privacy_version, consented_at
  )
  values (
    owner_id, p_phone_hash, 'v1.' || p_phone_hash, 1, '0000',
    statement_timestamp(), 'TERMS_V1', 'PRIVACY_V1', statement_timestamp()
  );

  insert into public.vehicles (
    id, tenant_id, site_id, plate_lookup_hash, plate_ciphertext,
    plate_key_version, plate_last4, status
  )
  values (
    vehicle_id, p_tenant_id, p_site_id, p_plate_hash, 'v1.' || p_plate_hash,
    1, p_plate_last4, 'ACTIVE'
  );

  insert into public.qr_bindings (
    id, tenant_id, site_id, qr_asset_id, vehicle_id, owner_id,
    assignment_method, created_by_owner_id
  )
  values (
    binding_id, p_tenant_id, p_site_id, asset.id, vehicle_id, owner_id,
    'OWNER_ACTIVATION', owner_id
  );

  insert into public.vehicle_owners (
    tenant_id, site_id, vehicle_id, owner_id, is_primary, activation_source
  )
  values (
    p_tenant_id, p_site_id, vehicle_id, owner_id, true, 'QR_ACTIVATION'
  );

  insert into public.qr_asset_status_logs (
    tenant_id, management_company_id, site_id, batch_id, qr_asset_id,
    from_status, to_status, reason_code, actor_type, actor_id
  )
  values (
    p_tenant_id, p_management_company_id, p_site_id, asset.batch_id, asset.id,
    'IN_STOCK', 'ACTIVATION_PENDING', 'PUBLIC_CONTACT_FIXTURE_ACTIVATING',
    'OWNER', owner_id
  );
  insert into public.qr_asset_status_logs (
    tenant_id, management_company_id, site_id, batch_id, qr_asset_id,
    from_status, to_status, reason_code, actor_type, actor_id
  )
  values (
    p_tenant_id, p_management_company_id, p_site_id, asset.batch_id, asset.id,
    'ACTIVATION_PENDING', 'ACTIVE', 'PUBLIC_CONTACT_FIXTURE_ACTIVE',
    'OWNER', owner_id
  );

  update public.qr_assets
  set
    status = 'ACTIVE',
    current_vehicle_id = vehicle_id,
    current_binding_id = binding_id,
    activated_at = statement_timestamp()
  where id = asset.id;
  update public.qr_activation_codes
  set
    status = 'USED',
    used_at = statement_timestamp(),
    used_by_owner_id = owner_id
  where qr_asset_id = asset.id;

  return jsonb_build_object(
    'asset_id', asset.id,
    'owner_id', owner_id,
    'vehicle_id', vehicle_id,
    'site_id', p_site_id
  );
end;
$$;

create or replace function public.cleanup_public_contact_staging_fixture(
  p_tenant_id uuid,
  p_public_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.qr_assets%rowtype;
  session_ids uuid[];
  deleted_session_count integer := 0;
  owner_cleanup jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_public_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_PUBLIC_CONTACT_FIXTURE_SCOPE';
  end if;
  select asset.* into target
  from public.qr_assets as asset
  join public.tenants as tenant on tenant.id = asset.tenant_id
  where asset.tenant_id = p_tenant_id
    and asset.public_token_hash = p_public_token_hash
    and tenant.slug like 'e2e-%'
    and tenant.name like 'Taptolk E2E % Tenant %'
  for update of asset;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'PUBLIC_CONTACT_FIXTURE_NOT_FOUND';
  end if;

  select coalesce(array_agg(session.id), array[]::uuid[])
  into session_ids
  from public.contact_sessions as session
  where session.tenant_id = p_tenant_id and session.qr_asset_id = target.id;

  delete from public.notification_deliveries
  where tenant_id = p_tenant_id and session_id = any(session_ids);
  execute 'alter table public.messages disable trigger trg_messages_immutable';
  delete from public.messages
  where tenant_id = p_tenant_id and session_id = any(session_ids);
  execute 'alter table public.messages enable trigger trg_messages_immutable';
  delete from public.session_participants
  where tenant_id = p_tenant_id and session_id = any(session_ids);
  execute 'alter table public.public_contact_attempts disable trigger trg_public_contact_attempts_immutable';
  delete from public.public_contact_attempts
  where tenant_id = p_tenant_id and qr_asset_id = target.id;
  execute 'alter table public.public_contact_attempts enable trigger trg_public_contact_attempts_immutable';
  delete from public.audit_logs
  where tenant_id = p_tenant_id
    and resource_id = any(session_ids)
    and action = 'PUBLIC_CONTACT_CREATED';
  delete from public.contact_sessions
  where tenant_id = p_tenant_id and id = any(session_ids);
  get diagnostics deleted_session_count = row_count;

  select public.cleanup_owner_activation_staging_fixture(p_tenant_id, p_public_token_hash)
  into owner_cleanup;

  return jsonb_build_object(
    'session_count', deleted_session_count,
    'asset_count', owner_cleanup -> 'asset_count',
    'owner_count', owner_cleanup -> 'owner_count'
  );
end;
$$;

revoke all on function public.provision_public_contact_staging_fixture(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.cleanup_public_contact_staging_fixture(uuid, text)
from public, anon, authenticated;
grant execute on function public.provision_public_contact_staging_fixture(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text
) to service_role;
grant execute on function public.cleanup_public_contact_staging_fixture(uuid, text)
to service_role;

comment on function public.provision_public_contact_staging_fixture(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text
) is 'Creates one bounded ACTIVE QR/Owner fixture for unauthenticated caller staging acceptance.';
comment on function public.cleanup_public_contact_staging_fixture(uuid, text) is
  'Deletes only exact E2E public-contact rows before delegating to bounded Owner fixture cleanup.';

commit;
