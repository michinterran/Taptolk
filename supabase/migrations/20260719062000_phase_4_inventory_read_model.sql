begin;

create or replace function public.list_phase_4_inventory_read_model()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  batch_rows jsonb;
  asset_rows jsonb;
  import_rows jsonb;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(item) order by item.created_at desc, item.id),
    '[]'::jsonb
  )
  into batch_rows
  from (
    select
      batch.id,
      batch.tenant_id,
      batch.management_company_id,
      batch.site_id,
      site.name as site_name,
      batch.batch_code,
      batch.requested_quantity,
      batch.status,
      batch.version,
      batch.created_at
    from public.qr_batches as batch
    join public.sites as site
      on site.tenant_id = batch.tenant_id
      and site.management_company_id = batch.management_company_id
      and site.id = batch.site_id
    where batch.status in ('DELIVERED', 'DISTRIBUTING', 'COMPLETED')
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
  ) as item;

  select coalesce(
    jsonb_agg(to_jsonb(item) order by item.created_at desc, item.id),
    '[]'::jsonb
  )
  into asset_rows
  from (
    select
      asset.id,
      asset.tenant_id,
      asset.management_company_id,
      asset.site_id,
      asset.batch_id,
      asset.human_code,
      asset.status,
      asset.current_binding_id,
      vehicle.plate_last4 as current_vehicle_last4,
      asset.version,
      asset.created_at
    from public.qr_assets as asset
    left join public.vehicles as vehicle
      on vehicle.tenant_id = asset.tenant_id
      and vehicle.site_id = asset.site_id
      and vehicle.id = asset.current_vehicle_id
    where asset.status in (
      'IN_STOCK',
      'ASSIGNED',
      'ACTIVATION_PENDING',
      'ACTIVE',
      'SUSPENDED',
      'LOST',
      'DAMAGED',
      'REPLACED',
      'REVOKED'
    )
      and app_private.current_admin_has_scope(
        asset.tenant_id,
        asset.management_company_id,
        asset.site_id,
        array[
          'SUPER_ADMIN',
          'PLATFORM_OPERATOR',
          'MANAGEMENT_ADMIN',
          'SITE_ADMIN',
          'SITE_OPERATOR',
          'READ_ONLY'
        ]
      )
  ) as item;

  select coalesce(
    jsonb_agg(to_jsonb(item) order by item.created_at desc, item.id),
    '[]'::jsonb
  )
  into import_rows
  from (
    select
      import.id,
      import.tenant_id,
      site.management_company_id,
      import.site_id,
      import.row_count,
      import.status,
      import.original_deleted_at,
      import.committed_at,
      import.version,
      import.created_at
    from public.vehicle_imports as import
    join public.sites as site
      on site.tenant_id = import.tenant_id
      and site.id = import.site_id
    where app_private.current_admin_has_site_scope(
      import.tenant_id,
      import.site_id,
      array[
        'SUPER_ADMIN',
        'PLATFORM_OPERATOR',
        'MANAGEMENT_ADMIN',
        'SITE_ADMIN',
        'SITE_OPERATOR',
        'READ_ONLY'
      ]
    )
  ) as item;

  return jsonb_build_object(
    'batches',
    batch_rows,
    'assets',
    asset_rows,
    'imports',
    import_rows
  );
end;
$$;

revoke all on function public.list_phase_4_inventory_read_model()
from public, anon;
grant execute on function public.list_phase_4_inventory_read_model()
to authenticated;

commit;
