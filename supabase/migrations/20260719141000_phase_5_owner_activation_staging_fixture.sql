begin;

create or replace function public.provision_owner_activation_staging_fixture(
  p_tenant_id uuid,
  p_management_company_id uuid,
  p_site_id uuid,
  p_requester_id uuid,
  p_approver_id uuid,
  p_public_token_hash text,
  p_activation_code_hash text,
  p_fixture_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  design_id uuid := gen_random_uuid();
  batch_id uuid := gen_random_uuid();
  asset_id uuid := gen_random_uuid();
  normalized_label text := upper(trim(coalesce(p_fixture_label, '')));
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_public_token_hash !~ '^[0-9a-f]{64}$'
    or p_activation_code_hash !~ '^[0-9a-f]{64}$'
    or normalized_label !~ '^OA-[A-Z0-9]{8,24}$'
    or p_requester_id = p_approver_id
  then
    raise exception using errcode = '22023', message = 'INVALID_OWNER_FIXTURE_SCOPE';
  end if;
  if not exists (
    select 1
    from public.tenants as tenant
    join public.management_companies as company
      on company.tenant_id = tenant.id and company.id = p_management_company_id
    join public.sites as site
      on site.tenant_id = tenant.id
      and site.management_company_id = company.id
      and site.id = p_site_id
    where tenant.id = p_tenant_id
      and tenant.slug like 'e2e-%'
      and tenant.name like 'Taptolk E2E % Tenant %'
      and tenant.status = 'ACTIVE'
      and company.status = 'ACTIVE'
      and site.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'STAGING_FIXTURE_SCOPE_REQUIRED';
  end if;
  if not exists (
    select 1
    from auth.users as auth_user
    join public.admin_profiles as profile on profile.user_id = auth_user.id
    join public.admin_memberships as membership on membership.user_id = auth_user.id
    where auth_user.id = p_requester_id
      and auth_user.email like 'taptolk-e2e-%@example.com'
      and auth_user.raw_user_meta_data ->> 'purpose' = 'taptolk-staging-site-e2e'
      and profile.status = 'ACTIVE'
      and membership.status = 'ACTIVE'
      and membership.role = 'SITE_ADMIN'
      and membership.tenant_id = p_tenant_id
      and membership.site_id = p_site_id
  ) or not exists (
    select 1
    from auth.users as auth_user
    join public.admin_profiles as profile on profile.user_id = auth_user.id
    join public.admin_memberships as membership on membership.user_id = auth_user.id
    where auth_user.id = p_approver_id
      and auth_user.email like 'taptolk-e2e-%@example.com'
      and auth_user.raw_user_meta_data ->> 'purpose' = 'taptolk-staging-site-e2e'
      and profile.status = 'ACTIVE'
      and membership.status = 'ACTIVE'
      and membership.role = 'SUPER_ADMIN'
      and membership.scope_type = 'PLATFORM'
  ) then
    raise exception using errcode = '42501', message = 'STAGING_FIXTURE_ACTOR_REQUIRED';
  end if;
  if exists (select 1 from public.sticker_design_versions where site_id = p_site_id) then
    raise exception using errcode = '23514', message = 'OWNER_FIXTURE_SITE_NOT_EMPTY';
  end if;

  insert into public.sticker_design_versions (
    id, tenant_id, management_company_id, site_id, template_code, design_config,
    status, created_by, approved_by, approved_at
  )
  values (
    design_id, p_tenant_id, p_management_company_id, p_site_id,
    'ROUND_WHITE_MINIMAL_V1',
    jsonb_build_object(
      'schemaVersion', 1,
      'qrOptions', jsonb_build_object('errorCorrectionLevel', 'H', 'marginModules', 4),
      'zones', jsonb_build_object(
        'customerLogo', 'OPTIONAL_TOP',
        'qr', 'CENTER_WHITE_PLATE',
        'taptolkLogo', 'IMMUTABLE_BOTTOM'
      )
    ),
    'APPROVED', p_requester_id, p_approver_id, statement_timestamp()
  );

  insert into public.qr_batches (
    id, tenant_id, management_company_id, site_id, batch_code,
    sticker_design_version_id, requested_quantity, generated_quantity,
    rendered_quantity, passed_quantity, failed_quantity, purpose, status,
    requested_by, sample_approved_by, sample_approved_at,
    generation_approved_by, generation_approved_at, idempotency_key
  )
  values (
    batch_id, p_tenant_id, p_management_company_id, p_site_id,
    replace(normalized_label, '-', ''), design_id, 1, 1, 1, 1, 0,
    'Owner activation staging acceptance', 'DELIVERED',
    p_requester_id, p_approver_id, statement_timestamp(),
    p_approver_id, statement_timestamp(), gen_random_uuid()
  );

  insert into public.qr_assets (
    id, tenant_id, management_company_id, site_id, batch_id,
    public_token_hash, public_token_ciphertext, token_key_version,
    human_code, status
  )
  values (
    asset_id, p_tenant_id, p_management_company_id, p_site_id, batch_id,
    p_public_token_hash, 'v1.' || p_public_token_hash, 1,
    substr(replace(normalized_label, '-', '') || '0000000000', 1, 10), 'IN_STOCK'
  );

  insert into public.qr_activation_codes (
    tenant_id, site_id, qr_asset_id, code_hash, code_ciphertext, key_version,
    status, expires_at
  )
  values (
    p_tenant_id, p_site_id, asset_id, p_activation_code_hash,
    'v1.' || p_activation_code_hash, 1, 'ISSUED', statement_timestamp() + interval '1 hour'
  );

  insert into public.qr_asset_status_logs (
    tenant_id, management_company_id, site_id, batch_id, qr_asset_id,
    from_status, to_status, reason_code, actor_type
  )
  values (
    p_tenant_id, p_management_company_id, p_site_id, batch_id, asset_id,
    'PRINTED', 'IN_STOCK', 'OWNER_STAGING_FIXTURE_READY', 'SYSTEM'
  );

  return jsonb_build_object(
    'asset_id', asset_id,
    'batch_id', batch_id,
    'design_id', design_id,
    'site_id', p_site_id
  );
end;
$$;

create or replace function public.cleanup_owner_activation_staging_fixture(
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
  owner_ids uuid[];
  binding_ids uuid[];
  vehicle_ids uuid[];
  design_id uuid;
  deleted_owner_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_public_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_OWNER_FIXTURE_SCOPE';
  end if;
  select asset.*
  into target
  from public.qr_assets as asset
  join public.tenants as tenant on tenant.id = asset.tenant_id
  where asset.tenant_id = p_tenant_id
    and asset.public_token_hash = p_public_token_hash
    and tenant.slug like 'e2e-%'
    and tenant.name like 'Taptolk E2E % Tenant %'
  for update of asset;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'OWNER_FIXTURE_NOT_FOUND';
  end if;
  select batch.sticker_design_version_id
  into design_id
  from public.qr_batches as batch
  where batch.id = target.batch_id;

  select coalesce(array_agg(distinct relationship.owner_id), array[]::uuid[])
  into owner_ids
  from public.vehicle_owners as relationship
  where relationship.tenant_id = p_tenant_id and relationship.vehicle_id = target.current_vehicle_id;
  select coalesce(array_agg(binding.id), array[]::uuid[]),
    coalesce(array_agg(distinct binding.vehicle_id), array[]::uuid[])
  into binding_ids, vehicle_ids
  from public.qr_bindings as binding
  where binding.tenant_id = p_tenant_id and binding.qr_asset_id = target.id;

  delete from public.owner_sessions where owner_id = any(owner_ids);
  delete from public.owner_devices where owner_id = any(owner_ids);
  delete from public.owner_phone_verification_proofs where qr_asset_id = target.id;
  delete from public.owner_otp_challenges where qr_asset_id = target.id;
  delete from public.vehicle_owners
  where tenant_id = p_tenant_id and vehicle_id = any(vehicle_ids);

  update public.qr_assets
  set current_binding_id = null, current_vehicle_id = null
  where id = target.id;

  execute 'alter table public.qr_bindings disable trigger trg_qr_bindings_no_delete';
  delete from public.qr_bindings where id = any(binding_ids);
  execute 'alter table public.qr_bindings enable trigger trg_qr_bindings_no_delete';

  delete from public.vehicles where id = any(vehicle_ids);
  delete from public.qr_activation_codes where qr_asset_id = target.id;

  execute 'alter table public.qr_asset_status_logs disable trigger trg_qr_asset_status_logs_immutable';
  delete from public.qr_asset_status_logs where qr_asset_id = target.id;
  execute 'alter table public.qr_asset_status_logs enable trigger trg_qr_asset_status_logs_immutable';

  delete from public.audit_logs
  where tenant_id = p_tenant_id
    and (
      resource_id = target.id
      or actor_id = any(owner_ids)
      or action = 'OWNER_QR_ACTIVATED'
    );
  delete from public.owners where id = any(owner_ids);
  get diagnostics deleted_owner_count = row_count;
  delete from public.qr_assets where id = target.id;
  delete from public.qr_batches where id = target.batch_id;
  delete from public.sticker_design_versions where id = design_id;

  return jsonb_build_object(
    'asset_count', 1,
    'owner_count', deleted_owner_count
  );
end;
$$;

revoke all on function public.provision_owner_activation_staging_fixture(
  uuid, uuid, uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;
revoke all on function public.cleanup_owner_activation_staging_fixture(uuid, text)
from public, anon, authenticated;
grant execute on function public.provision_owner_activation_staging_fixture(
  uuid, uuid, uuid, uuid, uuid, text, text, text
) to service_role;
grant execute on function public.cleanup_owner_activation_staging_fixture(uuid, text)
to service_role;

commit;
