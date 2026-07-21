begin;

create or replace function public.request_qr_batch_series(
  p_site_id uuid,
  p_expected_site_version integer,
  p_sticker_design_version_id uuid,
  p_expected_design_version integer,
  p_total_quantity integer,
  p_purpose text,
  p_reason text,
  p_idempotency_key uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target_site public.sites%rowtype;
  target_design public.sticker_design_versions%rowtype;
  created_batch public.qr_batches%rowtype;
  first_batch public.qr_batches%rowtype;
  batch_count integer;
  batch_index integer;
  batch_quantity integer;
begin
  if p_site_id is null or p_sticker_design_version_id is null or p_idempotency_key is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_site_version is null or p_expected_site_version < 1 or p_expected_design_version is null or p_expected_design_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_total_quantity is null or p_total_quantity not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'INVALID_TOTAL_QUANTITY';
  end if;
  if p_purpose is null or length(trim(p_purpose)) not between 3 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_PURPOSE';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.* into target_site
  from public.sites as candidate
  join public.management_companies as company on company.id = candidate.management_company_id and company.tenant_id = candidate.tenant_id
  join public.tenants as tenant on tenant.id = candidate.tenant_id
  where candidate.id = p_site_id and candidate.deleted_at is null and candidate.status = 'ACTIVE'
    and company.deleted_at is null and company.status = 'ACTIVE' and tenant.deleted_at is null and tenant.status = 'ACTIVE'
  for update of candidate;
  if not found then raise exception using errcode = 'P0001', message = 'PARENT_NOT_ACTIVE'; end if;
  if target_site.version <> p_expected_site_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;

  perform app_private.assert_qr_inventory_actor(
    target_site.tenant_id, target_site.management_company_id, target_site.id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  select candidate.* into target_design
  from public.sticker_design_versions as candidate
  where candidate.id = p_sticker_design_version_id and candidate.tenant_id = target_site.tenant_id
    and candidate.management_company_id = target_site.management_company_id and candidate.site_id = target_site.id
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'DESIGN_NOT_FOUND_OR_FORBIDDEN'; end if;
  if target_design.version <> p_expected_design_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if target_design.status <> 'APPROVED' then raise exception using errcode = 'P0001', message = 'DESIGN_NOT_APPROVED'; end if;

  batch_count := ceil(p_total_quantity / 100.0)::integer;
  for batch_index in 1..batch_count loop
    batch_quantity := least(100, p_total_quantity - ((batch_index - 1) * 100));
    insert into public.qr_batches (
      tenant_id, management_company_id, site_id, sticker_design_version_id,
      requested_quantity, purpose, requested_by, idempotency_key
    ) values (
      target_site.tenant_id, target_site.management_company_id, target_site.id, target_design.id,
      batch_quantity, trim(p_purpose), actor_user_id,
      case when batch_index = 1 then p_idempotency_key else gen_random_uuid() end
    ) returning * into created_batch;
    if batch_index = 1 then first_batch := created_batch; end if;

    insert into public.audit_logs (
      tenant_id, site_id, actor_type, actor_id, action, resource_type,
      resource_id, after_data, reason, request_id
    ) values (
      created_batch.tenant_id, created_batch.site_id, 'ADMIN', actor_user_id,
      'QR_BATCH_SERIES_ITEM_REQUESTED', 'QR_BATCH', created_batch.id,
      jsonb_build_object(
        'batchStatus', created_batch.status::text,
        'batchVersion', created_batch.version,
        'quantity', created_batch.requested_quantity,
        'seriesIndex', batch_index,
        'seriesCount', batch_count,
        'seriesTotalQuantity', p_total_quantity
      ), trim(p_reason), p_request_id
    );
  end loop;

  return jsonb_build_object(
    'resourceId', first_batch.id,
    'version', first_batch.version,
    'relatedResourceId', target_design.id,
    'relatedVersion', target_design.version,
    'batchCount', batch_count,
    'totalQuantity', p_total_quantity
  );
exception when unique_violation then
  raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
end;
$$;

revoke all on function public.request_qr_batch_series(uuid, integer, uuid, integer, integer, text, text, uuid, uuid) from public, anon;
grant execute on function public.request_qr_batch_series(uuid, integer, uuid, integer, integer, text, text, uuid, uuid) to authenticated;

comment on function public.request_qr_batch_series(uuid, integer, uuid, integer, integer, text, text, uuid, uuid) is
  'Creates one atomic QR production series while preserving the 1-100 quantity contract on every QR Batch.';

commit;
