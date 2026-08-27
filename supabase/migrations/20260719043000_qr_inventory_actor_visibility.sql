begin;

revoke select on table public.sticker_design_versions from authenticated;
revoke select on table public.qr_batches from authenticated;

grant select (
  id,
  tenant_id,
  management_company_id,
  site_id,
  template_code,
  design_config,
  status,
  approved_at,
  archived_at,
  created_at,
  updated_at,
  version
) on public.sticker_design_versions to authenticated;

grant select (
  id,
  tenant_id,
  management_company_id,
  site_id,
  batch_code,
  sticker_design_version_id,
  requested_quantity,
  generated_quantity,
  rendered_quantity,
  passed_quantity,
  failed_quantity,
  purpose,
  status,
  sample_approved_at,
  generation_approved_at,
  cancelled_at,
  created_at,
  updated_at,
  version
) on public.qr_batches to authenticated;

create or replace function public.list_qr_inventory_sample_read_model()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  design_rows jsonb;
  batch_rows jsonb;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select coalesce(
    jsonb_agg(
      to_jsonb(ordered_designs)
      order by ordered_designs.created_at desc, ordered_designs.id
    ),
    '[]'::jsonb
  )
  into design_rows
  from (
    select
      design.id,
      design.tenant_id,
      design.management_company_id,
      design.site_id,
      design.template_code,
      design.design_config,
      design.status,
      design.created_by = actor_user_id as created_by_current_actor,
      design.approved_at,
      design.version,
      design.created_at,
      site.name as site_name
    from public.sticker_design_versions as design
    join public.sites as site
      on site.id = design.site_id
      and site.tenant_id = design.tenant_id
      and site.management_company_id = design.management_company_id
    where app_private.current_admin_has_scope(
      design.tenant_id,
      design.management_company_id,
      design.site_id,
      array[
        'SUPER_ADMIN',
        'PLATFORM_OPERATOR',
        'MANAGEMENT_ADMIN',
        'SITE_ADMIN',
        'SITE_OPERATOR',
        'READ_ONLY'
      ]
    )
    order by design.created_at desc, design.id
    limit 100
  ) as ordered_designs;

  select coalesce(
    jsonb_agg(
      to_jsonb(ordered_batches)
      order by ordered_batches.created_at desc, ordered_batches.id
    ),
    '[]'::jsonb
  )
  into batch_rows
  from (
    select
      batch.id,
      batch.tenant_id,
      batch.management_company_id,
      batch.site_id,
      batch.batch_code,
      batch.sticker_design_version_id,
      batch.requested_quantity,
      batch.purpose,
      batch.status,
      batch.requested_by = actor_user_id as requested_by_current_actor,
      batch.version,
      batch.created_at,
      site.name as site_name,
      design.template_code,
      active_sample.sample
    from public.qr_batches as batch
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
      select jsonb_build_object(
        'id', sample.id,
        'status', sample.status,
        'mime_type', sample.mime_type,
        'byte_size', sample.byte_size,
        'decode_passed', sample.decode_passed,
        'quiet_zone_passed', sample.quiet_zone_passed,
        'contrast_passed', sample.contrast_passed,
        'created_at', sample.created_at,
        'version', sample.version
      ) as sample
      from public.qr_batch_samples as sample
      where sample.batch_id = batch.id
        and sample.tenant_id = batch.tenant_id
        and sample.management_company_id = batch.management_company_id
        and sample.site_id = batch.site_id
        and sample.status <> 'INVALIDATED'
      order by sample.created_at desc, sample.id
      limit 1
    ) as active_sample on true
    where app_private.current_admin_has_scope(
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
  ) as ordered_batches;

  return jsonb_build_object(
    'designs', design_rows,
    'batches', batch_rows
  );
end;
$$;

revoke all on function public.list_qr_inventory_sample_read_model()
from public, anon;
grant execute on function public.list_qr_inventory_sample_read_model()
to authenticated, service_role;

comment on function public.list_qr_inventory_sample_read_model() is
  'Returns scoped QR inventory DTOs with actor UUIDs reduced to current-actor booleans.';

commit;
