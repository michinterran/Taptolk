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
  if old.status = 'PROCESSING' and new.status = 'PROCESSING' then
    if new.delivery_attempt_count <> old.delivery_attempt_count
      or new.execution_attempt_count <> old.execution_attempt_count
      or new.available_at <> old.available_at
      or new.lease_expires_at is distinct from old.lease_expires_at
      or new.queue_message_id is distinct from old.queue_message_id
      or new.last_error_code is distinct from old.last_error_code
      or new.queued_at is distinct from old.queued_at
      or new.started_at is distinct from old.started_at
      or new.completed_at is distinct from old.completed_at
      or new.failed_at is distinct from old.failed_at
      or new.aborted_at is distinct from old.aborted_at
    then
      raise exception using errcode = '23514', message = 'GENERATION_PROGRESS_METADATA_IMMUTABLE';
    end if;
    return new;
  end if;
  if not (
    (old.status = 'PENDING_DELIVERY' and new.status in ('DELIVERY_LEASED', 'RETRY_WAIT', 'ABORTED'))
    or (
      old.status = 'DELIVERY_LEASED'
      and new.status in ('PENDING_DELIVERY', 'QUEUED', 'RETRY_WAIT', 'ABORTED')
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

commit;
