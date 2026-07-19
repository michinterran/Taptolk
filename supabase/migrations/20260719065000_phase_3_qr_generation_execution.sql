begin;

create table public.qr_generation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  generation_job_id uuid not null,
  ordinal integer not null,
  qr_asset_id uuid not null,
  created_at timestamptz not null default now(),
  constraint fk_qr_generation_items_job
    foreign key (tenant_id, generation_job_id)
    references public.qr_generation_jobs (tenant_id, id)
    on delete restrict,
  constraint fk_qr_generation_items_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint uq_qr_generation_items_ordinal
    unique (generation_job_id, ordinal),
  constraint uq_qr_generation_items_asset
    unique (generation_job_id, qr_asset_id),
  constraint chk_qr_generation_items_ordinal
    check (ordinal between 1 and 10000)
);

create index idx_qr_generation_items_job_ordinal
on public.qr_generation_items (generation_job_id, ordinal);

alter table public.qr_generation_items enable row level security;
alter table public.qr_generation_items force row level security;
revoke all on table public.qr_generation_items from public, anon, authenticated;
grant all on table public.qr_generation_items to service_role;

create or replace function public.start_qr_generation_execution(
  p_job_id uuid,
  p_generation_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.qr_generation_jobs%rowtype;
  target_batch public.qr_batches%rowtype;
  target_design public.sticker_design_versions%rowtype;
  target_brand_asset public.brand_assets%rowtype;
  configured_brand_asset_id uuid;
  completed_ordinals jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_job_id is null or p_generation_revision is null or p_generation_revision < 1 then
    raise exception using errcode = '22023', message = 'INVALID_GENERATION_IDENTITY';
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
  if target_job.status = 'COMPLETED' then
    select coalesce(jsonb_agg(item.ordinal order by item.ordinal), '[]'::jsonb)
    into completed_ordinals
    from public.qr_generation_items as item
    where item.generation_job_id = target_job.id;

    select * into target_batch
    from public.qr_batches
    where id = target_job.qr_batch_id;

    select * into target_design
    from public.sticker_design_versions
    where id = target_batch.sticker_design_version_id;

    if target_design.design_config -> 'brandAssetId' is not null
      and target_design.design_config -> 'brandAssetId' <> 'null'::jsonb
    then
      configured_brand_asset_id := (target_design.design_config ->> 'brandAssetId')::uuid;
      select * into target_brand_asset
      from public.brand_assets
      where id = configured_brand_asset_id
        and tenant_id = target_batch.tenant_id
        and management_company_id = target_batch.management_company_id
        and site_id = target_batch.site_id
        and asset_type = 'SITE_LOGO'
        and status = 'ACTIVE';
    end if;

    return jsonb_build_object(
      'job_id', target_job.id,
      'tenant_id', target_job.tenant_id,
      'site_id', target_job.site_id,
      'batch_id', target_batch.id,
      'requested_quantity', target_batch.requested_quantity,
      'template_code', target_design.template_code,
      'customer_logo', case
        when target_brand_asset.id is null then null
        else jsonb_build_object(
          'storage_bucket', target_brand_asset.storage_bucket,
          'storage_path', target_brand_asset.storage_path,
          'mime_type', target_brand_asset.mime_type
        )
      end,
      'generation_revision', target_job.generation_revision,
      'completed_ordinals', completed_ordinals,
      'already_completed', true
    );
  end if;
  if target_job.status not in ('QUEUED', 'RETRY_WAIT', 'PROCESSING') then
    raise exception using errcode = '23514', message = 'GENERATION_JOB_NOT_EXECUTABLE';
  end if;
  if target_job.status in ('QUEUED', 'RETRY_WAIT')
    and target_job.execution_attempt_count >= target_job.max_execution_attempts
  then
    raise exception using errcode = '23514', message = 'GENERATION_ATTEMPTS_EXHAUSTED';
  end if;

  select *
  into target_batch
  from public.qr_batches
  where id = target_job.qr_batch_id
  for update;

  if target_batch.status not in ('GENERATION_QUEUED', 'GENERATING') then
    raise exception using errcode = '23514', message = 'BATCH_NOT_EXECUTABLE';
  end if;

  select *
  into target_design
  from public.sticker_design_versions
  where id = target_batch.sticker_design_version_id;

  if target_design.status <> 'APPROVED' then
    raise exception using errcode = '23514', message = 'DESIGN_NOT_APPROVED';
  end if;

  if target_design.design_config -> 'brandAssetId' is not null
    and target_design.design_config -> 'brandAssetId' <> 'null'::jsonb
  then
    configured_brand_asset_id := (target_design.design_config ->> 'brandAssetId')::uuid;
    select *
    into target_brand_asset
    from public.brand_assets
    where id = configured_brand_asset_id
      and tenant_id = target_batch.tenant_id
      and management_company_id = target_batch.management_company_id
      and site_id = target_batch.site_id
      and asset_type = 'SITE_LOGO'
      and status = 'ACTIVE';
    if target_brand_asset.id is null then
      raise exception using errcode = 'P0002', message = 'BRAND_ASSET_NOT_FOUND';
    end if;
  end if;

  if target_job.status in ('QUEUED', 'RETRY_WAIT') then
    update public.qr_generation_jobs
    set
      status = 'PROCESSING',
      execution_attempt_count = execution_attempt_count + 1,
      started_at = coalesce(started_at, now()),
      lease_expires_at = null,
      last_error_code = null
    where id = target_job.id;
  end if;

  if target_batch.status = 'GENERATION_QUEUED' then
    update public.qr_batches
    set status = 'GENERATING'
    where id = target_batch.id;
  end if;

  select coalesce(jsonb_agg(item.ordinal order by item.ordinal), '[]'::jsonb)
  into completed_ordinals
  from public.qr_generation_items as item
  where item.generation_job_id = target_job.id;

  return jsonb_build_object(
    'job_id', target_job.id,
    'tenant_id', target_job.tenant_id,
    'management_company_id', target_job.management_company_id,
    'site_id', target_job.site_id,
    'batch_id', target_batch.id,
    'requested_quantity', target_batch.requested_quantity,
    'template_code', target_design.template_code,
    'customer_logo', case
      when target_brand_asset.id is null then null
      else jsonb_build_object(
        'storage_bucket', target_brand_asset.storage_bucket,
        'storage_path', target_brand_asset.storage_path,
        'mime_type', target_brand_asset.mime_type
      )
    end,
    'sticker_design_version_id', target_design.id,
    'generation_revision', target_job.generation_revision,
    'completed_ordinals', completed_ordinals,
    'already_completed', false
  );
end;
$$;

create or replace function public.commit_qr_generation_chunk(
  p_job_id uuid,
  p_generation_revision integer,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.qr_generation_jobs%rowtype;
  target_batch public.qr_batches%rowtype;
  item record;
  committed_count integer := 0;
  total_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_job_id is null
    or p_generation_revision is null
    or p_generation_revision < 1
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 50
  then
    raise exception using errcode = '22023', message = 'INVALID_GENERATION_CHUNK';
  end if;

  select *
  into target_job
  from public.qr_generation_jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception using errcode = 'P0002', message = 'GENERATION_JOB_NOT_FOUND';
  end if;
  if target_job.status <> 'PROCESSING'
    or target_job.generation_revision <> p_generation_revision
  then
    raise exception using errcode = '23514', message = 'GENERATION_JOB_NOT_PROCESSING';
  end if;

  select *
  into target_batch
  from public.qr_batches
  where id = target_job.qr_batch_id
  for update;

  for item in
    select *
    from jsonb_to_recordset(p_items) as source(
      ordinal integer,
      qr_asset_id uuid,
      internal_uuid uuid,
      public_token_hash text,
      public_token_ciphertext text,
      token_key_version integer,
      human_code text,
      activation_code_hash text,
      activation_code_ciphertext text,
      activation_key_version integer,
      preview_png_path text,
      print_svg_path text,
      render_checksum_sha256 text,
      decoded_public_token_hash text
    )
    order by source.ordinal
  loop
    if item.ordinal not between 1 and target_batch.requested_quantity
      or item.public_token_hash !~ '^[0-9a-f]{64}$'
      or item.activation_code_hash !~ '^[0-9a-f]{64}$'
      or item.render_checksum_sha256 !~ '^[0-9a-f]{64}$'
      or item.decoded_public_token_hash <> item.public_token_hash
      or item.token_key_version < 1
      or item.activation_key_version < 1
      or item.human_code !~ '^[0-9A-HJKMNP-TV-Z]{10}$'
      or length(item.public_token_ciphertext) not between 20 and 1000
      or length(item.activation_code_ciphertext) not between 20 and 1000
      or length(item.preview_png_path) not between 3 and 500
      or length(item.print_svg_path) not between 3 and 500
    then
      raise exception using errcode = '22023', message = 'INVALID_GENERATION_ITEM';
    end if;

    if exists (
      select 1
      from public.qr_generation_items as existing
      where existing.generation_job_id = target_job.id
        and existing.ordinal = item.ordinal
    ) then
      continue;
    end if;

    insert into public.qr_assets (
      id,
      tenant_id,
      management_company_id,
      site_id,
      batch_id,
      internal_uuid,
      public_token_hash,
      public_token_ciphertext,
      token_key_version,
      human_code,
      status
    )
    values (
      item.qr_asset_id,
      target_job.tenant_id,
      target_job.management_company_id,
      target_job.site_id,
      target_job.qr_batch_id,
      item.internal_uuid,
      item.public_token_hash,
      item.public_token_ciphertext,
      item.token_key_version,
      item.human_code,
      'GENERATED'
    );

    insert into public.qr_activation_codes (
      tenant_id,
      site_id,
      qr_asset_id,
      code_hash,
      code_ciphertext,
      key_version
    )
    values (
      target_job.tenant_id,
      target_job.site_id,
      item.qr_asset_id,
      item.activation_code_hash,
      item.activation_code_ciphertext,
      item.activation_key_version
    );

    insert into public.rendered_assets (
      tenant_id,
      site_id,
      qr_asset_id,
      sticker_design_version_id,
      render_version,
      preview_png_path,
      print_svg_path,
      checksum_sha256,
      quality_status,
      decoded_public_token_hash
    )
    values (
      target_job.tenant_id,
      target_job.site_id,
      item.qr_asset_id,
      target_batch.sticker_design_version_id,
      p_generation_revision,
      item.preview_png_path,
      item.print_svg_path,
      item.render_checksum_sha256,
      'PASSED',
      item.decoded_public_token_hash
    );

    insert into public.qr_generation_items (
      tenant_id,
      site_id,
      generation_job_id,
      ordinal,
      qr_asset_id
    )
    values (
      target_job.tenant_id,
      target_job.site_id,
      target_job.id,
      item.ordinal,
      item.qr_asset_id
    );

    insert into public.qr_asset_status_logs (
      tenant_id,
      management_company_id,
      site_id,
      batch_id,
      qr_asset_id,
      from_status,
      to_status,
      reason_code,
      actor_type
    )
    values (
      target_job.tenant_id,
      target_job.management_company_id,
      target_job.site_id,
      target_job.qr_batch_id,
      item.qr_asset_id,
      null,
      'GENERATED',
      'QR_GENERATED',
      'WORKER'
    );

    committed_count := committed_count + 1;
  end loop;

  select count(*)::integer
  into total_count
  from public.qr_generation_items
  where generation_job_id = target_job.id;

  update public.qr_generation_jobs
  set
    processed_count = total_count,
    passed_count = total_count,
    failed_count = 0
  where id = target_job.id;

  update public.qr_batches
  set
    generated_quantity = total_count,
    rendered_quantity = total_count,
    passed_quantity = total_count,
    failed_quantity = 0
  where id = target_batch.id;

  return jsonb_build_object(
    'committed_count',
    committed_count,
    'total_count',
    total_count,
    'requested_count',
    target_batch.requested_quantity
  );
end;
$$;

create or replace function public.complete_qr_generation_execution(
  p_job_id uuid,
  p_generation_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.qr_generation_jobs%rowtype;
  target_batch public.qr_batches%rowtype;
  completed_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  select *
  into target_job
  from public.qr_generation_jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception using errcode = 'P0002', message = 'GENERATION_JOB_NOT_FOUND';
  end if;
  if target_job.status = 'COMPLETED' then
    return jsonb_build_object(
      'job_id',
      target_job.id,
      'status',
      target_job.status,
      'completed_count',
      target_job.passed_count
    );
  end if;
  if target_job.status <> 'PROCESSING'
    or target_job.generation_revision <> p_generation_revision
  then
    raise exception using errcode = '23514', message = 'GENERATION_JOB_NOT_PROCESSING';
  end if;

  select *
  into target_batch
  from public.qr_batches
  where id = target_job.qr_batch_id
  for update;

  select count(*)::integer
  into completed_count
  from public.qr_generation_items
  where generation_job_id = target_job.id;

  if completed_count <> target_batch.requested_quantity
    or target_job.passed_count <> target_batch.requested_quantity
    or exists (
      select 1
      from public.rendered_assets as artifact
      join public.qr_generation_items as item
        on item.qr_asset_id = artifact.qr_asset_id
      where item.generation_job_id = target_job.id
        and (
          artifact.quality_status <> 'PASSED'
          or artifact.decoded_public_token_hash is null
        )
    )
  then
    raise exception using errcode = '23514', message = 'GENERATION_QUALITY_INCOMPLETE';
  end if;

  with transitioned as (
    update public.qr_assets
    set status = 'PRINT_READY'
    where batch_id = target_batch.id
      and status = 'GENERATED'
    returning *
  )
  insert into public.qr_asset_status_logs (
    tenant_id,
    management_company_id,
    site_id,
    batch_id,
    qr_asset_id,
    from_status,
    to_status,
    reason_code,
    actor_type
  )
  select
    asset.tenant_id,
    asset.management_company_id,
    asset.site_id,
    asset.batch_id,
    asset.id,
    'GENERATED',
    'PRINT_READY',
    'RENDER_QUALITY_PASSED',
    'WORKER'
  from transitioned as asset;

  update public.qr_batches
  set status = 'GENERATED'
  where id = target_batch.id;

  update public.qr_batches
  set status = 'QUALITY_CHECKED'
  where id = target_batch.id;

  update public.qr_generation_jobs
  set
    status = 'COMPLETED',
    completed_at = now(),
    processed_count = completed_count,
    passed_count = completed_count,
    failed_count = 0
  where id = target_job.id;

  return jsonb_build_object(
    'job_id',
    target_job.id,
    'status',
    'COMPLETED',
    'completed_count',
    completed_count
  );
end;
$$;

revoke all on function public.start_qr_generation_execution(uuid, integer)
from public, anon, authenticated;
revoke all on function public.commit_qr_generation_chunk(uuid, integer, jsonb)
from public, anon, authenticated;
revoke all on function public.complete_qr_generation_execution(uuid, integer)
from public, anon, authenticated;

grant execute on function public.start_qr_generation_execution(uuid, integer)
to service_role;
grant execute on function public.commit_qr_generation_chunk(uuid, integer, jsonb)
to service_role;
grant execute on function public.complete_qr_generation_execution(uuid, integer)
to service_role;

commit;
