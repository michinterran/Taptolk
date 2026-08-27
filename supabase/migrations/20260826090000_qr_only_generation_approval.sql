begin;

-- New issuance is QR-only. The legacy design/sample records remain available for
-- historical batches, while this mode uses an internal immutable QR-only record
-- and still requires an independent final generation approval.
alter table public.qr_batches
  drop constraint chk_qr_batches_request_mode;

alter table public.qr_batches
  add constraint chk_qr_batches_request_mode
  check (request_mode in ('STANDARD', 'ADMIN_DIRECT', 'QR_ONLY'));

alter table public.qr_batches
  drop constraint chk_qr_batches_state_metadata;

alter table public.qr_batches
  add constraint chk_qr_batches_state_metadata check (
    (
      request_mode = 'STANDARD'
      and (
        (
          status in ('DRAFT', 'SAMPLE_RENDERING', 'SAMPLE_READY')
          and sample_approved_by is null
          and sample_approved_at is null
          and generation_approved_by is null
          and generation_approved_at is null
          and cancelled_by is null
          and cancelled_at is null
        )
        or (
          status in ('SAMPLE_APPROVED', 'FINAL_APPROVAL_PENDING')
          and sample_approved_by is not null
          and sample_approved_at is not null
          and requested_by <> sample_approved_by
          and generation_approved_by is null
          and generation_approved_at is null
          and cancelled_by is null
          and cancelled_at is null
        )
        or (
          status in (
            'GENERATION_APPROVED', 'GENERATION_QUEUED', 'GENERATING', 'GENERATED',
            'QUALITY_CHECKED', 'PRINT_FILE_READY', 'SENT_TO_PRINTER', 'PRINTED',
            'SHIPPED', 'DELIVERED', 'DISTRIBUTING', 'COMPLETED', 'FAILED',
            'PARTIALLY_COMPLETED'
          )
          and sample_approved_by is not null
          and sample_approved_at is not null
          and requested_by <> sample_approved_by
          and generation_approved_by is not null
          and generation_approved_at is not null
          and requested_by <> generation_approved_by
          and cancelled_by is null
          and cancelled_at is null
        )
        or (
          status = 'CANCELLED'
          and generation_approved_by is null
          and generation_approved_at is null
          and cancelled_by is not null
          and cancelled_at is not null
        )
      )
    )
    or (
      request_mode = 'ADMIN_DIRECT'
      and status in (
        'GENERATION_APPROVED', 'GENERATION_QUEUED', 'GENERATING', 'GENERATED',
        'QUALITY_CHECKED', 'PRINT_FILE_READY', 'SENT_TO_PRINTER', 'PRINTED',
        'SHIPPED', 'DELIVERED', 'DISTRIBUTING', 'COMPLETED', 'FAILED',
        'PARTIALLY_COMPLETED'
      )
      and sample_approved_by is null
      and sample_approved_at is null
      and generation_approved_by is not null
      and generation_approved_at is not null
      and cancelled_by is null
      and cancelled_at is null
    )
    or (
      request_mode = 'QR_ONLY'
      and status in ('SAMPLE_APPROVED', 'FINAL_APPROVAL_PENDING')
      and sample_approved_by is not null
      and sample_approved_at is not null
      and generation_approved_by is null
      and generation_approved_at is null
      and cancelled_by is null
      and cancelled_at is null
    )
    or (
      request_mode = 'QR_ONLY'
      and status in (
        'GENERATION_APPROVED', 'GENERATION_QUEUED', 'GENERATING', 'GENERATED',
        'QUALITY_CHECKED', 'PRINT_FILE_READY', 'SENT_TO_PRINTER', 'PRINTED',
        'SHIPPED', 'DELIVERED', 'DISTRIBUTING', 'COMPLETED', 'FAILED',
        'PARTIALLY_COMPLETED'
      )
      and sample_approved_by is not null
      and sample_approved_at is not null
      and generation_approved_by is not null
      and generation_approved_at is not null
      and requested_by <> generation_approved_by
      and cancelled_by is null
      and cancelled_at is null
    )
  );

create or replace function public.request_admin_qr_only_generation(
  p_site_id uuid,
  p_expected_site_version integer,
  p_total_quantity integer,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target_site public.sites%rowtype;
  target_company public.management_companies%rowtype;
  target_tenant public.tenants%rowtype;
  target_design public.sticker_design_versions%rowtype;
  request_row public.qr_direct_generation_requests%rowtype;
  created_batch public.qr_batches%rowtype;
  remaining integer := p_total_quantity;
  next_quantity integer;
  created_batches jsonb := '[]'::jsonb;
  approval_request_id uuid;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_site_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_site_version is null or p_expected_site_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_total_quantity is null or p_total_quantity not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'INVALID_QUANTITY';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select request.* into request_row
  from public.qr_direct_generation_requests as request
  where request.idempotency_key = p_idempotency_key;
  if found then
    if request_row.site_id <> p_site_id
      or request_row.requested_quantity <> p_total_quantity
      or request_row.requested_by <> actor_user_id
    then
      raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return request_row.result;
  end if;

  select site.* into target_site
  from public.sites as site
  where site.id = p_site_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SITE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if target_site.version <> p_expected_site_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  select company.* into target_company
  from public.management_companies as company
  where company.id = target_site.management_company_id
    and company.tenant_id = target_site.tenant_id;
  select tenant.* into target_tenant
  from public.tenants as tenant
  where tenant.id = target_site.tenant_id;

  perform app_private.assert_qr_inventory_actor(
    target_site.tenant_id,
    target_site.management_company_id,
    target_site.id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );
  if target_tenant.status <> 'ACTIVE' or target_tenant.deleted_at is not null
    or target_company.status <> 'ACTIVE' or target_company.deleted_at is not null
    or target_site.status <> 'ACTIVE' or target_site.deleted_at is not null
  then
    raise exception using errcode = 'P0001', message = 'PARENT_NOT_ACTIVE';
  end if;

  select design.* into target_design
  from public.sticker_design_versions as design
  where design.tenant_id = target_site.tenant_id
    and design.management_company_id = target_site.management_company_id
    and design.site_id = target_site.id
    and design.status = 'APPROVED'
    and design.design_config ->> 'mode' = 'QR_ONLY'
  order by design.created_at desc, design.id
  limit 1;

  if target_design.id is null then
    insert into public.sticker_design_versions (
      tenant_id, management_company_id, site_id, template_code,
      design_config, status, created_by, approved_by, approved_at
    ) values (
      target_site.tenant_id,
      target_site.management_company_id,
      target_site.id,
      'ROUND_WHITE_MINIMAL_V1',
      jsonb_build_object(
        'mode', 'QR_ONLY',
        'schemaVersion', 1,
        'qrOptions', jsonb_build_object('errorCorrectionLevel', 'H', 'marginModules', 4)
      ),
      'APPROVED', actor_user_id, actor_user_id, now()
    ) returning * into target_design;
  end if;

  insert into public.qr_direct_generation_requests (
    tenant_id, management_company_id, site_id, idempotency_key,
    requested_quantity, requested_by, result
  ) values (
    target_site.tenant_id, target_site.management_company_id, target_site.id,
    p_idempotency_key, p_total_quantity, actor_user_id,
    jsonb_build_object('requestId', null, 'siteId', target_site.id,
      'totalQuantity', p_total_quantity, 'batches', '[]'::jsonb)
  ) returning * into request_row;

  while remaining > 0 loop
    next_quantity := least(remaining, 100);
    insert into public.qr_batches (
      tenant_id, management_company_id, site_id, sticker_design_version_id,
      direct_generation_request_id, requested_quantity, purpose, status,
      requested_by, sample_approved_by, sample_approved_at,
      idempotency_key, request_mode
    ) values (
      target_site.tenant_id, target_site.management_company_id, target_site.id,
      target_design.id, request_row.id, next_quantity, 'QR_ONLY_GENERATION',
      'SAMPLE_APPROVED', actor_user_id, actor_user_id, now(), gen_random_uuid(), 'QR_ONLY'
    ) returning * into created_batch;

    -- This is an automated QR-only quality evidence row, not a user-selectable
    -- design or sample approval step. The final generation approval remains
    -- independent and is performed by the existing approval RPC below.
    insert into public.qr_batch_samples (
      tenant_id, management_company_id, site_id, batch_id, status,
      storage_bucket, storage_path, checksum_sha256, mime_type, byte_size,
      decode_passed, quiet_zone_passed, contrast_passed,
      attached_by, approved_by, approved_at
    ) values (
      created_batch.tenant_id, created_batch.management_company_id,
      created_batch.site_id, created_batch.id, 'APPROVED', 'qr-generated',
      'internal/qr-only/' || created_batch.id::text || '.svg', repeat('0', 64),
      'image/svg+xml', 1, true, true, true, actor_user_id, actor_user_id, now()
    );

    approval_request_id := gen_random_uuid();
    perform public.request_qr_batch_final_approval(
      created_batch.id, created_batch.version, trim(p_reason), approval_request_id
    );
    select batch.* into created_batch
    from public.qr_batches as batch
    where batch.id = created_batch.id;

    created_batches := created_batches || jsonb_build_array(jsonb_build_object(
      'batchId', created_batch.id,
      'batchCode', created_batch.batch_code,
      'batchStatus', created_batch.status::text,
      'batchVersion', created_batch.version,
      'generationRevision', null,
      'jobId', null,
      'jobStatus', null,
      'requestedQuantity', created_batch.requested_quantity
    ));
    insert into public.audit_logs (
      tenant_id, site_id, actor_type, actor_id, action, resource_type,
      resource_id, after_data, reason, request_id
    ) values (
      created_batch.tenant_id, created_batch.site_id, 'ADMIN', actor_user_id,
      'QR_ONLY_GENERATION_REQUESTED', 'QR_BATCH', created_batch.id,
      jsonb_build_object('requestMode', 'QR_ONLY', 'batchStatus', created_batch.status::text,
        'requestedQuantity', created_batch.requested_quantity),
      trim(p_reason), p_idempotency_key
    );
    remaining := remaining - next_quantity;
  end loop;

  update public.qr_direct_generation_requests
  set result = jsonb_build_object(
    'requestId', request_row.id, 'siteId', target_site.id,
    'totalQuantity', p_total_quantity, 'batches', created_batches
  )
  where id = request_row.id;
  return jsonb_build_object(
    'requestId', request_row.id, 'siteId', target_site.id,
    'totalQuantity', p_total_quantity, 'batches', created_batches
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
end;
$$;

revoke all on function public.request_admin_qr_only_generation(uuid, integer, integer, text, uuid)
from public, anon, authenticated;
grant execute on function public.request_admin_qr_only_generation(uuid, integer, integer, text, uuid)
to authenticated;

commit;
