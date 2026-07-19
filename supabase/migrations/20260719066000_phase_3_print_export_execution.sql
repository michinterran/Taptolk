begin;

create or replace function public.get_qr_print_export_context(
  p_batch_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_batch public.qr_batches%rowtype;
  generation_revision integer;
  export_items jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  select *
  into target_batch
  from public.qr_batches
  where id = p_batch_id;

  if target_batch.id is null then
    raise exception using errcode = 'P0002', message = 'BATCH_NOT_FOUND';
  end if;
  if target_batch.status not in ('QUALITY_CHECKED', 'PRINT_FILE_READY') then
    raise exception using errcode = '23514', message = 'BATCH_NOT_EXPORTABLE';
  end if;

  select max(job.generation_revision)
  into generation_revision
  from public.qr_generation_jobs as job
  where job.qr_batch_id = target_batch.id
    and job.status = 'COMPLETED';

  if generation_revision is null then
    raise exception using errcode = '23514', message = 'GENERATION_NOT_COMPLETED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ordinal',
        item.ordinal,
        'human_code',
        asset.human_code,
        'preview_png_path',
        artifact.preview_png_path,
        'print_svg_path',
        artifact.print_svg_path,
        'render_checksum_sha256',
        artifact.checksum_sha256
      )
      order by item.ordinal
    ),
    '[]'::jsonb
  )
  into export_items
  from public.qr_generation_items as item
  join public.qr_assets as asset
    on asset.id = item.qr_asset_id
  join public.rendered_assets as artifact
    on artifact.qr_asset_id = item.qr_asset_id
    and artifact.render_version = generation_revision
  where item.generation_job_id = (
    select job.id
    from public.qr_generation_jobs as job
    where job.qr_batch_id = target_batch.id
      and job.generation_revision = generation_revision
      and job.status = 'COMPLETED'
  )
    and artifact.quality_status = 'PASSED';

  if jsonb_array_length(export_items) <> target_batch.requested_quantity then
    raise exception using errcode = '23514', message = 'EXPORT_ITEM_COUNT_MISMATCH';
  end if;

  return jsonb_build_object(
    'tenant_id',
    target_batch.tenant_id,
    'site_id',
    target_batch.site_id,
    'batch_id',
    target_batch.id,
    'batch_code',
    target_batch.batch_code,
    'export_revision',
    generation_revision,
    'already_completed',
    target_batch.status = 'PRINT_FILE_READY',
    'items',
    export_items
  );
end;
$$;

create or replace function public.commit_qr_print_exports(
  p_batch_id uuid,
  p_export_revision integer,
  p_exports jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_batch public.qr_batches%rowtype;
  export_row record;
  committed_types text[] := array[]::text[];
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_batch_id is null
    or p_export_revision < 1
    or jsonb_typeof(p_exports) <> 'array'
    or jsonb_array_length(p_exports) <> 4
  then
    raise exception using errcode = '22023', message = 'INVALID_PRINT_EXPORT';
  end if;

  select *
  into target_batch
  from public.qr_batches
  where id = p_batch_id
  for update;

  if target_batch.id is null then
    raise exception using errcode = 'P0002', message = 'BATCH_NOT_FOUND';
  end if;
  if target_batch.status = 'PRINT_FILE_READY' then
    return jsonb_build_object(
      'batch_id',
      target_batch.id,
      'status',
      target_batch.status,
      'export_count',
      4
    );
  end if;
  if target_batch.status <> 'QUALITY_CHECKED' then
    raise exception using errcode = '23514', message = 'BATCH_NOT_EXPORTABLE';
  end if;

  for export_row in
    select *
    from jsonb_to_recordset(p_exports) as source(
      export_type text,
      storage_path text,
      checksum_sha256 text,
      byte_size bigint
    )
  loop
    if export_row.export_type not in ('PDF', 'CSV', 'ZIP', 'MANIFEST')
      or export_row.export_type = any(committed_types)
      or length(export_row.storage_path) not between 3 and 500
      or export_row.storage_path ~ '(^|/)\.\.(/|$)'
      or export_row.checksum_sha256 !~ '^[0-9a-f]{64}$'
      or export_row.byte_size < 1
    then
      raise exception using errcode = '22023', message = 'INVALID_PRINT_EXPORT_ITEM';
    end if;

    insert into public.print_exports (
      tenant_id,
      site_id,
      qr_batch_id,
      export_type,
      export_revision,
      storage_path,
      checksum_sha256,
      byte_size,
      status,
      completed_at
    )
    values (
      target_batch.tenant_id,
      target_batch.site_id,
      target_batch.id,
      export_row.export_type::public.print_export_type,
      p_export_revision,
      export_row.storage_path,
      export_row.checksum_sha256,
      export_row.byte_size,
      'READY',
      now()
    );

    committed_types := array_append(committed_types, export_row.export_type);
  end loop;

  if array_length(committed_types, 1) <> 4 then
    raise exception using errcode = '23514', message = 'PRINT_EXPORT_TYPES_INCOMPLETE';
  end if;

  update public.qr_batches
  set status = 'PRINT_FILE_READY'
  where id = target_batch.id;

  return jsonb_build_object(
    'batch_id',
    target_batch.id,
    'status',
    'PRINT_FILE_READY',
    'export_count',
    4
  );
end;
$$;

revoke all on function public.get_qr_print_export_context(uuid)
from public, anon, authenticated;
revoke all on function public.commit_qr_print_exports(uuid, integer, jsonb)
from public, anon, authenticated;
grant execute on function public.get_qr_print_export_context(uuid)
to service_role;
grant execute on function public.commit_qr_print_exports(uuid, integer, jsonb)
to service_role;

commit;
