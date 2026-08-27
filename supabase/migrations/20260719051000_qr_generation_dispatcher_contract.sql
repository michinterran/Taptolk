begin;

create or replace function app_private.guard_qr_generation_job_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status in ('COMPLETED', 'FAILED', 'ABORTED', 'PARTIALLY_COMPLETED') then
    raise exception using errcode = '23514', message = 'GENERATION_JOB_TERMINAL';
  end if;
  if new.id <> old.id
    or new.tenant_id <> old.tenant_id
    or new.management_company_id <> old.management_company_id
    or new.site_id <> old.site_id
    or new.qr_batch_id <> old.qr_batch_id
    or new.job_type <> old.job_type
    or new.generation_revision <> old.generation_revision
    or new.approval_request_id <> old.approval_request_id
    or new.max_execution_attempts <> old.max_execution_attempts
    or new.created_at <> old.created_at
  then
    raise exception using errcode = '23514', message = 'GENERATION_JOB_IDENTITY_IMMUTABLE';
  end if;
  if not (
    (old.status = 'PENDING_DELIVERY' and new.status in ('DELIVERY_LEASED', 'RETRY_WAIT', 'ABORTED'))
    or (
      old.status = 'DELIVERY_LEASED'
      and new.status in ('PENDING_DELIVERY', 'QUEUED', 'RETRY_WAIT', 'ABORTED')
    )
    or (
      old.status = 'DELIVERY_LEASED'
      and new.status = 'DELIVERY_LEASED'
      and old.lease_expires_at <= statement_timestamp()
      and new.lease_expires_at > statement_timestamp()
      and new.delivery_attempt_count = old.delivery_attempt_count + 1
      and new.execution_attempt_count = old.execution_attempt_count
      and new.queue_message_id is null
    )
    or (old.status = 'QUEUED' and new.status in ('PROCESSING', 'ABORTED'))
    or (
      old.status = 'PROCESSING'
      and new.status in ('RETRY_WAIT', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED', 'ABORTED')
    )
    or (old.status = 'RETRY_WAIT' and new.status in ('DELIVERY_LEASED', 'PROCESSING', 'ABORTED'))
  ) then
    raise exception using errcode = '23514', message = 'INVALID_GENERATION_JOB_TRANSITION';
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_qr_generation_job_update()
from public, anon, authenticated;

create or replace function public.claim_pending_qr_generation_jobs(
  p_limit integer,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_jobs jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVER_ROLE_REQUIRED';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'INVALID_LIMIT';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 5 and 300 then
    raise exception using errcode = '22023', message = 'INVALID_LEASE_SECONDS';
  end if;

  with candidates as (
    select job.id
    from public.qr_generation_jobs as job
    where (
      job.status in ('PENDING_DELIVERY', 'RETRY_WAIT')
      and job.available_at <= statement_timestamp()
    )
    or (
      job.status = 'DELIVERY_LEASED'
      and job.lease_expires_at <= statement_timestamp()
    )
    order by job.available_at, job.created_at, job.id
    for update skip locked
    limit p_limit
  ),
  updated as (
    update public.qr_generation_jobs as job
    set
      status = 'DELIVERY_LEASED',
      delivery_attempt_count = job.delivery_attempt_count + 1,
      lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds),
      queue_message_id = null
    from candidates
    where job.id = candidates.id
    returning job.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'batchId', updated.qr_batch_id,
        'createdAt', updated.created_at,
        'deliveryAttemptCount', updated.delivery_attempt_count,
        'generationRevision', updated.generation_revision,
        'jobId', updated.id,
        'jobStatus', updated.status::text,
        'jobType', updated.job_type,
        'jobVersion', updated.version,
        'leaseExpiresAt', updated.lease_expires_at,
        'siteId', updated.site_id,
        'tenantId', updated.tenant_id
      )
      order by updated.created_at, updated.id
    ),
    '[]'::jsonb
  )
  into claimed_jobs
  from updated;

  return jsonb_build_object('jobs', claimed_jobs);
end;
$$;

create or replace function public.record_qr_generation_job_published(
  p_job_id uuid,
  p_expected_version integer,
  p_queue_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_job public.qr_generation_jobs%rowtype;
  updated_job public.qr_generation_jobs%rowtype;
  before_batch public.qr_batches%rowtype;
  updated_batch public.qr_batches%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVER_ROLE_REQUIRED';
  end if;
  if p_job_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_queue_message_id is null
    or trim(p_queue_message_id) !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_QUEUE_MESSAGE_ID';
  end if;

  select job.*
  into before_job
  from public.qr_generation_jobs as job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'GENERATION_JOB_NOT_FOUND';
  end if;
  if before_job.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_job.status <> 'DELIVERY_LEASED'
    or before_job.lease_expires_at <= statement_timestamp()
  then
    raise exception using errcode = '40001', message = 'DELIVERY_LEASE_REQUIRED';
  end if;

  select batch.*
  into before_batch
  from public.qr_batches as batch
  where batch.id = before_job.qr_batch_id
    and batch.tenant_id = before_job.tenant_id
    and batch.management_company_id = before_job.management_company_id
    and batch.site_id = before_job.site_id
  for update;

  if not found or before_batch.status <> 'GENERATION_APPROVED' then
    raise exception using errcode = '40001', message = 'BATCH_NOT_GENERATION_APPROVED';
  end if;

  update public.qr_generation_jobs
  set
    status = 'QUEUED',
    queue_message_id = trim(p_queue_message_id),
    lease_expires_at = null,
    last_error_code = null,
    queued_at = statement_timestamp()
  where id = before_job.id
  returning * into updated_job;

  update public.qr_batches
  set status = 'GENERATION_QUEUED'
  where id = before_batch.id
  returning * into updated_batch;

  return jsonb_build_object(
    'batchId', updated_batch.id,
    'batchStatus', updated_batch.status::text,
    'batchVersion', updated_batch.version,
    'deliveryAttemptCount', updated_job.delivery_attempt_count,
    'jobId', updated_job.id,
    'jobStatus', updated_job.status::text,
    'jobVersion', updated_job.version
  );
end;
$$;

create or replace function public.record_qr_generation_delivery_failure(
  p_job_id uuid,
  p_expected_version integer,
  p_error_code text,
  p_available_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_job public.qr_generation_jobs%rowtype;
  updated_job public.qr_generation_jobs%rowtype;
  current_batch public.qr_batches%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'SERVER_ROLE_REQUIRED';
  end if;
  if p_job_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_error_code is null or trim(p_error_code) !~ '^[A-Z0-9][A-Z0-9_]{1,63}$' then
    raise exception using errcode = '22023', message = 'INVALID_ERROR_CODE';
  end if;
  if p_available_at is null
    or p_available_at <= statement_timestamp()
    or p_available_at > statement_timestamp() + interval '24 hours'
  then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABLE_AT';
  end if;

  select job.*
  into before_job
  from public.qr_generation_jobs as job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'GENERATION_JOB_NOT_FOUND';
  end if;
  if before_job.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_job.status <> 'DELIVERY_LEASED'
    or before_job.lease_expires_at <= statement_timestamp()
  then
    raise exception using errcode = '40001', message = 'DELIVERY_LEASE_REQUIRED';
  end if;

  select batch.*
  into current_batch
  from public.qr_batches as batch
  where batch.id = before_job.qr_batch_id
    and batch.tenant_id = before_job.tenant_id
    and batch.management_company_id = before_job.management_company_id
    and batch.site_id = before_job.site_id
  for update;

  if not found or current_batch.status <> 'GENERATION_APPROVED' then
    raise exception using errcode = '40001', message = 'BATCH_NOT_GENERATION_APPROVED';
  end if;

  update public.qr_generation_jobs
  set
    status = 'RETRY_WAIT',
    available_at = p_available_at,
    lease_expires_at = null,
    queue_message_id = null,
    last_error_code = trim(p_error_code)
  where id = before_job.id
  returning * into updated_job;

  return jsonb_build_object(
    'batchId', current_batch.id,
    'batchStatus', current_batch.status::text,
    'batchVersion', current_batch.version,
    'deliveryAttemptCount', updated_job.delivery_attempt_count,
    'jobId', updated_job.id,
    'jobStatus', updated_job.status::text,
    'jobVersion', updated_job.version
  );
end;
$$;

revoke all on function public.claim_pending_qr_generation_jobs(integer, integer)
from public, anon, authenticated;
revoke all on function public.record_qr_generation_job_published(uuid, integer, text)
from public, anon, authenticated;
revoke all on function public.record_qr_generation_delivery_failure(
  uuid,
  integer,
  text,
  timestamptz
)
from public, anon, authenticated;

grant execute on function public.claim_pending_qr_generation_jobs(integer, integer)
to service_role;
grant execute on function public.record_qr_generation_job_published(uuid, integer, text)
to service_role;
grant execute on function public.record_qr_generation_delivery_failure(
  uuid,
  integer,
  text,
  timestamptz
)
to service_role;

comment on function public.claim_pending_qr_generation_jobs(integer, integer)
is 'Claims a bounded set of ready QR generation delivery intents for a server-only dispatcher.';
comment on function public.record_qr_generation_job_published(uuid, integer, text)
is 'Atomically records queue publication and advances the owning QR Batch.';
comment on function public.record_qr_generation_delivery_failure(uuid, integer, text, timestamptz)
is 'Records a redacted delivery failure and bounded retry time without exposing provider payloads.';

commit;
