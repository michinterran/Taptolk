begin;

create unique index uq_audit_logs_phase_4_command_request
on public.audit_logs (tenant_id, request_id, action)
where action in (
  'QR_BATCH_RECEIVED',
  'QR_ASSET_ASSIGNED',
  'VEHICLE_IMPORT_VALIDATED',
  'VEHICLE_IMPORT_COMMITTED',
  'QR_ASSET_REPLACED',
  'QR_ASSET_REVOKED'
);

create or replace function app_private.guard_qr_batch_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status in ('COMPLETED', 'CANCELLED') then
    raise exception using errcode = '23514', message = 'BATCH_TERMINAL';
  end if;
  if new.id <> old.id
    or new.tenant_id <> old.tenant_id
    or new.management_company_id <> old.management_company_id
    or new.site_id <> old.site_id
    or new.batch_code <> old.batch_code
    or new.sticker_design_version_id <> old.sticker_design_version_id
    or new.requested_quantity <> old.requested_quantity
    or new.purpose <> old.purpose
    or new.requested_by <> old.requested_by
    or new.idempotency_key <> old.idempotency_key
    or new.created_at <> old.created_at
  then
    raise exception using errcode = '23514', message = 'BATCH_IDENTITY_IMMUTABLE';
  end if;
  if not (
    (old.status = 'DRAFT' and new.status in ('SAMPLE_RENDERING', 'SAMPLE_READY', 'CANCELLED'))
    or (old.status = 'SAMPLE_RENDERING' and new.status in ('SAMPLE_READY', 'FAILED', 'CANCELLED'))
    or (old.status = 'SAMPLE_READY' and new.status in ('SAMPLE_APPROVED', 'DRAFT', 'CANCELLED'))
    or (
      old.status = 'SAMPLE_APPROVED'
      and new.status in ('DRAFT', 'FINAL_APPROVAL_PENDING', 'CANCELLED')
    )
    or (
      old.status = 'FINAL_APPROVAL_PENDING'
      and new.status in ('GENERATION_APPROVED', 'CANCELLED')
    )
    or (old.status = 'GENERATION_APPROVED' and new.status = 'GENERATION_QUEUED')
    or (old.status = 'GENERATION_QUEUED' and new.status in ('GENERATING', 'FAILED'))
    or (
      old.status = 'GENERATING'
      and new.status in ('GENERATED', 'FAILED', 'PARTIALLY_COMPLETED')
    )
    or (
      old.status in ('FAILED', 'PARTIALLY_COMPLETED')
      and new.status in ('GENERATION_QUEUED', 'GENERATING', 'CANCELLED')
    )
    or (old.status = 'GENERATED' and new.status in ('QUALITY_CHECKED', 'FAILED'))
    or (old.status = 'QUALITY_CHECKED' and new.status in ('PRINT_FILE_READY', 'FAILED'))
    or (old.status = 'PRINT_FILE_READY' and new.status = 'SENT_TO_PRINTER')
    or (old.status = 'SENT_TO_PRINTER' and new.status = 'PRINTED')
    or (old.status = 'PRINTED' and new.status = 'SHIPPED')
    or (old.status = 'SHIPPED' and new.status = 'DELIVERED')
    or (old.status = 'DELIVERED' and new.status = 'DISTRIBUTING')
    or (old.status = 'DISTRIBUTING' and new.status = 'COMPLETED')
  ) then
    raise exception using errcode = '23514', message = 'INVALID_BATCH_TRANSITION';
  end if;
  return new;
end;
$$;

create or replace function public.receive_qr_batch(
  p_batch_id uuid,
  p_expected_version integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target public.qr_batches%rowtype;
  received_count integer;
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
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN', 'SITE_OPERATOR']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if target.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if target.status <> 'DELIVERED' then
    raise exception using errcode = '23514', message = 'BATCH_NOT_DELIVERED';
  end if;

  with transitioned as (
    update public.qr_assets
    set status = 'IN_STOCK'
    where batch_id = target.id
      and tenant_id = target.tenant_id
      and site_id = target.site_id
      and status = 'PRINTED'
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
      actor_type,
      actor_id
    )
    select
      asset.tenant_id,
      asset.management_company_id,
      asset.site_id,
      asset.batch_id,
      asset.id,
      'PRINTED',
      'IN_STOCK',
      'BATCH_RECEIVED',
      'ADMIN',
      actor_user_id
    from transitioned as asset
    returning id
  )
  select count(*)::integer
  into received_count
  from status_history;

  if received_count = 0 or received_count <> target.requested_quantity then
    raise exception using errcode = '23514', message = 'BATCH_RECEIPT_COUNT_MISMATCH';
  end if;

  update public.qr_batches
  set status = 'DISTRIBUTING'
  where id = target.id;

  insert into public.inventory_transactions (
    tenant_id,
    site_id,
    qr_batch_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    created_by
  )
  values (
    target.tenant_id,
    target.site_id,
    target.id,
    'RECEIVE',
    received_count,
    'QR_BATCH',
    target.id,
    actor_user_id
  );

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  )
  values (
    target.tenant_id,
    target.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_RECEIVED',
    'QR_BATCH',
    target.id,
    jsonb_build_object('status', 'DISTRIBUTING', 'receivedCount', received_count),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resource_id', target.id,
    'version', target.version + 1,
    'affected_count', received_count
  );
end;
$$;

create or replace function public.assign_qr_asset(
  p_qr_asset_id uuid,
  p_expected_version integer,
  p_plate_lookup_hash text,
  p_plate_ciphertext text,
  p_plate_key_version integer,
  p_plate_last4 text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target public.qr_assets%rowtype;
  target_vehicle_id uuid;
  new_binding_id uuid;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_qr_asset_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_plate_lookup_hash !~ '^[0-9a-f]{64}$'
    or length(p_plate_ciphertext) not between 20 and 1000
    or p_plate_key_version < 1
    or p_plate_last4 !~ '^[0-9가-힣A-Z]{2,4}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_PROTECTED_PLATE';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select *
  into target
  from public.qr_assets
  where id = p_qr_asset_id
  for update;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'QR_ASSET_NOT_FOUND';
  end if;
  if not app_private.current_admin_has_site_scope(
    target.tenant_id,
    target.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN', 'SITE_OPERATOR']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if target.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if target.status <> 'IN_STOCK' or target.current_binding_id is not null then
    raise exception using errcode = '23514', message = 'QR_ASSET_NOT_ASSIGNABLE';
  end if;

  insert into public.vehicles (
    tenant_id,
    site_id,
    plate_lookup_hash,
    plate_ciphertext,
    plate_key_version,
    plate_last4
  )
  values (
    target.tenant_id,
    target.site_id,
    p_plate_lookup_hash,
    p_plate_ciphertext,
    p_plate_key_version,
    p_plate_last4
  )
  on conflict (site_id, plate_lookup_hash)
  do update set plate_lookup_hash = excluded.plate_lookup_hash
  returning id into target_vehicle_id;

  insert into public.qr_bindings (
    tenant_id,
    site_id,
    qr_asset_id,
    vehicle_id,
    assignment_method,
    created_by
  )
  values (
    target.tenant_id,
    target.site_id,
    target.id,
    target_vehicle_id,
    'MANUAL',
    actor_user_id
  )
  returning id into new_binding_id;

  update public.qr_assets
  set
    status = 'ASSIGNED',
    current_vehicle_id = target_vehicle_id,
    current_binding_id = new_binding_id
  where id = target.id;

  insert into public.qr_asset_status_logs (
    tenant_id,
    management_company_id,
    site_id,
    batch_id,
    qr_asset_id,
    from_status,
    to_status,
    reason_code,
    actor_type,
    actor_id
  )
  values (
    target.tenant_id,
    target.management_company_id,
    target.site_id,
    target.batch_id,
    target.id,
    'IN_STOCK',
    'ASSIGNED',
    'MANUAL_ASSIGNMENT',
    'ADMIN',
    actor_user_id
  );

  insert into public.inventory_transactions (
    tenant_id,
    site_id,
    qr_batch_id,
    qr_asset_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    created_by
  )
  values (
    target.tenant_id,
    target.site_id,
    target.batch_id,
    target.id,
    'ASSIGN',
    1,
    'QR_BINDING',
    new_binding_id,
    actor_user_id
  );

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  )
  values (
    target.tenant_id,
    target.site_id,
    'ADMIN',
    actor_user_id,
    'QR_ASSET_ASSIGNED',
    'QR_ASSET',
    target.id,
    jsonb_build_object('status', 'ASSIGNED', 'bindingId', new_binding_id),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resource_id', target.id,
    'version', target.version + 1,
    'affected_count', 1
  );
end;
$$;

create or replace function public.save_validated_vehicle_import(
  p_site_id uuid,
  p_source_checksum_sha256 text,
  p_idempotency_key uuid,
  p_rows jsonb,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target_site public.sites%rowtype;
  new_import_id uuid;
  row_count integer;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_site_id is null or p_idempotency_key is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_source_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_CHECKSUM';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_IMPORT_ROWS';
  end if;
  row_count := jsonb_array_length(p_rows);
  if row_count not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'INVALID_IMPORT_ROW_COUNT';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select *
  into target_site
  from public.sites
  where id = p_site_id
  for share;

  if target_site.id is null then
    raise exception using errcode = 'P0002', message = 'SITE_NOT_FOUND';
  end if;
  if target_site.status <> 'ACTIVE' then
    raise exception using errcode = '23514', message = 'SITE_NOT_ACTIVE';
  end if;
  if not app_private.current_admin_has_scope(
    target_site.tenant_id,
    target_site.management_company_id,
    target_site.id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN', 'SITE_OPERATOR']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.vehicle_imports (
    tenant_id,
    site_id,
    source_checksum_sha256,
    idempotency_key,
    row_count,
    valid_row_count,
    invalid_row_count,
    created_by,
    original_deleted_at,
    expires_at
  )
  values (
    target_site.tenant_id,
    target_site.id,
    p_source_checksum_sha256,
    p_idempotency_key,
    row_count,
    row_count,
    0,
    actor_user_id,
    now(),
    now() + interval '24 hours'
  )
  on conflict (tenant_id, idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning id into new_import_id;

  insert into public.vehicle_import_rows (
    tenant_id,
    site_id,
    import_id,
    row_number,
    plate_lookup_hash,
    plate_ciphertext,
    plate_key_version,
    plate_last4,
    qr_asset_id
  )
  select
    target_site.tenant_id,
    target_site.id,
    new_import_id,
    source.row_number,
    source.plate_lookup_hash,
    source.plate_ciphertext,
    source.plate_key_version,
    source.plate_last4,
    asset.id
  from jsonb_to_recordset(p_rows) as source(
    row_number integer,
    plate_lookup_hash text,
    plate_ciphertext text,
    plate_key_version integer,
    plate_last4 text,
    qr_human_code text
  )
  join public.qr_assets as asset
    on asset.tenant_id = target_site.tenant_id
    and asset.site_id = target_site.id
    and asset.human_code = source.qr_human_code
    and asset.status = 'IN_STOCK'
    and asset.current_binding_id is null
  on conflict (import_id, row_number) do nothing;

  if (
    select count(*)
    from public.vehicle_import_rows
    where import_id = new_import_id
  ) <> row_count then
    raise exception using errcode = '23514', message = 'IMPORT_ROW_RESOLUTION_FAILED';
  end if;

  if exists (
    select 1
    from public.vehicle_import_rows
    where import_id = new_import_id
    group by plate_lookup_hash
    having count(*) > 1
  ) or exists (
    select 1
    from public.vehicle_import_rows
    where import_id = new_import_id
    group by qr_asset_id
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'IMPORT_DUPLICATE';
  end if;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  )
  values (
    target_site.tenant_id,
    target_site.id,
    'ADMIN',
    actor_user_id,
    'VEHICLE_IMPORT_VALIDATED',
    'VEHICLE_IMPORT',
    new_import_id,
    jsonb_build_object(
      'status',
      'VALIDATED',
      'rowCount',
      row_count,
      'originalDeleted',
      true
    ),
    trim(p_reason),
    p_request_id
  )
  on conflict (tenant_id, request_id, action)
  where action in (
    'QR_BATCH_RECEIVED',
    'QR_ASSET_ASSIGNED',
    'VEHICLE_IMPORT_VALIDATED',
    'VEHICLE_IMPORT_COMMITTED',
    'QR_ASSET_REPLACED',
    'QR_ASSET_REVOKED'
  )
  do nothing;

  return jsonb_build_object(
    'resource_id', new_import_id,
    'version', 1,
    'affected_count', row_count
  );
end;
$$;

create or replace function public.commit_vehicle_import(
  p_import_id uuid,
  p_expected_version integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target public.vehicle_imports%rowtype;
  import_row record;
  target_asset public.qr_assets%rowtype;
  target_vehicle_id uuid;
  new_binding_id uuid;
  committed_count integer := 0;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_import_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select *
  into target
  from public.vehicle_imports
  where id = p_import_id
  for update;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'IMPORT_NOT_FOUND';
  end if;
  if not app_private.current_admin_has_site_scope(
    target.tenant_id,
    target.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN', 'SITE_OPERATOR']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if target.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if target.status <> 'VALIDATED' or target.invalid_row_count <> 0 or target.expires_at <= now() then
    raise exception using errcode = '23514', message = 'IMPORT_NOT_COMMITTABLE';
  end if;

  for import_row in
    select *
    from public.vehicle_import_rows
    where import_id = target.id
      and validation_code is null
      and committed_binding_id is null
    order by row_number
  loop
    select *
    into target_asset
    from public.qr_assets
    where id = import_row.qr_asset_id
    for update;

    if target_asset.status <> 'IN_STOCK'
      or target_asset.current_binding_id is not null
      or target_asset.site_id <> target.site_id
    then
      raise exception using errcode = '23514', message = 'IMPORT_QR_NOT_ASSIGNABLE';
    end if;

    insert into public.vehicles (
      tenant_id,
      site_id,
      plate_lookup_hash,
      plate_ciphertext,
      plate_key_version,
      plate_last4
    )
    values (
      target.tenant_id,
      target.site_id,
      import_row.plate_lookup_hash,
      import_row.plate_ciphertext,
      import_row.plate_key_version,
      import_row.plate_last4
    )
    on conflict (site_id, plate_lookup_hash)
    do update set plate_lookup_hash = excluded.plate_lookup_hash
    returning id into target_vehicle_id;

    insert into public.qr_bindings (
      tenant_id,
      site_id,
      qr_asset_id,
      vehicle_id,
      assignment_method,
      created_by
    )
    values (
      target.tenant_id,
      target.site_id,
      target_asset.id,
      target_vehicle_id,
      'CSV_IMPORT',
      actor_user_id
    )
    returning id into new_binding_id;

    update public.qr_assets
    set
      status = 'ASSIGNED',
      current_vehicle_id = target_vehicle_id,
      current_binding_id = new_binding_id
    where id = target_asset.id;

    update public.vehicle_import_rows
    set committed_binding_id = new_binding_id
    where id = import_row.id;

    insert into public.qr_asset_status_logs (
      tenant_id,
      management_company_id,
      site_id,
      batch_id,
      qr_asset_id,
      from_status,
      to_status,
      reason_code,
      actor_type,
      actor_id
    )
    values (
      target_asset.tenant_id,
      target_asset.management_company_id,
      target_asset.site_id,
      target_asset.batch_id,
      target_asset.id,
      'IN_STOCK',
      'ASSIGNED',
      'CSV_IMPORT_ASSIGNMENT',
      'ADMIN',
      actor_user_id
    );

    insert into public.inventory_transactions (
      tenant_id,
      site_id,
      qr_batch_id,
      qr_asset_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      created_by
    )
    values (
      target_asset.tenant_id,
      target_asset.site_id,
      target_asset.batch_id,
      target_asset.id,
      'ASSIGN',
      1,
      'QR_BINDING',
      new_binding_id,
      actor_user_id
    );

    committed_count := committed_count + 1;
  end loop;

  if committed_count <> target.valid_row_count then
    raise exception using errcode = '23514', message = 'IMPORT_COMMIT_COUNT_MISMATCH';
  end if;

  update public.vehicle_imports
  set
    status = 'COMMITTED',
    committed_at = now()
  where id = target.id;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  )
  values (
    target.tenant_id,
    target.site_id,
    'ADMIN',
    actor_user_id,
    'VEHICLE_IMPORT_COMMITTED',
    'VEHICLE_IMPORT',
    target.id,
    jsonb_build_object('status', 'COMMITTED', 'committedCount', committed_count),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resource_id', target.id,
    'version', target.version + 1,
    'affected_count', committed_count
  );
end;
$$;

create or replace function public.replace_qr_asset(
  p_source_qr_asset_id uuid,
  p_replacement_qr_asset_id uuid,
  p_expected_source_version integer,
  p_expected_replacement_version integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  source_asset public.qr_assets%rowtype;
  replacement_asset public.qr_assets%rowtype;
  source_binding public.qr_bindings%rowtype;
  new_binding_id uuid;
  replacement_status public.qr_asset_status;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_source_qr_asset_id is null
    or p_replacement_qr_asset_id is null
    or p_request_id is null
    or p_source_qr_asset_id = p_replacement_qr_asset_id
  then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_source_version < 1 or p_expected_replacement_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  perform id
  from public.qr_assets
  where id in (p_source_qr_asset_id, p_replacement_qr_asset_id)
  order by id
  for update;

  select * into source_asset
  from public.qr_assets
  where id = p_source_qr_asset_id;

  select * into replacement_asset
  from public.qr_assets
  where id = p_replacement_qr_asset_id;

  if source_asset.id is null or replacement_asset.id is null then
    raise exception using errcode = 'P0002', message = 'QR_ASSET_NOT_FOUND';
  end if;
  if source_asset.tenant_id <> replacement_asset.tenant_id
    or source_asset.site_id <> replacement_asset.site_id
  then
    raise exception using errcode = '23514', message = 'REPLACEMENT_SCOPE_MISMATCH';
  end if;
  if not app_private.current_admin_has_site_scope(
    source_asset.tenant_id,
    source_asset.site_id,
    array['SUPER_ADMIN', 'MANAGEMENT_ADMIN']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if source_asset.version <> p_expected_source_version
    or replacement_asset.version <> p_expected_replacement_version
  then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if source_asset.status not in ('ASSIGNED', 'ACTIVATION_PENDING', 'ACTIVE', 'SUSPENDED', 'LOST', 'DAMAGED')
    or source_asset.current_binding_id is null
    or replacement_asset.status <> 'IN_STOCK'
    or replacement_asset.current_binding_id is not null
  then
    raise exception using errcode = '23514', message = 'QR_ASSET_NOT_REPLACEABLE';
  end if;

  select *
  into source_binding
  from public.qr_bindings
  where id = source_asset.current_binding_id
    and ended_at is null
  for update;

  if source_binding.id is null then
    raise exception using errcode = '23514', message = 'ACTIVE_BINDING_NOT_FOUND';
  end if;

  update public.qr_bindings
  set
    ended_at = now(),
    ended_reason = trim(p_reason)
  where id = source_binding.id;

  replacement_status :=
    case
      when source_asset.status = 'ACTIVE' then 'ACTIVE'::public.qr_asset_status
      when source_asset.status = 'ACTIVATION_PENDING' then 'ACTIVATION_PENDING'::public.qr_asset_status
      else 'ASSIGNED'::public.qr_asset_status
    end;

  insert into public.qr_bindings (
    tenant_id,
    site_id,
    qr_asset_id,
    vehicle_id,
    owner_id,
    assignment_method,
    is_primary,
    created_by
  )
  values (
    source_binding.tenant_id,
    source_binding.site_id,
    replacement_asset.id,
    source_binding.vehicle_id,
    source_binding.owner_id,
    'REPLACEMENT',
    source_binding.is_primary,
    actor_user_id
  )
  returning id into new_binding_id;

  update public.qr_assets
  set
    status = 'REPLACED',
    current_vehicle_id = null,
    current_binding_id = null,
    revoked_at = now(),
    revoke_reason = trim(p_reason)
  where id = source_asset.id;

  update public.qr_assets
  set
    status = replacement_status,
    current_vehicle_id = source_binding.vehicle_id,
    current_binding_id = new_binding_id,
    activated_at = case
      when replacement_status = 'ACTIVE' then coalesce(source_asset.activated_at, now())
      else null
    end
  where id = replacement_asset.id;

  update public.qr_activation_codes
  set
    status = 'REVOKED',
    revoked_at = now()
  where qr_asset_id = source_asset.id
    and status = 'ISSUED';

  insert into public.qr_asset_status_logs (
    tenant_id,
    management_company_id,
    site_id,
    batch_id,
    qr_asset_id,
    from_status,
    to_status,
    reason_code,
    actor_type,
    actor_id
  )
  values
    (
      source_asset.tenant_id,
      source_asset.management_company_id,
      source_asset.site_id,
      source_asset.batch_id,
      source_asset.id,
      source_asset.status,
      'REPLACED',
      'QR_REPLACED',
      'ADMIN',
      actor_user_id
    ),
    (
      replacement_asset.tenant_id,
      replacement_asset.management_company_id,
      replacement_asset.site_id,
      replacement_asset.batch_id,
      replacement_asset.id,
      'IN_STOCK',
      replacement_status,
      'QR_REPLACEMENT_ASSIGNED',
      'ADMIN',
      actor_user_id
    );

  insert into public.inventory_transactions (
    tenant_id,
    site_id,
    qr_batch_id,
    qr_asset_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    created_by
  )
  values (
    source_asset.tenant_id,
    source_asset.site_id,
    replacement_asset.batch_id,
    replacement_asset.id,
    'REPLACE',
    1,
    'QR_BINDING',
    new_binding_id,
    actor_user_id
  );

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  )
  values (
    source_asset.tenant_id,
    source_asset.site_id,
    'ADMIN',
    actor_user_id,
    'QR_ASSET_REPLACED',
    'QR_ASSET',
    source_asset.id,
    jsonb_build_object(
      'status',
      'REPLACED',
      'replacementQrAssetId',
      replacement_asset.id,
      'replacementStatus',
      replacement_status
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resource_id', replacement_asset.id,
    'version', replacement_asset.version + 1,
    'affected_count', 2
  );
end;
$$;

create or replace function public.revoke_qr_asset(
  p_qr_asset_id uuid,
  p_expected_version integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target public.qr_assets%rowtype;
  active_binding_id uuid;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_qr_asset_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select *
  into target
  from public.qr_assets
  where id = p_qr_asset_id
  for update;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'QR_ASSET_NOT_FOUND';
  end if;
  if not app_private.current_admin_has_site_scope(
    target.tenant_id,
    target.site_id,
    array['SUPER_ADMIN', 'MANAGEMENT_ADMIN']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if target.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if target.status in ('REPLACED', 'REVOKED', 'EXPIRED') then
    raise exception using errcode = '23514', message = 'QR_ASSET_TERMINAL';
  end if;

  active_binding_id := target.current_binding_id;
  if active_binding_id is not null then
    update public.qr_bindings
    set
      ended_at = now(),
      ended_reason = trim(p_reason)
    where id = active_binding_id
      and ended_at is null;
  end if;

  update public.qr_activation_codes
  set
    status = 'REVOKED',
    revoked_at = now()
  where qr_asset_id = target.id
    and status = 'ISSUED';

  update public.qr_assets
  set
    status = 'REVOKED',
    current_vehicle_id = null,
    current_binding_id = null,
    revoked_at = now(),
    revoke_reason = trim(p_reason)
  where id = target.id;

  insert into public.qr_asset_status_logs (
    tenant_id,
    management_company_id,
    site_id,
    batch_id,
    qr_asset_id,
    from_status,
    to_status,
    reason_code,
    actor_type,
    actor_id
  )
  values (
    target.tenant_id,
    target.management_company_id,
    target.site_id,
    target.batch_id,
    target.id,
    target.status,
    'REVOKED',
    'ADMIN_REVOKE',
    'ADMIN',
    actor_user_id
  );

  insert into public.inventory_transactions (
    tenant_id,
    site_id,
    qr_batch_id,
    qr_asset_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    created_by
  )
  values (
    target.tenant_id,
    target.site_id,
    target.batch_id,
    target.id,
    'REVOKE',
    1,
    case when active_binding_id is null then 'QR_ASSET' else 'QR_BINDING' end,
    coalesce(active_binding_id, target.id),
    actor_user_id
  );

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  )
  values (
    target.tenant_id,
    target.site_id,
    'ADMIN',
    actor_user_id,
    'QR_ASSET_REVOKED',
    'QR_ASSET',
    target.id,
    jsonb_build_object('status', 'REVOKED', 'bindingEnded', active_binding_id is not null),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resource_id', target.id,
    'version', target.version + 1,
    'affected_count', 1
  );
end;
$$;

revoke all on function public.receive_qr_batch(uuid, integer, text, uuid)
from public, anon;
revoke all on function public.assign_qr_asset(uuid, integer, text, text, integer, text, text, uuid)
from public, anon;
revoke all on function public.save_validated_vehicle_import(uuid, text, uuid, jsonb, text, uuid)
from public, anon;
revoke all on function public.commit_vehicle_import(uuid, integer, text, uuid)
from public, anon;
revoke all on function public.replace_qr_asset(uuid, uuid, integer, integer, text, uuid)
from public, anon;
revoke all on function public.revoke_qr_asset(uuid, integer, text, uuid)
from public, anon;

grant execute on function public.receive_qr_batch(uuid, integer, text, uuid)
to authenticated;
grant execute on function public.assign_qr_asset(uuid, integer, text, text, integer, text, text, uuid)
to authenticated;
grant execute on function public.save_validated_vehicle_import(uuid, text, uuid, jsonb, text, uuid)
to authenticated;
grant execute on function public.commit_vehicle_import(uuid, integer, text, uuid)
to authenticated;
grant execute on function public.replace_qr_asset(uuid, uuid, integer, integer, text, uuid)
to authenticated;
grant execute on function public.revoke_qr_asset(uuid, integer, text, uuid)
to authenticated;

commit;
