begin;

create or replace function public.record_qr_generation_execution_failure(
  p_job_id uuid,
  p_generation_revision integer,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.qr_generation_jobs%rowtype;
  target_batch public.qr_batches%rowtype;
  next_job_status public.qr_generation_job_status;
  next_batch_status public.qr_batch_status;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_job_id is null
    or p_generation_revision is null
    or p_generation_revision < 1
    or p_error_code not in (
      'GENERATION_UNAVAILABLE',
      'ARTIFACT_STORAGE_UNAVAILABLE',
      'PRINT_EXPORT_UNAVAILABLE',
      'GENERATION_CONTEXT_INVALID'
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_GENERATION_FAILURE';
  end if;

  select *
  into target_job
  from public.qr_generation_jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception using errcode = 'P0002', message = 'GENERATION_JOB_NOT_FOUND';
  end if;
  if target_job.generation_revision <> p_generation_revision then
    raise exception using errcode = '23514', message = 'GENERATION_REVISION_MISMATCH';
  end if;
  if target_job.status in ('COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED', 'ABORTED') then
    return jsonb_build_object(
      'job_status', target_job.status,
      'terminal', true
    );
  end if;
  if target_job.status <> 'PROCESSING' then
    raise exception using errcode = '23514', message = 'GENERATION_JOB_NOT_PROCESSING';
  end if;

  select *
  into target_batch
  from public.qr_batches
  where id = target_job.qr_batch_id
  for update;

  if target_job.execution_attempt_count >= target_job.max_execution_attempts then
    next_job_status := case
      when target_job.processed_count > 0 then 'PARTIALLY_COMPLETED'
      else 'FAILED'
    end;
    next_batch_status := case
      when target_job.processed_count > 0 then 'PARTIALLY_COMPLETED'
      else 'FAILED'
    end;
  else
    next_job_status := 'RETRY_WAIT';
    next_batch_status := null;
  end if;

  update public.qr_generation_jobs
  set
    status = next_job_status,
    available_at = case
      when next_job_status = 'RETRY_WAIT' then now()
      else available_at
    end,
    failed_at = case
      when next_job_status in ('FAILED', 'PARTIALLY_COMPLETED') then now()
      else null
    end,
    last_error_code = p_error_code
  where id = target_job.id;

  if next_batch_status is not null then
    update public.qr_batches
    set status = next_batch_status
    where id = target_batch.id;
  end if;

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
    target_job.tenant_id,
    target_job.site_id,
    'WORKER',
    null,
    'QR_GENERATION_EXECUTION_FAILED',
    'QR_GENERATION_JOB',
    target_job.id,
    jsonb_build_object('status', target_job.status),
    jsonb_build_object('status', next_job_status, 'errorCode', p_error_code),
    p_error_code,
    gen_random_uuid()
  );

  return jsonb_build_object(
    'job_status', next_job_status,
    'terminal', next_job_status in ('FAILED', 'PARTIALLY_COMPLETED')
  );
end;
$$;

create or replace function public.record_qr_print_export_failure(
  p_batch_id uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_batch public.qr_batches%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_batch_id is null or p_error_code <> 'PRINT_EXPORT_UNAVAILABLE' then
    raise exception using errcode = '22023', message = 'INVALID_PRINT_EXPORT_FAILURE';
  end if;

  select *
  into target_batch
  from public.qr_batches
  where id = p_batch_id
  for update;

  if target_batch.id is null then
    raise exception using errcode = 'P0002', message = 'BATCH_NOT_FOUND';
  end if;
  if target_batch.status = 'FAILED' then
    return jsonb_build_object('status', target_batch.status);
  end if;
  if target_batch.status <> 'QUALITY_CHECKED' then
    raise exception using errcode = '23514', message = 'BATCH_NOT_EXPORTABLE';
  end if;

  update public.qr_batches
  set status = 'FAILED'
  where id = target_batch.id;

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
    target_batch.tenant_id,
    target_batch.site_id,
    'WORKER',
    null,
    'QR_PRINT_EXPORT_FAILED',
    'QR_BATCH',
    target_batch.id,
    jsonb_build_object('status', target_batch.status),
    jsonb_build_object('status', 'FAILED', 'errorCode', p_error_code),
    p_error_code,
    gen_random_uuid()
  );

  return jsonb_build_object('status', 'FAILED');
end;
$$;

revoke all on function public.record_qr_generation_execution_failure(uuid, integer, text)
from public, anon, authenticated;
grant execute on function public.record_qr_generation_execution_failure(uuid, integer, text)
to service_role;

revoke all on function public.record_qr_print_export_failure(uuid, text)
from public, anon, authenticated;
grant execute on function public.record_qr_print_export_failure(uuid, text)
to service_role;

comment on function public.record_qr_generation_execution_failure(uuid, integer, text) is
  'Records an allowlisted worker failure, preserves completed ordinals, and bounds execution retries.';

comment on function public.record_qr_print_export_failure(uuid, text) is
  'Records a bounded print-export failure after Queue delivery retries are exhausted.';

commit;
