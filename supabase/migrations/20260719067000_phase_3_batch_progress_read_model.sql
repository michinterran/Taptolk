begin;

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
