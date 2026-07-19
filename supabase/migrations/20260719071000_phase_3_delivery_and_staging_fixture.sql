begin;

create or replace function public.advance_qr_batch_delivery(
  p_batch_id uuid,
  p_expected_version integer,
  p_target_status text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.qr_batches%rowtype;
  transitioned_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_batch_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_target_status not in ('SENT_TO_PRINTER', 'PRINTED', 'SHIPPED', 'DELIVERED') then
    raise exception using errcode = '22023', message = 'INVALID_DELIVERY_STATUS';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select *
  into target
  from public.qr_batches
  where id = p_batch_id
  for update;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'BATCH_NOT_FOUND';
  end if;
  if target.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if not (
    (target.status = 'PRINT_FILE_READY' and p_target_status = 'SENT_TO_PRINTER')
    or (target.status = 'SENT_TO_PRINTER' and p_target_status = 'PRINTED')
    or (target.status = 'PRINTED' and p_target_status = 'SHIPPED')
    or (target.status = 'SHIPPED' and p_target_status = 'DELIVERED')
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DELIVERY_TRANSITION';
  end if;

  if p_target_status = 'PRINTED' then
    with transitioned as (
      update public.qr_assets
      set status = 'PRINTED'
      where batch_id = target.id
        and tenant_id = target.tenant_id
        and site_id = target.site_id
        and status = 'PRINT_READY'
      returning *
    ),
    status_history as (
      insert into public.qr_asset_status_logs (
        tenant_id,
        management_company_id,
        site_id,
        batch_id,
        qr_asset_id,
        from_status,
        to_status,
        reason_code,
        actor_type
      )
      select
        asset.tenant_id,
        asset.management_company_id,
        asset.site_id,
        asset.batch_id,
        asset.id,
        'PRINT_READY',
        'PRINTED',
        'PRINT_CONFIRMED',
        'WORKER'
      from transitioned as asset
      returning id
    )
    select count(*)::integer
    into transitioned_count
    from status_history;

    if transitioned_count <> target.requested_quantity then
      raise exception using errcode = '23514', message = 'PRINTED_ASSET_COUNT_MISMATCH';
    end if;
  elsif p_target_status in ('SHIPPED', 'DELIVERED') then
    select count(*)::integer
    into transitioned_count
    from public.qr_assets
    where batch_id = target.id
      and tenant_id = target.tenant_id
      and site_id = target.site_id
      and status = 'PRINTED';

    if transitioned_count <> target.requested_quantity then
      raise exception using errcode = '23514', message = 'DELIVERY_ASSET_COUNT_MISMATCH';
    end if;
  end if;

  update public.qr_batches
  set status = p_target_status::public.qr_batch_status
  where id = target.id;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    before_data,
    after_data,
    reason,
    request_id
  )
  values (
    target.tenant_id,
    target.site_id,
    'WORKER',
    null,
    'QR_BATCH_DELIVERY_ADVANCED',
    'QR_BATCH',
    target.id,
    jsonb_build_object('status', target.status),
    jsonb_build_object('status', p_target_status),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resource_id', target.id,
    'status', p_target_status,
    'version', target.version + 1,
    'affected_count', transitioned_count
  );
end;
$$;

create or replace function public.cleanup_staging_e2e_fixture(
  p_tenant_ids uuid[],
  p_actor_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_count integer;
  actor_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_tenant_ids is null
    or p_actor_ids is null
    or cardinality(p_tenant_ids) not between 1 and 4
    or cardinality(p_actor_ids) not between 0 and 12
    or array_position(p_tenant_ids, null) is not null
    or array_position(p_actor_ids, null) is not null
  then
    raise exception using errcode = '22023', message = 'INVALID_FIXTURE_SCOPE';
  end if;

  select count(*)::integer
  into tenant_count
  from public.tenants
  where id = any(p_tenant_ids)
    and slug like 'e2e-%'
    and name like 'Taptolk E2E % Tenant %';

  if tenant_count <> cardinality(p_tenant_ids) then
    raise exception using errcode = '42501', message = 'FIXTURE_TENANT_REQUIRED';
  end if;

  select count(*)::integer
  into actor_count
  from auth.users as auth_user
  join public.admin_profiles as profile
    on profile.user_id = auth_user.id
  where auth_user.id = any(p_actor_ids)
    and auth_user.email like 'taptolk-e2e-%@example.com'
    and auth_user.raw_user_meta_data ->> 'purpose' = 'taptolk-staging-site-e2e'
    and profile.display_name like 'Taptolk E2E %';

  if actor_count <> cardinality(p_actor_ids) then
    raise exception using errcode = '42501', message = 'FIXTURE_ACTOR_REQUIRED';
  end if;

  execute 'alter table public.qr_bindings disable trigger trg_qr_bindings_no_delete';
  execute 'alter table public.inventory_transactions disable trigger trg_inventory_transactions_no_update_delete';
  execute 'alter table public.rendered_assets disable trigger trg_rendered_assets_no_update_delete';
  execute 'alter table public.qr_asset_status_logs disable trigger trg_qr_asset_status_logs_immutable';

  delete from public.vehicle_import_rows where tenant_id = any(p_tenant_ids);
  delete from public.vehicle_imports where tenant_id = any(p_tenant_ids);
  delete from public.inventory_transactions where tenant_id = any(p_tenant_ids);
  update public.qr_assets
  set current_binding_id = null, current_vehicle_id = null
  where tenant_id = any(p_tenant_ids)
    and (current_binding_id is not null or current_vehicle_id is not null);
  delete from public.qr_bindings where tenant_id = any(p_tenant_ids);
  delete from public.vehicles where tenant_id = any(p_tenant_ids);
  delete from public.qr_activation_codes where tenant_id = any(p_tenant_ids);
  delete from public.qr_generation_items where tenant_id = any(p_tenant_ids);
  delete from public.rendered_assets where tenant_id = any(p_tenant_ids);
  delete from public.render_jobs where tenant_id = any(p_tenant_ids);
  delete from public.print_exports where tenant_id = any(p_tenant_ids);
  delete from public.qr_asset_status_logs where tenant_id = any(p_tenant_ids);
  delete from public.qr_generation_jobs where tenant_id = any(p_tenant_ids);
  delete from public.qr_batch_samples where tenant_id = any(p_tenant_ids);
  delete from public.qr_assets where tenant_id = any(p_tenant_ids);
  delete from public.qr_batches where tenant_id = any(p_tenant_ids);
  delete from public.brand_assets where tenant_id = any(p_tenant_ids);
  delete from public.sticker_design_versions where tenant_id = any(p_tenant_ids);
  delete from public.site_lifecycle_requests where tenant_id = any(p_tenant_ids);
  delete from public.audit_logs where tenant_id = any(p_tenant_ids);
  delete from public.admin_memberships where user_id = any(p_actor_ids);
  delete from public.admin_profiles where user_id = any(p_actor_ids);
  delete from public.sites where tenant_id = any(p_tenant_ids);
  delete from public.management_companies where tenant_id = any(p_tenant_ids);
  delete from public.tenants where id = any(p_tenant_ids);

  execute 'alter table public.qr_bindings enable trigger trg_qr_bindings_no_delete';
  execute 'alter table public.inventory_transactions enable trigger trg_inventory_transactions_no_update_delete';
  execute 'alter table public.rendered_assets enable trigger trg_rendered_assets_no_update_delete';
  execute 'alter table public.qr_asset_status_logs enable trigger trg_qr_asset_status_logs_immutable';

  return jsonb_build_object(
    'tenant_count', tenant_count,
    'actor_count', actor_count
  );
end;
$$;

revoke all on function public.advance_qr_batch_delivery(uuid, integer, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.advance_qr_batch_delivery(uuid, integer, text, text, uuid)
to service_role;

revoke all on function public.cleanup_staging_e2e_fixture(uuid[], uuid[])
from public, anon, authenticated;
grant execute on function public.cleanup_staging_e2e_fixture(uuid[], uuid[])
to service_role;

commit;
