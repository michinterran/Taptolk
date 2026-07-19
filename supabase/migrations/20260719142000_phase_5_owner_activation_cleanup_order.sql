begin;

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
  where relationship.tenant_id = p_tenant_id
    and relationship.vehicle_id = target.current_vehicle_id;
  select
    coalesce(array_agg(binding.id), array[]::uuid[]),
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

revoke all on function public.cleanup_owner_activation_staging_fixture(uuid, text)
from public, anon, authenticated;
grant execute on function public.cleanup_owner_activation_staging_fixture(uuid, text)
to service_role;

commit;
