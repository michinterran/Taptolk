begin;

create type public.qr_generation_job_status as enum (
  'PENDING_DELIVERY',
  'DELIVERY_LEASED',
  'QUEUED',
  'PROCESSING',
  'RETRY_WAIT',
  'COMPLETED',
  'FAILED',
  'ABORTED',
  'PARTIALLY_COMPLETED'
);

create table public.qr_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid not null,
  qr_batch_id uuid not null,
  job_type text not null default 'QR_GENERATION',
  generation_revision integer not null default 1,
  approval_request_id uuid not null,
  status public.qr_generation_job_status not null default 'PENDING_DELIVERY',
  delivery_attempt_count integer not null default 0,
  execution_attempt_count integer not null default 0,
  max_execution_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  queue_message_id text,
  processed_count integer not null default 0,
  passed_count integer not null default 0,
  failed_count integer not null default 0,
  last_error_code text,
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  aborted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_qr_generation_jobs_batch
    foreign key (tenant_id, management_company_id, site_id, qr_batch_id)
    references public.qr_batches (tenant_id, management_company_id, site_id, id)
    on delete restrict,
  constraint uq_qr_generation_jobs_tenant_id
    unique (tenant_id, id),
  constraint uq_qr_generation_jobs_approval_request
    unique (tenant_id, approval_request_id),
  constraint uq_qr_generation_jobs_revision
    unique (tenant_id, qr_batch_id, generation_revision, job_type),
  constraint chk_qr_generation_jobs_job_type
    check (job_type = 'QR_GENERATION'),
  constraint chk_qr_generation_jobs_revision
    check (generation_revision >= 1),
  constraint chk_qr_generation_jobs_attempts check (
    delivery_attempt_count >= 0
    and execution_attempt_count >= 0
    and max_execution_attempts = 5
    and execution_attempt_count <= max_execution_attempts
  ),
  constraint chk_qr_generation_jobs_counts check (
    processed_count >= 0
    and passed_count >= 0
    and failed_count >= 0
    and passed_count + failed_count <= processed_count
  ),
  constraint chk_qr_generation_jobs_error_code check (
    last_error_code is null
    or last_error_code ~ '^[A-Z0-9][A-Z0-9_]{1,63}$'
  ),
  constraint chk_qr_generation_jobs_state_metadata check (
    (
      status = 'PENDING_DELIVERY'
      and queue_message_id is null
      and queued_at is null
      and started_at is null
      and completed_at is null
      and failed_at is null
      and aborted_at is null
    )
    or (
      status = 'DELIVERY_LEASED'
      and queue_message_id is null
      and lease_expires_at is not null
      and completed_at is null
      and failed_at is null
      and aborted_at is null
    )
    or (
      status in ('QUEUED', 'PROCESSING', 'RETRY_WAIT')
      and completed_at is null
      and failed_at is null
      and aborted_at is null
    )
    or (
      status = 'COMPLETED'
      and completed_at is not null
      and failed_at is null
      and aborted_at is null
    )
    or (
      status in ('FAILED', 'PARTIALLY_COMPLETED')
      and failed_at is not null
      and completed_at is null
      and aborted_at is null
    )
    or (
      status = 'ABORTED'
      and aborted_at is not null
      and completed_at is null
      and failed_at is null
    )
  )
);

create index idx_qr_generation_jobs_tenant_status_available
on public.qr_generation_jobs (tenant_id, status, available_at, created_at);

create index idx_qr_generation_jobs_batch_revision
on public.qr_generation_jobs (qr_batch_id, generation_revision desc);

create unique index uq_audit_logs_qr_final_command_request
on public.audit_logs (tenant_id, request_id, action)
where action in (
  'QR_BATCH_FINAL_APPROVAL_REQUESTED',
  'QR_BATCH_GENERATION_APPROVED',
  'QR_BATCH_CANCELLED_BEFORE_GENERATION'
);

create trigger trg_qr_generation_jobs_touch
before update on public.qr_generation_jobs
for each row execute function app_private.touch_versioned_row();

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
    (old.status = 'DRAFT' and new.status in ('SAMPLE_READY', 'CANCELLED'))
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
  ) then
    raise exception using errcode = '23514', message = 'INVALID_BATCH_TRANSITION';
  end if;
  return new;
end;
$$;

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

create trigger trg_qr_generation_jobs_guard
before update on public.qr_generation_jobs
for each row execute function app_private.guard_qr_generation_job_update();

alter table public.qr_generation_jobs enable row level security;
alter table public.qr_generation_jobs force row level security;

revoke all on table public.qr_generation_jobs from public, anon, authenticated;
grant select, delete on table public.qr_generation_jobs to service_role;

create policy qr_generation_jobs_select_scoped
on public.qr_generation_jobs
for select
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR']
  )
);

revoke all on function app_private.guard_qr_generation_job_update()
from public, anon, authenticated;

create or replace function public.get_qr_final_generation_approval_batch(
  p_batch_id uuid
)
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
  if p_batch_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;

  select to_jsonb(target)
  into result
  from (
    select
      batch.id,
      batch.tenant_id,
      tenant.status as tenant_status,
      batch.management_company_id,
      company.status as management_company_status,
      batch.site_id,
      site.name as site_name,
      site.status as site_status,
      batch.batch_code,
      batch.requested_quantity,
      batch.status,
      batch.requested_by = actor_user_id as requested_by_current_actor,
      design.status as sticker_design_status,
      active_sample.status as sample_status,
      exists (
        select 1
        from public.qr_generation_jobs as job
        where job.tenant_id = batch.tenant_id
          and job.qr_batch_id = batch.id
      ) as has_generation_job,
      batch.version,
      batch.created_at
    from public.qr_batches as batch
    join public.tenants as tenant on tenant.id = batch.tenant_id
    join public.management_companies as company
      on company.id = batch.management_company_id
      and company.tenant_id = batch.tenant_id
    join public.sites as site
      on site.id = batch.site_id
      and site.tenant_id = batch.tenant_id
      and site.management_company_id = batch.management_company_id
    join public.sticker_design_versions as design
      on design.id = batch.sticker_design_version_id
      and design.tenant_id = batch.tenant_id
      and design.management_company_id = batch.management_company_id
      and design.site_id = batch.site_id
    left join lateral (
      select sample.status
      from public.qr_batch_samples as sample
      where sample.tenant_id = batch.tenant_id
        and sample.management_company_id = batch.management_company_id
        and sample.site_id = batch.site_id
        and sample.batch_id = batch.id
        and sample.status <> 'INVALIDATED'
      order by sample.created_at desc, sample.id
      limit 1
    ) as active_sample on true
    where batch.id = p_batch_id
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
  ) as target;

  return result;
end;
$$;

create or replace function public.list_qr_final_generation_approval_read_model()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  batch_rows jsonb;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(target) order by target.created_at desc, target.id),
    '[]'::jsonb
  )
  into batch_rows
  from (
    select
      batch.id,
      batch.tenant_id,
      tenant.status as tenant_status,
      batch.management_company_id,
      company.status as management_company_status,
      batch.site_id,
      site.name as site_name,
      site.status as site_status,
      batch.batch_code,
      batch.requested_quantity,
      batch.status,
      batch.requested_by = actor_user_id as requested_by_current_actor,
      design.status as sticker_design_status,
      active_sample.status as sample_status,
      exists (
        select 1
        from public.qr_generation_jobs as job
        where job.tenant_id = batch.tenant_id
          and job.qr_batch_id = batch.id
      ) as has_generation_job,
      batch.version,
      batch.created_at
    from public.qr_batches as batch
    join public.tenants as tenant on tenant.id = batch.tenant_id
    join public.management_companies as company
      on company.id = batch.management_company_id
      and company.tenant_id = batch.tenant_id
    join public.sites as site
      on site.id = batch.site_id
      and site.tenant_id = batch.tenant_id
      and site.management_company_id = batch.management_company_id
    join public.sticker_design_versions as design
      on design.id = batch.sticker_design_version_id
      and design.tenant_id = batch.tenant_id
      and design.management_company_id = batch.management_company_id
      and design.site_id = batch.site_id
    left join lateral (
      select sample.status
      from public.qr_batch_samples as sample
      where sample.tenant_id = batch.tenant_id
        and sample.management_company_id = batch.management_company_id
        and sample.site_id = batch.site_id
        and sample.batch_id = batch.id
        and sample.status <> 'INVALIDATED'
      order by sample.created_at desc, sample.id
      limit 1
    ) as active_sample on true
    where batch.status in (
      'SAMPLE_APPROVED',
      'FINAL_APPROVAL_PENDING',
      'GENERATION_APPROVED'
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
    order by batch.created_at desc, batch.id
    limit 100
  ) as target;

  return jsonb_build_object('batches', batch_rows);
end;
$$;

create or replace function public.request_qr_batch_final_approval(
  p_batch_id uuid,
  p_expected_batch_version integer,
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
  before_batch public.qr_batches%rowtype;
  updated_batch public.qr_batches%rowtype;
  prior_audit public.audit_logs%rowtype;
begin
  if p_batch_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_batch_version is null or p_expected_batch_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_batch
  from public.qr_batches as candidate
  where candidate.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BATCH_NOT_FOUND_OR_FORBIDDEN';
  end if;

  perform app_private.assert_qr_inventory_actor(
    before_batch.tenant_id,
    before_batch.management_company_id,
    before_batch.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  if before_batch.requested_by <> actor_user_id then
    raise exception using errcode = '42501', message = 'REQUESTER_REQUIRED';
  end if;

  select audit.*
  into prior_audit
  from public.audit_logs as audit
  where audit.request_id = p_request_id
    and audit.action = 'QR_BATCH_FINAL_APPROVAL_REQUESTED'
    and audit.tenant_id = before_batch.tenant_id
  limit 1;

  if found then
    if prior_audit.resource_id <> p_batch_id
      or prior_audit.reason <> trim(p_reason)
      or (prior_audit.before_data ->> 'batchVersion')::integer <> p_expected_batch_version
    then
      raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'batchId', prior_audit.resource_id,
      'batchStatus', prior_audit.after_data ->> 'batchStatus',
      'batchVersion', (prior_audit.after_data ->> 'batchVersion')::integer,
      'generationRevision', null,
      'jobStatus', null
    );
  end if;

  if before_batch.version <> p_expected_batch_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_batch.status <> 'SAMPLE_APPROVED' then
    raise exception using errcode = '40001', message = 'INVALID_BATCH_TRANSITION';
  end if;
  if not exists (
    select 1
    from public.tenants as tenant
    join public.management_companies as company
      on company.tenant_id = tenant.id
      and company.id = before_batch.management_company_id
    join public.sites as site
      on site.tenant_id = tenant.id
      and site.management_company_id = company.id
      and site.id = before_batch.site_id
    where tenant.id = before_batch.tenant_id
      and tenant.status = 'ACTIVE'
      and tenant.deleted_at is null
      and company.status = 'ACTIVE'
      and company.deleted_at is null
      and site.status = 'ACTIVE'
      and site.deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'PARENT_NOT_ACTIVE';
  end if;
  if not exists (
    select 1
    from public.sticker_design_versions as design
    where design.id = before_batch.sticker_design_version_id
      and design.tenant_id = before_batch.tenant_id
      and design.management_company_id = before_batch.management_company_id
      and design.site_id = before_batch.site_id
      and design.status = 'APPROVED'
  ) then
    raise exception using errcode = 'P0001', message = 'DESIGN_NOT_APPROVED';
  end if;
  if not exists (
    select 1
    from public.qr_batch_samples as sample
    where sample.batch_id = before_batch.id
      and sample.tenant_id = before_batch.tenant_id
      and sample.management_company_id = before_batch.management_company_id
      and sample.site_id = before_batch.site_id
      and sample.status = 'APPROVED'
      and sample.decode_passed
      and sample.quiet_zone_passed
      and sample.contrast_passed
  ) then
    raise exception using errcode = 'P0001', message = 'SAMPLE_NOT_APPROVED';
  end if;
  if exists (
    select 1 from public.qr_generation_jobs as job
    where job.tenant_id = before_batch.tenant_id
      and job.qr_batch_id = before_batch.id
  ) then
    raise exception using errcode = '40001', message = 'GENERATION_JOB_EXISTS';
  end if;

  update public.qr_batches
  set status = 'FINAL_APPROVAL_PENDING'
  where id = before_batch.id
  returning * into updated_batch;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, before_data, after_data, reason, request_id
  )
  values (
    updated_batch.tenant_id,
    updated_batch.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_FINAL_APPROVAL_REQUESTED',
    'QR_BATCH',
    updated_batch.id,
    jsonb_build_object(
      'batchStatus', before_batch.status::text,
      'batchVersion', before_batch.version
    ),
    jsonb_build_object(
      'batchStatus', updated_batch.status::text,
      'batchVersion', updated_batch.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'batchId', updated_batch.id,
    'batchStatus', updated_batch.status::text,
    'batchVersion', updated_batch.version,
    'generationRevision', null,
    'jobStatus', null
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
end;
$$;

create or replace function public.approve_qr_batch_final_generation(
  p_batch_id uuid,
  p_expected_batch_version integer,
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
  before_batch public.qr_batches%rowtype;
  updated_batch public.qr_batches%rowtype;
  existing_job public.qr_generation_jobs%rowtype;
  created_job public.qr_generation_jobs%rowtype;
  prior_audit public.audit_logs%rowtype;
begin
  if p_batch_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_batch_version is null or p_expected_batch_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_batch
  from public.qr_batches as candidate
  where candidate.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BATCH_NOT_FOUND_OR_FORBIDDEN';
  end if;

  perform app_private.assert_qr_inventory_actor(
    before_batch.tenant_id,
    before_batch.management_company_id,
    before_batch.site_id,
    array['SUPER_ADMIN']
  );

  if before_batch.requested_by = actor_user_id then
    raise exception using errcode = '42501', message = 'SELF_APPROVAL_FORBIDDEN';
  end if;

  select job.*
  into existing_job
  from public.qr_generation_jobs as job
  where job.tenant_id = before_batch.tenant_id
    and job.approval_request_id = p_request_id
  limit 1;

  if found then
    select audit.*
    into prior_audit
    from public.audit_logs as audit
    where audit.tenant_id = before_batch.tenant_id
      and audit.request_id = p_request_id
      and audit.action = 'QR_BATCH_GENERATION_APPROVED'
    limit 1;

    if prior_audit.id is null
      or existing_job.qr_batch_id <> p_batch_id
      or prior_audit.resource_id <> p_batch_id
      or prior_audit.reason <> trim(p_reason)
      or (prior_audit.before_data ->> 'batchVersion')::integer <> p_expected_batch_version
    then
      raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'batchId', existing_job.qr_batch_id,
      'batchStatus', prior_audit.after_data ->> 'batchStatus',
      'batchVersion', (prior_audit.after_data ->> 'batchVersion')::integer,
      'generationRevision', existing_job.generation_revision,
      'jobStatus', existing_job.status::text
    );
  end if;

  if before_batch.version <> p_expected_batch_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_batch.status <> 'FINAL_APPROVAL_PENDING' then
    raise exception using errcode = '40001', message = 'INVALID_BATCH_TRANSITION';
  end if;
  if not exists (
    select 1
    from public.tenants as tenant
    join public.management_companies as company
      on company.tenant_id = tenant.id
      and company.id = before_batch.management_company_id
    join public.sites as site
      on site.tenant_id = tenant.id
      and site.management_company_id = company.id
      and site.id = before_batch.site_id
    where tenant.id = before_batch.tenant_id
      and tenant.status = 'ACTIVE'
      and tenant.deleted_at is null
      and company.status = 'ACTIVE'
      and company.deleted_at is null
      and site.status = 'ACTIVE'
      and site.deleted_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'PARENT_NOT_ACTIVE';
  end if;
  if not exists (
    select 1
    from public.sticker_design_versions as design
    where design.id = before_batch.sticker_design_version_id
      and design.tenant_id = before_batch.tenant_id
      and design.management_company_id = before_batch.management_company_id
      and design.site_id = before_batch.site_id
      and design.status = 'APPROVED'
  ) then
    raise exception using errcode = 'P0001', message = 'DESIGN_NOT_APPROVED';
  end if;
  if not exists (
    select 1
    from public.qr_batch_samples as sample
    where sample.batch_id = before_batch.id
      and sample.tenant_id = before_batch.tenant_id
      and sample.management_company_id = before_batch.management_company_id
      and sample.site_id = before_batch.site_id
      and sample.status = 'APPROVED'
      and sample.decode_passed
      and sample.quiet_zone_passed
      and sample.contrast_passed
  ) then
    raise exception using errcode = 'P0001', message = 'SAMPLE_NOT_APPROVED';
  end if;

  insert into public.qr_generation_jobs (
    tenant_id,
    management_company_id,
    site_id,
    qr_batch_id,
    approval_request_id
  )
  values (
    before_batch.tenant_id,
    before_batch.management_company_id,
    before_batch.site_id,
    before_batch.id,
    p_request_id
  )
  returning * into created_job;

  update public.qr_batches
  set
    status = 'GENERATION_APPROVED',
    generation_approved_by = actor_user_id,
    generation_approved_at = now()
  where id = before_batch.id
  returning * into updated_batch;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, before_data, after_data, reason, request_id
  )
  values (
    updated_batch.tenant_id,
    updated_batch.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_GENERATION_APPROVED',
    'QR_BATCH',
    updated_batch.id,
    jsonb_build_object(
      'batchStatus', before_batch.status::text,
      'batchVersion', before_batch.version
    ),
    jsonb_build_object(
      'batchStatus', updated_batch.status::text,
      'batchVersion', updated_batch.version,
      'generationRevision', created_job.generation_revision,
      'jobStatus', created_job.status::text
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'batchId', updated_batch.id,
    'batchStatus', updated_batch.status::text,
    'batchVersion', updated_batch.version,
    'generationRevision', created_job.generation_revision,
    'jobStatus', created_job.status::text
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
end;
$$;

create or replace function public.cancel_qr_batch_before_generation_approval(
  p_batch_id uuid,
  p_expected_batch_version integer,
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
  before_batch public.qr_batches%rowtype;
  updated_batch public.qr_batches%rowtype;
  prior_audit public.audit_logs%rowtype;
begin
  if p_batch_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_batch_version is null or p_expected_batch_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_batch
  from public.qr_batches as candidate
  where candidate.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BATCH_NOT_FOUND_OR_FORBIDDEN';
  end if;

  perform app_private.assert_qr_inventory_actor(
    before_batch.tenant_id,
    before_batch.management_company_id,
    before_batch.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  if before_batch.requested_by <> actor_user_id then
    raise exception using errcode = '42501', message = 'REQUESTER_REQUIRED';
  end if;

  select audit.*
  into prior_audit
  from public.audit_logs as audit
  where audit.request_id = p_request_id
    and audit.action = 'QR_BATCH_CANCELLED_BEFORE_GENERATION'
    and audit.tenant_id = before_batch.tenant_id
  limit 1;

  if found then
    if prior_audit.resource_id <> p_batch_id
      or prior_audit.reason <> trim(p_reason)
      or (prior_audit.before_data ->> 'batchVersion')::integer <> p_expected_batch_version
    then
      raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'batchId', prior_audit.resource_id,
      'batchStatus', prior_audit.after_data ->> 'batchStatus',
      'batchVersion', (prior_audit.after_data ->> 'batchVersion')::integer,
      'generationRevision', null,
      'jobStatus', null
    );
  end if;

  if before_batch.version <> p_expected_batch_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_batch.status not in ('SAMPLE_APPROVED', 'FINAL_APPROVAL_PENDING') then
    raise exception using errcode = '40001', message = 'INVALID_BATCH_TRANSITION';
  end if;
  if exists (
    select 1 from public.qr_generation_jobs as job
    where job.tenant_id = before_batch.tenant_id
      and job.qr_batch_id = before_batch.id
  ) then
    raise exception using errcode = '40001', message = 'GENERATION_JOB_EXISTS';
  end if;

  update public.qr_batches
  set
    status = 'CANCELLED',
    cancelled_by = actor_user_id,
    cancelled_at = now()
  where id = before_batch.id
  returning * into updated_batch;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, before_data, after_data, reason, request_id
  )
  values (
    updated_batch.tenant_id,
    updated_batch.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_CANCELLED_BEFORE_GENERATION',
    'QR_BATCH',
    updated_batch.id,
    jsonb_build_object(
      'batchStatus', before_batch.status::text,
      'batchVersion', before_batch.version
    ),
    jsonb_build_object(
      'batchStatus', updated_batch.status::text,
      'batchVersion', updated_batch.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'batchId', updated_batch.id,
    'batchStatus', updated_batch.status::text,
    'batchVersion', updated_batch.version,
    'generationRevision', null,
    'jobStatus', null
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
end;
$$;

revoke all on function public.get_qr_final_generation_approval_batch(uuid)
from public, anon;
revoke all on function public.list_qr_final_generation_approval_read_model()
from public, anon;
revoke all on function public.request_qr_batch_final_approval(uuid, integer, text, uuid)
from public, anon;
revoke all on function public.approve_qr_batch_final_generation(uuid, integer, text, uuid)
from public, anon;
revoke all on function public.cancel_qr_batch_before_generation_approval(uuid, integer, text, uuid)
from public, anon;

grant execute on function public.get_qr_final_generation_approval_batch(uuid)
to authenticated, service_role;
grant execute on function public.list_qr_final_generation_approval_read_model()
to authenticated, service_role;
grant execute on function public.request_qr_batch_final_approval(uuid, integer, text, uuid)
to authenticated;
grant execute on function public.approve_qr_batch_final_generation(uuid, integer, text, uuid)
to authenticated;
grant execute on function public.cancel_qr_batch_before_generation_approval(
  uuid, integer, text, uuid
) to authenticated;

comment on table public.qr_generation_jobs is
  'Durable QR generation ledger and transactional handoff intent. Queue delivery is at least once.';
comment on function public.approve_qr_batch_final_generation(uuid, integer, text, uuid) is
  'Super Admin maker-checker approval that atomically creates one PENDING_DELIVERY job intent.';

commit;
