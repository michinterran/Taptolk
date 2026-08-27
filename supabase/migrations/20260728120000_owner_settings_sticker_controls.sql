begin;

create or replace function public.update_owner_sticker_state(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
  action text := p_input ->> 'action';
  binding_row public.qr_bindings%rowtype;
  relationship_row public.vehicle_owners%rowtype;
  asset_row public.qr_assets%rowtype;
  next_status public.qr_asset_status;
  audit_action text;
  status_reason text;
  request_id uuid := gen_random_uuid();
begin
  if action not in ('RELEASE', 'RESUME', 'SUSPEND') then
    raise exception using errcode = '22023', message = 'OWNER_STICKER_INVALID';
  end if;
  if coalesce(p_input ->> 'vehicle_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception using errcode = '22023', message = 'OWNER_STICKER_INVALID';
  end if;

  select * into ctx from app_private.owner_session_context(
    p_input ->> 'session_hash',
    p_input ->> 'device_hash'
  );

  select *
  into relationship_row
  from public.vehicle_owners
  where owner_id = ctx.owner_id
    and vehicle_id = (p_input ->> 'vehicle_id')::uuid
    and ended_at is null
    and is_primary
  for update;

  if relationship_row.id is null then
    raise exception using errcode = 'P0002', message = 'OWNER_STICKER_UNAVAILABLE';
  end if;

  select *
  into binding_row
  from public.qr_bindings
  where tenant_id = relationship_row.tenant_id
    and site_id = relationship_row.site_id
    and vehicle_id = relationship_row.vehicle_id
    and owner_id = ctx.owner_id
    and ended_at is null
    and is_primary
  for update;

  if binding_row.id is null then
    raise exception using errcode = 'P0002', message = 'OWNER_STICKER_UNAVAILABLE';
  end if;

  select *
  into asset_row
  from public.qr_assets
  where tenant_id = binding_row.tenant_id
    and site_id = binding_row.site_id
    and id = binding_row.qr_asset_id
  for update;

  if asset_row.id is null then
    raise exception using errcode = 'P0002', message = 'OWNER_STICKER_UNAVAILABLE';
  end if;

  if action = 'SUSPEND' then
    if asset_row.status <> 'ACTIVE' then
      raise exception using errcode = '23505', message = 'OWNER_STICKER_STATE_CONFLICT';
    end if;
    next_status := 'SUSPENDED';
    audit_action := 'OWNER_STICKER_SUSPENDED';
    status_reason := 'OWNER_STICKER_SUSPENDED';
  elsif action = 'RESUME' then
    if asset_row.status <> 'SUSPENDED' then
      raise exception using errcode = '23505', message = 'OWNER_STICKER_STATE_CONFLICT';
    end if;
    next_status := 'ACTIVE';
    audit_action := 'OWNER_STICKER_RESUMED';
    status_reason := 'OWNER_STICKER_RESUMED';
  else
    if asset_row.status not in ('ACTIVE', 'SUSPENDED') then
      raise exception using errcode = '23505', message = 'OWNER_STICKER_STATE_CONFLICT';
    end if;
    next_status := 'ACTIVATION_PENDING';
    audit_action := 'OWNER_STICKER_RELEASED';
    status_reason := 'OWNER_STICKER_RELEASED';
  end if;

  if action = 'RELEASE' then
    update public.qr_bindings
    set ended_at = clock_timestamp(), ended_reason = 'OWNER_RELEASED'
    where id = binding_row.id;

    update public.vehicle_owners
    set ended_at = clock_timestamp(), ended_reason = 'OWNER_RELEASED'
    where id = relationship_row.id;

    update public.qr_assets
    set
      status = next_status,
      current_vehicle_id = null,
      current_binding_id = null,
      suspended_at = null,
      revoked_at = null,
      revoke_reason = null,
      updated_at = clock_timestamp(),
      version = version + 1
    where id = asset_row.id;
  else
    update public.qr_assets
    set
      status = next_status,
      suspended_at = case when action = 'SUSPEND' then clock_timestamp() else null end,
      updated_at = clock_timestamp(),
      version = version + 1
    where id = asset_row.id;
  end if;

  insert into public.qr_asset_status_logs (
    tenant_id, management_company_id, site_id, batch_id, qr_asset_id,
    from_status, to_status, reason_code, actor_type, actor_id
  )
  values (
    asset_row.tenant_id, asset_row.management_company_id, asset_row.site_id, asset_row.batch_id,
    asset_row.id, asset_row.status, next_status, status_reason, 'OWNER', ctx.owner_id
  );

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type, resource_id,
    before_data, after_data, reason, request_id
  )
  values (
    asset_row.tenant_id, asset_row.site_id, 'OWNER', ctx.owner_id, audit_action,
    'QR_ASSET', asset_row.id,
    jsonb_build_object(
      'status', asset_row.status,
      'bindingId', binding_row.id,
      'vehicleId', binding_row.vehicle_id
    ),
    jsonb_build_object(
      'status', next_status,
      'bindingId', case when action = 'RELEASE' then null else binding_row.id end,
      'vehicleId', case when action = 'RELEASE' then null else binding_row.vehicle_id end
    ),
    status_reason, request_id
  );

  return jsonb_build_object(
    'vehicle_id', relationship_row.vehicle_id,
    'qr_status', next_status
  );
end;
$$;

revoke all on function public.update_owner_sticker_state(jsonb) from public, anon, authenticated;
grant execute on function public.update_owner_sticker_state(jsonb) to service_role;

comment on function public.update_owner_sticker_state(jsonb)
is 'Owner PWA Settings command for pausing, resuming, or ending the active sticker registration without exposing owner phone data.';

commit;
