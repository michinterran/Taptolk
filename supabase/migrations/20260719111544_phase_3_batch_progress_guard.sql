begin;

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

  if old.status = 'GENERATING' and new.status = 'GENERATING' then
    if new.sample_approved_by is distinct from old.sample_approved_by
      or new.sample_approved_at is distinct from old.sample_approved_at
      or new.generation_approved_by is distinct from old.generation_approved_by
      or new.generation_approved_at is distinct from old.generation_approved_at
      or new.cancelled_by is distinct from old.cancelled_by
      or new.cancelled_at is distinct from old.cancelled_at
    then
      raise exception using errcode = '23514', message = 'BATCH_PROGRESS_METADATA_IMMUTABLE';
    end if;
    if new.generated_quantity < old.generated_quantity
      or new.rendered_quantity < old.rendered_quantity
      or new.passed_quantity < old.passed_quantity
      or new.failed_quantity < old.failed_quantity
    then
      raise exception using errcode = '23514', message = 'BATCH_PROGRESS_REGRESSION';
    end if;
    return new;
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

commit;
