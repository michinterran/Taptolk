begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'brand-assets',
  'brand-assets',
  false,
  5000000,
  array['image/png', 'image/svg+xml']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create unique index uq_brand_assets_scope_checksum_null_safe
on public.brand_assets (
  tenant_id,
  coalesce(management_company_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
  checksum_sha256
);

create unique index uq_audit_logs_brand_asset_command_request
on public.audit_logs (tenant_id, request_id, action)
where action = 'BRAND_ASSET_REGISTERED';

create or replace function public.register_brand_asset(
  p_tenant_id uuid,
  p_management_company_id uuid,
  p_site_id uuid,
  p_asset_type text,
  p_name text,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_width_px integer,
  p_height_px integer,
  p_byte_size integer,
  p_checksum_sha256 text,
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
  resolved_company_id uuid;
  new_asset public.brand_assets%rowtype;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_tenant_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_asset_type not in ('MANAGEMENT_COMPANY_LOGO', 'SITE_LOGO') then
    raise exception using errcode = '22023', message = 'INVALID_ASSET_TYPE';
  end if;
  if p_asset_type = 'SITE_LOGO' and p_site_id is null then
    raise exception using errcode = '22023', message = 'SITE_REQUIRED';
  end if;
  if p_management_company_id is null then
    raise exception using errcode = '22023', message = 'MANAGEMENT_COMPANY_REQUIRED';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 200
    or p_storage_bucket <> 'brand-assets'
    or length(trim(coalesce(p_storage_path, ''))) not between 3 and 500
    or left(p_storage_path, 1) = '/'
    or p_storage_path ~ '(^|/)\.\.(/|$)'
    or not starts_with(p_storage_path, p_tenant_id::text || '/')
    or p_mime_type not in ('image/png', 'image/svg+xml')
    or p_width_px not between 64 and 20000
    or p_height_px not between 64 and 20000
    or p_byte_size not between 1 and 5000000
    or p_checksum_sha256 !~ '^[0-9a-f]{64}$'
    or length(trim(coalesce(p_reason, ''))) not between 3 and 500
  then
    raise exception using errcode = '22023', message = 'INVALID_ASSET_METADATA';
  end if;

  if p_site_id is not null then
    select site.management_company_id
    into resolved_company_id
    from public.sites as site
    where site.tenant_id = p_tenant_id
      and site.management_company_id = p_management_company_id
      and site.id = p_site_id
      and site.status = 'ACTIVE';
  else
    select company.id
    into resolved_company_id
    from public.management_companies as company
    where company.tenant_id = p_tenant_id
      and company.id = p_management_company_id
      and company.status = 'ACTIVE';
  end if;

  if resolved_company_id is null then
    raise exception using errcode = 'P0002', message = 'SCOPE_NOT_FOUND';
  end if;
  if not app_private.current_admin_has_scope(
    p_tenant_id,
    p_management_company_id,
    p_site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select *
  into new_asset
  from public.brand_assets
  where tenant_id = p_tenant_id
    and management_company_id = p_management_company_id
    and site_id is not distinct from p_site_id
    and checksum_sha256 = p_checksum_sha256
  limit 1;

  if new_asset.id is null then
    insert into public.brand_assets (
      tenant_id,
      management_company_id,
      site_id,
      asset_type,
      name,
      storage_bucket,
      storage_path,
      mime_type,
      width_px,
      height_px,
      byte_size,
      checksum_sha256,
      status,
      created_by,
      completed_at
    )
    values (
      p_tenant_id,
      p_management_company_id,
      p_site_id,
      p_asset_type::public.brand_asset_type,
      trim(p_name),
      p_storage_bucket,
      p_storage_path,
      p_mime_type,
      p_width_px,
      p_height_px,
      p_byte_size,
      p_checksum_sha256,
      'ACTIVE',
      actor_user_id,
      now()
    )
    returning * into new_asset;
  end if;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  )
  values (
    p_tenant_id,
    p_site_id,
    'ADMIN',
    actor_user_id,
    'BRAND_ASSET_REGISTERED',
    'BRAND_ASSET',
    new_asset.id,
    jsonb_build_object(
      'assetType',
      new_asset.asset_type,
      'mimeType',
      new_asset.mime_type,
      'status',
      new_asset.status
    ),
    trim(p_reason),
    p_request_id
  )
  on conflict (tenant_id, request_id, action)
  where action = 'BRAND_ASSET_REGISTERED'
  do nothing;

  return jsonb_build_object(
    'resource_id',
    new_asset.id,
    'version',
    new_asset.version,
    'storage_path',
    new_asset.storage_path
  );
end;
$$;

revoke all on function public.register_brand_asset(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  text,
  uuid
)
from public, anon;

grant execute on function public.register_brand_asset(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  text,
  text,
  uuid
)
to authenticated;

commit;
