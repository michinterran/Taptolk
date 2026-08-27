begin;

create or replace function app_private.validate_sticker_design_config()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  configured_brand_asset_id uuid;
begin
  if new.template_code not in (
    'ROUND_BLUE_HOLOGRAM_V1',
    'ROUND_PURPLE_GRADIENT_V1',
    'ROUND_WHITE_MINIMAL_V1',
    'SQUARE_DARK_PREMIUM_V1'
  )
    or new.design_config ->> 'schemaVersion' <> '1'
    or new.design_config #>> '{zones,customerLogo}' <> 'OPTIONAL_TOP'
    or new.design_config #>> '{zones,qr}' <> 'CENTER_WHITE_PLATE'
    or new.design_config #>> '{zones,taptolkLogo}' <> 'IMMUTABLE_BOTTOM'
    or new.design_config #>> '{qrOptions,errorCorrectionLevel}' <> 'H'
    or new.design_config #>> '{qrOptions,marginModules}' <> '4'
  then
    raise exception using errcode = '22023', message = 'INVALID_DESIGN_CONFIG';
  end if;

  if new.design_config -> 'brandAssetId' is not null
    and new.design_config -> 'brandAssetId' <> 'null'::jsonb
  then
    begin
      configured_brand_asset_id := (new.design_config ->> 'brandAssetId')::uuid;
    exception
      when invalid_text_representation then
        raise exception using errcode = '22023', message = 'INVALID_BRAND_ASSET_ID';
    end;

    if not exists (
      select 1
      from public.brand_assets as asset
      where asset.id = configured_brand_asset_id
        and asset.tenant_id = new.tenant_id
        and asset.management_company_id = new.management_company_id
        and asset.site_id = new.site_id
        and asset.asset_type = 'SITE_LOGO'
        and asset.status = 'ACTIVE'
    ) then
      raise exception using errcode = 'P0002', message = 'BRAND_ASSET_NOT_FOUND';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sticker_design_config_guard
on public.sticker_design_versions;

create trigger trg_sticker_design_config_guard
before insert or update of template_code, design_config
on public.sticker_design_versions
for each row
execute function app_private.validate_sticker_design_config();

create or replace function public.get_qr_sample_render_context(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  batch_row public.qr_batches%rowtype;
  design_row public.sticker_design_versions%rowtype;
  configured_brand_asset_id uuid;
  brand_asset_row public.brand_assets%rowtype;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_batch_id is null then
    raise exception using errcode = '22023', message = 'INVALID_BATCH_ID';
  end if;

  select *
  into batch_row
  from public.qr_batches
  where id = p_batch_id;

  if batch_row.id is null then
    raise exception using errcode = 'P0002', message = 'BATCH_NOT_FOUND';
  end if;
  if batch_row.status <> 'DRAFT' then
    raise exception using errcode = 'P0001', message = 'INVALID_BATCH_STATUS';
  end if;
  if not app_private.current_admin_has_scope(
    batch_row.tenant_id,
    batch_row.management_company_id,
    batch_row.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select *
  into design_row
  from public.sticker_design_versions
  where id = batch_row.sticker_design_version_id
    and tenant_id = batch_row.tenant_id
    and management_company_id = batch_row.management_company_id
    and site_id = batch_row.site_id;

  if design_row.id is null or design_row.status <> 'APPROVED' then
    raise exception using errcode = 'P0001', message = 'DESIGN_NOT_APPROVED';
  end if;

  if design_row.design_config -> 'brandAssetId' is not null
    and design_row.design_config -> 'brandAssetId' <> 'null'::jsonb
  then
    configured_brand_asset_id := (design_row.design_config ->> 'brandAssetId')::uuid;
    select *
    into brand_asset_row
    from public.brand_assets
    where id = configured_brand_asset_id
      and tenant_id = batch_row.tenant_id
      and management_company_id = batch_row.management_company_id
      and site_id = batch_row.site_id
      and asset_type = 'SITE_LOGO'
      and status = 'ACTIVE';
    if brand_asset_row.id is null then
      raise exception using errcode = 'P0002', message = 'BRAND_ASSET_NOT_FOUND';
    end if;
  end if;

  return jsonb_build_object(
    'batch_id', batch_row.id,
    'tenant_id', batch_row.tenant_id,
    'management_company_id', batch_row.management_company_id,
    'site_id', batch_row.site_id,
    'template_code', design_row.template_code,
    'brand_asset', case
      when brand_asset_row.id is null then null
      else jsonb_build_object(
        'storage_bucket', brand_asset_row.storage_bucket,
        'storage_path', brand_asset_row.storage_path,
        'mime_type', brand_asset_row.mime_type
      )
    end
  );
end;
$$;

revoke all on function public.get_qr_sample_render_context(uuid)
from public, anon;
grant execute on function public.get_qr_sample_render_context(uuid)
to authenticated;

comment on function public.get_qr_sample_render_context(uuid) is
  'Returns the authenticated scoped and approved immutable design context needed for sample rendering.';

commit;
