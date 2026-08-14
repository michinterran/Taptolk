begin;

create or replace function public.advance_qr_batch_delivery_as_admin(
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
set lock_timeout = '3s'
as $$
declare
  actor_user_id uuid := auth.uid();
  target public.qr_batches%rowtype;
  updated_batch public.qr_batches%rowtype;
  existing_audit public.audit_logs%rowtype;
  transitioned_count integer := 0;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
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
  if not app_private.current_admin_has_scope(
    target.tenant_id,
    target.management_company_id,
    target.site_id,
    array['SUPER_ADMIN']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select *
  into existing_audit
  from public.audit_logs
  where tenant_id = target.tenant_id
    and request_id = p_request_id
    and action = 'QR_BATCH_DELIVERY_ADVANCED_BY_ADMIN';

  if existing_audit.id is not null then
    return jsonb_build_object(
      'resource_id', target.id,
      'version', coalesce((existing_audit.after_data ->> 'version')::integer, target.version),
      'affected_count', coalesce(
        (existing_audit.after_data ->> 'affectedCount')::integer,
        0
      )
    );
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
    ), status_history as (
      insert into public.qr_asset_status_logs (
        tenant_id,
        management_company_id,
        site_id,
        batch_id,
        qr_asset_id,
        from_status,
        to_status,
        reason_code,
        reason_text,
        actor_type,
        actor_id
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
        trim(p_reason),
        'ADMIN',
        actor_user_id
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
  where id = target.id
  returning * into updated_batch;

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
    'ADMIN',
    actor_user_id,
    'QR_BATCH_DELIVERY_ADVANCED_BY_ADMIN',
    'QR_BATCH',
    target.id,
    jsonb_build_object('status', target.status),
    jsonb_build_object(
      'status', p_target_status,
      'version', updated_batch.version,
      'affectedCount', transitioned_count
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resource_id', updated_batch.id,
    'version', updated_batch.version,
    'affected_count', transitioned_count
  );
end;
$$;

create unique index uq_audit_logs_qr_batch_delivery_admin_request
on public.audit_logs (tenant_id, request_id, action)
where action = 'QR_BATCH_DELIVERY_ADVANCED_BY_ADMIN';

revoke all on function public.advance_qr_batch_delivery_as_admin(uuid, integer, text, text, uuid)
from public, anon;
grant execute on function public.advance_qr_batch_delivery_as_admin(uuid, integer, text, text, uuid)
to authenticated;

commit;
