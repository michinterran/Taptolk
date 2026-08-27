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
  selected_generation_revision integer;
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
  into selected_generation_revision
  from public.qr_generation_jobs as job
  where job.qr_batch_id = target_batch.id
    and job.status = 'COMPLETED';

  if selected_generation_revision is null then
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
    and artifact.render_version = selected_generation_revision
  where item.generation_job_id = (
    select job.id
    from public.qr_generation_jobs as job
    where job.qr_batch_id = target_batch.id
      and job.generation_revision = selected_generation_revision
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
    selected_generation_revision,
    'already_completed',
    target_batch.status = 'PRINT_FILE_READY',
    'items',
    export_items
  );
end;
$$;

commit;
