begin;

alter table public.qr_batches
  add column direct_generation_request_id uuid;

alter table public.qr_batches
  add constraint fk_qr_batches_direct_generation_request
  foreign key (direct_generation_request_id)
  references public.qr_direct_generation_requests (id)
  on delete restrict;

create index idx_qr_batches_direct_generation_request
on public.qr_batches (direct_generation_request_id, created_at desc);

create or replace function public.request_admin_direct_qr_generation(
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
  created_job public.qr_generation_jobs%rowtype;
  remaining integer := p_total_quantity;
  next_quantity integer;
  created_batches jsonb := '[]'::jsonb;
  request_result jsonb;
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

  select request.*
  into request_row
  from public.qr_direct_generation_requests as request
  where request.idempotency_key = p_idempotency_key;

  if found then
    if request_row.site_id <> p_site_id
      or request_row.requested_quantity <> p_total_quantity
      or request_row.requested_by <> actor_user_id
    then
      raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return request_row.result || jsonb_build_object('requestId', request_row.id);
  end if;

  select site.*
  into target_site
  from public.sites as site
  where site.id = p_site_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SITE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if target_site.version <> p_expected_site_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  select *
  into target_company
  from public.management_companies
  where id = target_site.management_company_id
    and tenant_id = target_site.tenant_id;

  select *
  into target_tenant
  from public.tenants
  where id = target_site.tenant_id;

  perform app_private.assert_qr_inventory_actor(
    target_site.tenant_id,
    target_site.management_company_id,
    target_site.id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR']
  );

  if target_tenant.status <> 'ACTIVE'
    or target_tenant.deleted_at is not null
    or target_company.status <> 'ACTIVE'
    or target_company.deleted_at is not null
    or target_site.status <> 'ACTIVE'
    or target_site.deleted_at is not null
  then
    raise exception using errcode = 'P0001', message = 'PARENT_NOT_ACTIVE';
  end if;

  select design.*
  into target_design
  from public.sticker_design_versions as design
  where design.tenant_id = target_site.tenant_id
    and design.management_company_id = target_site.management_company_id
    and design.site_id = target_site.id
    and design.status = 'APPROVED'
  order by
    case when design.design_config ->> 'mode' = 'QR_ONLY' then 0 else 1 end,
    design.created_at desc,
    design.id
  limit 1;

  if target_design.id is null then
    insert into public.sticker_design_versions (
      tenant_id,
      management_company_id,
      site_id,
      template_code,
      design_config,
      status,
      created_by,
      approved_by,
      approved_at
    )
    values (
      target_site.tenant_id,
      target_site.management_company_id,
      target_site.id,
      'ROUND_WHITE_MINIMAL_V1',
      jsonb_build_object(
        'mode', 'QR_ONLY',
        'schemaVersion', 1,
        'qrOptions', jsonb_build_object('errorCorrectionLevel', 'H', 'marginModules', 4)
      ),
      'APPROVED',
      actor_user_id,
      actor_user_id,
      now()
    )
    returning * into target_design;
  end if;

  insert into public.qr_direct_generation_requests (
    tenant_id,
    management_company_id,
    site_id,
    idempotency_key,
    requested_quantity,
    requested_by,
    result
  )
  values (
    target_site.tenant_id,
    target_site.management_company_id,
    target_site.id,
    p_idempotency_key,
    p_total_quantity,
    actor_user_id,
    jsonb_build_object(
      'requestId', null,
      'siteId', target_site.id,
      'totalQuantity', p_total_quantity,
      'batches', '[]'::jsonb
    )
  )
  returning * into request_row;

  while remaining > 0 loop
    next_quantity := least(remaining, 100);

    insert into public.qr_batches (
      tenant_id,
      management_company_id,
      site_id,
      sticker_design_version_id,
      direct_generation_request_id,
      requested_quantity,
      purpose,
      status,
      requested_by,
      generation_approved_by,
      generation_approved_at,
      idempotency_key,
      request_mode
    )
    values (
      target_site.tenant_id,
      target_site.management_company_id,
      target_site.id,
      target_design.id,
      request_row.id,
      next_quantity,
      'ADMIN_DIRECT_QR',
      'GENERATION_APPROVED',
      actor_user_id,
      actor_user_id,
      now(),
      gen_random_uuid(),
      'ADMIN_DIRECT'
    )
    returning * into created_batch;

    insert into public.qr_generation_jobs (
      tenant_id,
      management_company_id,
      site_id,
      qr_batch_id,
      approval_request_id
    )
    values (
      created_batch.tenant_id,
      created_batch.management_company_id,
      created_batch.site_id,
      created_batch.id,
      gen_random_uuid()
    )
    returning * into created_job;

    created_batches := created_batches || jsonb_build_array(
      jsonb_build_object(
        'batchId', created_batch.id,
        'batchCode', created_batch.batch_code,
        'batchStatus', created_batch.status::text,
        'batchVersion', created_batch.version,
        'generationRevision', created_job.generation_revision,
        'jobId', created_job.id,
        'jobStatus', created_job.status::text,
        'requestedQuantity', created_batch.requested_quantity
      )
    );

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
      created_batch.tenant_id,
      created_batch.site_id,
      'ADMIN',
      actor_user_id,
      'QR_ADMIN_DIRECT_GENERATION_REQUESTED',
      'QR_BATCH',
      created_batch.id,
      null,
      jsonb_build_object(
        'requestMode', created_batch.request_mode,
        'directGenerationRequestId', request_row.id,
        'batchStatus', created_batch.status::text,
        'requestedQuantity', created_batch.requested_quantity,
        'jobStatus', created_job.status::text
      ),
      trim(p_reason),
      p_idempotency_key
    );

    remaining := remaining - next_quantity;
  end loop;

  request_result := jsonb_build_object(
    'requestId', request_row.id,
    'siteId', target_site.id,
    'totalQuantity', p_total_quantity,
    'batches', created_batches
  );

  update public.qr_direct_generation_requests
  set result = request_result
  where id = request_row.id;

  return request_result;
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
end;
$$;

revoke all on function public.request_admin_direct_qr_generation(
  uuid,
  integer,
  integer,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.request_admin_direct_qr_generation(
  uuid,
  integer,
  integer,
  text,
  uuid
) to authenticated;

create or replace function public.list_qr_batch_progress_read_model()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  result jsonb;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(item) order by item.created_at desc, item.id),
    '[]'::jsonb
  )
  into result
  from (
    select
      batch.id,
      batch.tenant_id,
      batch.management_company_id,
      batch.site_id,
      batch.direct_generation_request_id,
      site.name as site_name,
      batch.batch_code,
      batch.requested_quantity,
      batch.generated_quantity,
      batch.rendered_quantity,
      batch.passed_quantity,
      batch.failed_quantity,
      batch.status,
      batch.version,
      batch.created_at,
      latest_job.status as job_status,
      latest_job.processed_count,
      latest_job.passed_count as job_passed_count,
      latest_job.failed_count as job_failed_count,
      latest_job.execution_attempt_count,
      coalesce(exports.export_types, '[]'::jsonb) as export_types
    from public.qr_batches as batch
    join public.sites as site
      on site.tenant_id = batch.tenant_id
      and site.management_company_id = batch.management_company_id
      and site.id = batch.site_id
    left join lateral (
      select
        job.status,
        job.processed_count,
        job.passed_count,
        job.failed_count,
        job.execution_attempt_count
      from public.qr_generation_jobs as job
      where job.qr_batch_id = batch.id
      order by job.generation_revision desc
      limit 1
    ) as latest_job on true
    left join lateral (
      select jsonb_agg(export.export_type order by export.export_type) as export_types
      from public.print_exports as export
      where export.qr_batch_id = batch.id
        and export.status = 'READY'
    ) as exports on true
    where batch.status in (
      'GENERATION_APPROVED',
      'GENERATION_QUEUED',
      'GENERATING',
      'GENERATED',
      'QUALITY_CHECKED',
      'PRINT_FILE_READY',
      'SENT_TO_PRINTER',
      'PRINTED',
      'SHIPPED',
      'DELIVERED',
      'DISTRIBUTING',
      'COMPLETED',
      'FAILED',
      'PARTIALLY_COMPLETED'
    )
      and app_private.current_admin_has_scope(
        batch.tenant_id,
        batch.management_company_id,
        batch.site_id,
        array[
          'SUPER_ADMIN',
          'PLATFORM_OPERATOR',
          'MANAGEMENT_ADMIN',
          'SITE_ADMIN',
          'SITE_OPERATOR',
          'READ_ONLY'
        ]
      )
    order by batch.created_at desc
    limit 100
  ) as item;

  return result;
end;
$$;

revoke all on function public.list_qr_batch_progress_read_model()
from public, anon;
grant execute on function public.list_qr_batch_progress_read_model()
to authenticated;

commit;
