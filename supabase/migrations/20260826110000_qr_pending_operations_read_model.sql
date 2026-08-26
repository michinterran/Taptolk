begin;

-- Keep the QR-only approval state visible in the same operations flow as
-- generation progress. The existing progress read model intentionally starts
-- at GENERATION_APPROVED, so pending QR-only requests need a redacted,
-- scope-checked companion read model.
create or replace function public.list_qr_pending_batch_progress_read_model()
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
      null::text as job_status,
      null::integer as processed_count,
      null::integer as job_passed_count,
      null::integer as job_failed_count,
      null::integer as execution_attempt_count,
      '[]'::jsonb as export_types
    from public.qr_batches as batch
    join public.sites as site
      on site.tenant_id = batch.tenant_id
      and site.management_company_id = batch.management_company_id
      and site.id = batch.site_id
    where batch.status = 'FINAL_APPROVAL_PENDING'
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

revoke all on function public.list_qr_pending_batch_progress_read_model()
from public, anon, authenticated;
grant execute on function public.list_qr_pending_batch_progress_read_model()
to authenticated;

commit;
