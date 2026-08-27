begin;

create type public.brand_asset_type as enum (
  'MANAGEMENT_COMPANY_LOGO',
  'SITE_LOGO',
  'TAPTOLK_LOGO',
  'BACKGROUND_TEMPLATE',
  'DECORATION'
);

create type public.brand_asset_status as enum (
  'UPLOADING',
  'ACTIVE',
  'REJECTED',
  'ARCHIVED'
);

create type public.sticker_template_status as enum (
  'ACTIVE',
  'ARCHIVED'
);

create type public.qr_activation_code_status as enum (
  'ISSUED',
  'USED',
  'REVOKED',
  'EXPIRED'
);

create type public.render_job_type as enum (
  'SAMPLE',
  'BATCH',
  'RETRY'
);

create type public.render_job_status as enum (
  'QUEUED',
  'PROCESSING',
  'RENDERED',
  'QUALITY_CHECKED',
  'EXPORTED',
  'COMPLETED',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'CANCELLED'
);

create type public.render_quality_status as enum (
  'PENDING',
  'PASSED',
  'FAILED'
);

create type public.print_export_type as enum (
  'PDF',
  'CSV',
  'ZIP',
  'MANIFEST'
);

create type public.print_export_status as enum (
  'PENDING',
  'READY',
  'FAILED'
);

create type public.inventory_transaction_type as enum (
  'RECEIVE',
  'ASSIGN',
  'RETURN',
  'DAMAGE',
  'REPLACE',
  'REVOKE'
);

create type public.qr_assignment_method as enum (
  'MANUAL',
  'CSV_IMPORT',
  'OWNER_ACTIVATION',
  'REPLACEMENT'
);

create type public.vehicle_import_status as enum (
  'VALIDATED',
  'COMMITTED',
  'REJECTED',
  'EXPIRED'
);

alter table public.sticker_design_versions
  add constraint uq_sticker_design_versions_tenant_site_id
    unique (tenant_id, site_id, id);

alter table public.qr_batches
  add constraint uq_qr_batches_tenant_site_id
    unique (tenant_id, site_id, id);

alter table public.qr_assets
  add constraint uq_qr_assets_tenant_site_id
    unique (tenant_id, site_id, id);

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid,
  site_id uuid,
  asset_type public.brand_asset_type not null,
  name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  width_px integer,
  height_px integer,
  byte_size integer not null,
  checksum_sha256 text not null,
  background_variant text,
  is_default boolean not null default false,
  status public.brand_asset_status not null default 'UPLOADING',
  created_by uuid not null references auth.users (id) on delete restrict,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_brand_assets_tenant
    foreign key (tenant_id)
    references public.tenants (id)
    on delete restrict,
  constraint fk_brand_assets_management_company
    foreign key (tenant_id, management_company_id)
    references public.management_companies (tenant_id, id)
    on delete restrict,
  constraint fk_brand_assets_site
    foreign key (tenant_id, management_company_id, site_id)
    references public.sites (tenant_id, management_company_id, id)
    on delete restrict,
  constraint uq_brand_assets_tenant_id unique (tenant_id, id),
  constraint uq_brand_assets_scope_checksum
    unique (tenant_id, management_company_id, site_id, checksum_sha256),
  constraint chk_brand_assets_scope check (
    (site_id is null or management_company_id is not null)
    and (
      asset_type not in ('MANAGEMENT_COMPANY_LOGO', 'SITE_LOGO')
      or management_company_id is not null
    )
    and (asset_type <> 'SITE_LOGO' or site_id is not null)
  ),
  constraint chk_brand_assets_name
    check (length(trim(name)) between 1 and 200),
  constraint chk_brand_assets_storage_bucket
    check (storage_bucket ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'),
  constraint chk_brand_assets_storage_path check (
    length(trim(storage_path)) between 3 and 500
    and left(storage_path, 1) <> '/'
    and storage_path !~ '(^|/)\.\.(/|$)'
  ),
  constraint chk_brand_assets_mime
    check (mime_type in ('image/png', 'image/svg+xml')),
  constraint chk_brand_assets_dimensions check (
    (width_px is null and height_px is null)
    or (width_px between 1 and 20000 and height_px between 1 and 20000)
  ),
  constraint chk_brand_assets_byte_size
    check (byte_size between 1 and 5000000),
  constraint chk_brand_assets_checksum
    check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint chk_brand_assets_state_metadata check (
    (
      status = 'UPLOADING'
      and completed_at is null
      and archived_at is null
    )
    or (
      status in ('ACTIVE', 'REJECTED')
      and completed_at is not null
      and archived_at is null
    )
    or (
      status = 'ARCHIVED'
      and completed_at is not null
      and archived_at is not null
    )
  )
);

create index idx_brand_assets_tenant_status_created
on public.brand_assets (tenant_id, status, created_at desc);

create index idx_brand_assets_site_type_status
on public.brand_assets (site_id, asset_type, status);

create table public.sticker_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  name text not null,
  shape text not null,
  width_mm numeric(8, 2) not null,
  height_mm numeric(8, 2) not null,
  dpi integer not null,
  layout_schema jsonb not null,
  material_code text,
  version integer not null,
  status public.sticker_template_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  constraint chk_sticker_templates_code
    check (template_code ~ '^[A-Z0-9][A-Z0-9_]{1,63}$'),
  constraint chk_sticker_templates_name
    check (length(trim(name)) between 1 and 200),
  constraint chk_sticker_templates_shape
    check (shape in ('CIRCLE', 'SQUARE')),
  constraint chk_sticker_templates_size
    check (width_mm > 0 and height_mm > 0 and width_mm <= 500 and height_mm <= 500),
  constraint chk_sticker_templates_dpi
    check (dpi between 72 and 1200),
  constraint chk_sticker_templates_layout
    check (
      jsonb_typeof(layout_schema) = 'object'
      and layout_schema ? 'canvas'
      and layout_schema ? 'zones'
      and layout_schema ? 'qrOptions'
    ),
  constraint chk_sticker_templates_version
    check (version >= 1)
);

insert into public.sticker_templates (
  template_code,
  name,
  shape,
  width_mm,
  height_mm,
  dpi,
  layout_schema,
  version
)
values
  (
    'ROUND_BLUE_HOLOGRAM_V1',
    'Round Blue Hologram',
    'CIRCLE',
    85,
    85,
    300,
    '{"canvas":{"shape":"CIRCLE","widthMm":85,"heightMm":85,"dpi":300},"zones":{"customerLogo":{"x":0.22,"y":0.07,"width":0.56,"height":0.18,"fit":"contain"},"qrPlate":{"x":0.23,"y":0.245,"width":0.54,"height":0.54,"background":"#FFFFFF","radius":0.04},"qrCode":{"x":0.27,"y":0.285,"width":0.46,"height":0.46},"taptolkLogo":{"x":0.30,"y":0.84,"width":0.40,"height":0.09,"fit":"contain"}},"qrOptions":{"errorCorrectionLevel":"H","marginModules":4,"foreground":"#111111","background":"#FFFFFF"},"background":"#7CB7FF"}'::jsonb,
    1
  ),
  (
    'ROUND_PURPLE_GRADIENT_V1',
    'Round Purple Gradient',
    'CIRCLE',
    85,
    85,
    300,
    '{"canvas":{"shape":"CIRCLE","widthMm":85,"heightMm":85,"dpi":300},"zones":{"customerLogo":{"x":0.22,"y":0.07,"width":0.56,"height":0.18,"fit":"contain"},"qrPlate":{"x":0.23,"y":0.245,"width":0.54,"height":0.54,"background":"#FFFFFF","radius":0.04},"qrCode":{"x":0.27,"y":0.285,"width":0.46,"height":0.46},"taptolkLogo":{"x":0.30,"y":0.84,"width":0.40,"height":0.09,"fit":"contain"}},"qrOptions":{"errorCorrectionLevel":"H","marginModules":4,"foreground":"#111111","background":"#FFFFFF"},"background":"#8066FF"}'::jsonb,
    1
  ),
  (
    'ROUND_WHITE_MINIMAL_V1',
    'Round White Minimal',
    'CIRCLE',
    85,
    85,
    300,
    '{"canvas":{"shape":"CIRCLE","widthMm":85,"heightMm":85,"dpi":300},"zones":{"customerLogo":{"x":0.22,"y":0.07,"width":0.56,"height":0.18,"fit":"contain"},"qrPlate":{"x":0.23,"y":0.245,"width":0.54,"height":0.54,"background":"#FFFFFF","radius":0.04},"qrCode":{"x":0.27,"y":0.285,"width":0.46,"height":0.46},"taptolkLogo":{"x":0.30,"y":0.84,"width":0.40,"height":0.09,"fit":"contain"}},"qrOptions":{"errorCorrectionLevel":"H","marginModules":4,"foreground":"#111111","background":"#FFFFFF"},"background":"#FFFFFF"}'::jsonb,
    1
  ),
  (
    'SQUARE_DARK_PREMIUM_V1',
    'Square Dark Premium',
    'SQUARE',
    85,
    85,
    300,
    '{"canvas":{"shape":"SQUARE","widthMm":85,"heightMm":85,"dpi":300},"zones":{"customerLogo":{"x":0.22,"y":0.07,"width":0.56,"height":0.18,"fit":"contain"},"qrPlate":{"x":0.23,"y":0.245,"width":0.54,"height":0.54,"background":"#FFFFFF","radius":0.04},"qrCode":{"x":0.27,"y":0.285,"width":0.46,"height":0.46},"taptolkLogo":{"x":0.30,"y":0.84,"width":0.40,"height":0.09,"fit":"contain"}},"qrOptions":{"errorCorrectionLevel":"H","marginModules":4,"foreground":"#111111","background":"#FFFFFF"},"background":"#111018"}'::jsonb,
    1
  );

alter table public.sticker_design_versions
  add column template_id uuid,
  add column customer_logo_asset_id uuid,
  add column taptolk_logo_asset_id uuid,
  add constraint fk_sticker_design_versions_template
    foreign key (template_id)
    references public.sticker_templates (id)
    on delete restrict,
  add constraint fk_sticker_design_versions_customer_logo
    foreign key (tenant_id, customer_logo_asset_id)
    references public.brand_assets (tenant_id, id)
    on delete restrict,
  add constraint fk_sticker_design_versions_taptolk_logo
    foreign key (tenant_id, taptolk_logo_asset_id)
    references public.brand_assets (tenant_id, id)
    on delete restrict;

update public.sticker_design_versions as design
set template_id = template.id
from public.sticker_templates as template
where template.template_code = design.template_code;

create table public.qr_activation_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_asset_id uuid not null,
  code_hash text not null unique,
  code_ciphertext text not null,
  key_version integer not null,
  status public.qr_activation_code_status not null default 'ISSUED',
  expires_at timestamptz,
  used_at timestamptz,
  used_by_owner_id uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fk_qr_activation_codes_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint uq_qr_activation_codes_tenant_id unique (tenant_id, id),
  constraint uq_qr_activation_codes_asset unique (qr_asset_id),
  constraint chk_qr_activation_codes_hash
    check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_qr_activation_codes_ciphertext
    check (length(code_ciphertext) between 20 and 1000),
  constraint chk_qr_activation_codes_key_version
    check (key_version >= 1),
  constraint chk_qr_activation_codes_state check (
    (
      status = 'ISSUED'
      and used_at is null
      and used_by_owner_id is null
      and revoked_at is null
    )
    or (
      status = 'USED'
      and used_at is not null
      and used_by_owner_id is not null
      and revoked_at is null
    )
    or (
      status = 'REVOKED'
      and used_at is null
      and used_by_owner_id is null
      and revoked_at is not null
    )
    or (
      status = 'EXPIRED'
      and used_at is null
      and used_by_owner_id is null
    )
  )
);

create index idx_qr_activation_codes_tenant_status
on public.qr_activation_codes (tenant_id, status, created_at desc);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_batch_id uuid not null,
  sticker_design_version_id uuid not null,
  job_type public.render_job_type not null,
  render_revision integer not null default 1,
  requested_count integer not null,
  processed_count integer not null default 0,
  passed_count integer not null default 0,
  failed_count integer not null default 0,
  status public.render_job_status not null default 'QUEUED',
  queue_message_id text,
  idempotency_key uuid not null,
  started_at timestamptz,
  completed_at timestamptz,
  error_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_render_jobs_batch
    foreign key (tenant_id, site_id, qr_batch_id)
    references public.qr_batches (tenant_id, site_id, id)
    on delete restrict,
  constraint fk_render_jobs_design
    foreign key (tenant_id, site_id, sticker_design_version_id)
    references public.sticker_design_versions (tenant_id, site_id, id)
    on delete restrict,
  constraint uq_render_jobs_tenant_id unique (tenant_id, id),
  constraint uq_render_jobs_idempotency unique (tenant_id, idempotency_key),
  constraint uq_render_jobs_revision
    unique (tenant_id, qr_batch_id, sticker_design_version_id, job_type, render_revision),
  constraint chk_render_jobs_revision check (render_revision >= 1),
  constraint chk_render_jobs_counts check (
    requested_count between 1 and 10000
    and processed_count between 0 and requested_count
    and passed_count >= 0
    and failed_count >= 0
    and passed_count + failed_count <= processed_count
  ),
  constraint chk_render_jobs_error_summary check (
    error_summary is null or jsonb_typeof(error_summary) = 'object'
  )
);

create index idx_render_jobs_tenant_status_created
on public.render_jobs (tenant_id, status, created_at);

create table public.rendered_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_asset_id uuid not null,
  sticker_design_version_id uuid not null,
  render_version integer not null,
  preview_png_path text not null,
  print_svg_path text not null,
  checksum_sha256 text not null,
  quality_status public.render_quality_status not null default 'PENDING',
  decoded_public_token_hash text,
  created_at timestamptz not null default now(),
  constraint fk_rendered_assets_qr
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint fk_rendered_assets_design
    foreign key (tenant_id, site_id, sticker_design_version_id)
    references public.sticker_design_versions (tenant_id, site_id, id)
    on delete restrict,
  constraint uq_rendered_assets_version
    unique (qr_asset_id, sticker_design_version_id, render_version),
  constraint chk_rendered_assets_version check (render_version >= 1),
  constraint chk_rendered_assets_preview_path check (
    length(trim(preview_png_path)) between 3 and 500
    and preview_png_path !~ '(^|/)\.\.(/|$)'
  ),
  constraint chk_rendered_assets_svg_path check (
    length(trim(print_svg_path)) between 3 and 500
    and print_svg_path !~ '(^|/)\.\.(/|$)'
  ),
  constraint chk_rendered_assets_checksum
    check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint chk_rendered_assets_decoded_hash
    check (
      decoded_public_token_hash is null
      or decoded_public_token_hash ~ '^[0-9a-f]{64}$'
    ),
  constraint chk_rendered_assets_quality check (
    quality_status <> 'PASSED'
    or decoded_public_token_hash is not null
  )
);

create index idx_rendered_assets_tenant_quality_created
on public.rendered_assets (tenant_id, quality_status, created_at);

create table public.print_exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_batch_id uuid not null,
  export_type public.print_export_type not null,
  export_revision integer not null default 1,
  storage_path text,
  checksum_sha256 text,
  byte_size bigint,
  status public.print_export_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint fk_print_exports_batch
    foreign key (tenant_id, site_id, qr_batch_id)
    references public.qr_batches (tenant_id, site_id, id)
    on delete restrict,
  constraint uq_print_exports_revision
    unique (qr_batch_id, export_type, export_revision),
  constraint chk_print_exports_revision check (export_revision >= 1),
  constraint chk_print_exports_path check (
    storage_path is null
    or (
      length(trim(storage_path)) between 3 and 500
      and storage_path !~ '(^|/)\.\.(/|$)'
    )
  ),
  constraint chk_print_exports_checksum
    check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint chk_print_exports_size
    check (byte_size is null or byte_size > 0),
  constraint chk_print_exports_ready check (
    status <> 'READY'
    or (
      storage_path is not null
      and checksum_sha256 is not null
      and byte_size is not null
      and completed_at is not null
    )
  )
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  plate_lookup_hash text not null,
  plate_ciphertext text not null,
  plate_key_version integer not null,
  plate_last4 text not null,
  status text not null default 'PREASSIGNED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_vehicles_site
    foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id)
    on delete restrict,
  constraint uq_vehicles_tenant_id unique (tenant_id, id),
  constraint uq_vehicles_tenant_site_id unique (tenant_id, site_id, id),
  constraint uq_vehicles_site_plate_hash unique (site_id, plate_lookup_hash),
  constraint chk_vehicles_plate_hash
    check (plate_lookup_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_vehicles_plate_ciphertext
    check (length(plate_ciphertext) between 20 and 1000),
  constraint chk_vehicles_plate_key_version
    check (plate_key_version >= 1),
  constraint chk_vehicles_plate_last4
    check (plate_last4 ~ '^[0-9가-힣A-Z]{2,4}$'),
  constraint chk_vehicles_status
    check (status in ('PREASSIGNED', 'ACTIVE', 'INACTIVE'))
);

create index idx_vehicles_tenant_site_status
on public.vehicles (tenant_id, site_id, status);

create table public.qr_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_asset_id uuid not null,
  vehicle_id uuid not null,
  owner_id uuid,
  assignment_method public.qr_assignment_method not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text,
  is_primary boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint fk_qr_bindings_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint fk_qr_bindings_vehicle
    foreign key (tenant_id, site_id, vehicle_id)
    references public.vehicles (tenant_id, site_id, id)
    on delete restrict,
  constraint uq_qr_bindings_tenant_id unique (tenant_id, id),
  constraint chk_qr_bindings_ended check (
    (ended_at is null and ended_reason is null)
    or (
      ended_at is not null
      and ended_reason is not null
      and length(trim(ended_reason)) between 3 and 500
      and ended_at >= started_at
    )
  )
);

create unique index uq_qr_active_binding
on public.qr_bindings (qr_asset_id)
where ended_at is null;

create unique index uq_vehicle_primary_active_qr
on public.qr_bindings (vehicle_id)
where ended_at is null and is_primary = true;

create index idx_qr_bindings_tenant_site_created
on public.qr_bindings (tenant_id, site_id, created_at desc);

alter table public.qr_assets
  add constraint fk_qr_assets_current_vehicle
    foreign key (tenant_id, site_id, current_vehicle_id)
    references public.vehicles (tenant_id, site_id, id)
    on delete restrict,
  add constraint fk_qr_assets_current_binding
    foreign key (tenant_id, current_binding_id)
    references public.qr_bindings (tenant_id, id)
    on delete restrict;

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  qr_batch_id uuid not null,
  qr_asset_id uuid,
  transaction_type public.inventory_transaction_type not null,
  quantity integer not null,
  reference_type text not null,
  reference_id uuid not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint fk_inventory_transactions_batch
    foreign key (tenant_id, site_id, qr_batch_id)
    references public.qr_batches (tenant_id, site_id, id)
    on delete restrict,
  constraint fk_inventory_transactions_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint chk_inventory_transactions_quantity
    check (quantity > 0),
  constraint chk_inventory_transactions_reference_type
    check (reference_type ~ '^[A-Z0-9][A-Z0-9_]{1,63}$')
);

create index idx_inventory_transactions_tenant_site_created
on public.inventory_transactions (tenant_id, site_id, created_at desc);

create table public.vehicle_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  source_checksum_sha256 text not null,
  idempotency_key uuid not null,
  row_count integer not null,
  valid_row_count integer not null,
  invalid_row_count integer not null,
  status public.vehicle_import_status not null default 'VALIDATED',
  created_by uuid not null references auth.users (id) on delete restrict,
  committed_at timestamptz,
  original_deleted_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_vehicle_imports_site
    foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id)
    on delete restrict,
  constraint uq_vehicle_imports_tenant_id unique (tenant_id, id),
  constraint uq_vehicle_imports_idempotency unique (tenant_id, idempotency_key),
  constraint uq_vehicle_imports_checksum unique (tenant_id, site_id, source_checksum_sha256),
  constraint chk_vehicle_imports_checksum
    check (source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint chk_vehicle_imports_counts check (
    row_count between 1 and 10000
    and valid_row_count >= 0
    and invalid_row_count >= 0
    and valid_row_count + invalid_row_count = row_count
  ),
  constraint chk_vehicle_imports_expiry
    check (expires_at > created_at),
  constraint chk_vehicle_imports_state check (
    (status = 'COMMITTED' and committed_at is not null)
    or (status <> 'COMMITTED' and committed_at is null)
  )
);

create table public.vehicle_import_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  site_id uuid not null,
  import_id uuid not null,
  row_number integer not null,
  plate_lookup_hash text,
  plate_ciphertext text,
  plate_key_version integer,
  plate_last4 text,
  qr_asset_id uuid,
  validation_code text,
  committed_binding_id uuid,
  created_at timestamptz not null default now(),
  constraint fk_vehicle_import_rows_import
    foreign key (tenant_id, import_id)
    references public.vehicle_imports (tenant_id, id)
    on delete cascade,
  constraint fk_vehicle_import_rows_asset
    foreign key (tenant_id, site_id, qr_asset_id)
    references public.qr_assets (tenant_id, site_id, id)
    on delete restrict,
  constraint fk_vehicle_import_rows_binding
    foreign key (tenant_id, committed_binding_id)
    references public.qr_bindings (tenant_id, id)
    on delete restrict,
  constraint uq_vehicle_import_rows_number unique (import_id, row_number),
  constraint chk_vehicle_import_rows_number check (row_number >= 2),
  constraint chk_vehicle_import_rows_valid_payload check (
    (
      validation_code is null
      and plate_lookup_hash ~ '^[0-9a-f]{64}$'
      and length(plate_ciphertext) between 20 and 1000
      and plate_key_version >= 1
      and plate_last4 ~ '^[0-9가-힣A-Z]{2,4}$'
      and qr_asset_id is not null
    )
    or (
      validation_code ~ '^[A-Z0-9][A-Z0-9_]{1,63}$'
      and committed_binding_id is null
    )
  )
);

create index idx_vehicle_import_rows_import_validation
on public.vehicle_import_rows (import_id, validation_code, row_number);

alter table public.brand_assets enable row level security;
alter table public.brand_assets force row level security;
alter table public.sticker_templates enable row level security;
alter table public.sticker_templates force row level security;
alter table public.qr_activation_codes enable row level security;
alter table public.qr_activation_codes force row level security;
alter table public.render_jobs enable row level security;
alter table public.render_jobs force row level security;
alter table public.rendered_assets enable row level security;
alter table public.rendered_assets force row level security;
alter table public.print_exports enable row level security;
alter table public.print_exports force row level security;
alter table public.vehicles enable row level security;
alter table public.vehicles force row level security;
alter table public.qr_bindings enable row level security;
alter table public.qr_bindings force row level security;
alter table public.inventory_transactions enable row level security;
alter table public.inventory_transactions force row level security;
alter table public.vehicle_imports enable row level security;
alter table public.vehicle_imports force row level security;
alter table public.vehicle_import_rows enable row level security;
alter table public.vehicle_import_rows force row level security;

create or replace function app_private.current_admin_has_site_scope(
  target_tenant_id uuid,
  target_site_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(
    (
      select app_private.current_admin_has_scope(
        target_tenant_id,
        site.management_company_id,
        target_site_id,
        allowed_roles
      )
      from public.sites as site
      where site.tenant_id = target_tenant_id
        and site.id = target_site_id
    ),
    false
  );
$$;

revoke all on function app_private.current_admin_has_site_scope(uuid, uuid, text[])
from public, anon;
grant execute on function app_private.current_admin_has_site_scope(uuid, uuid, text[])
to authenticated, service_role;

revoke all on table public.brand_assets from public, anon, authenticated;
revoke all on table public.sticker_templates from public, anon, authenticated;
revoke all on table public.qr_activation_codes from public, anon, authenticated;
revoke all on table public.render_jobs from public, anon, authenticated;
revoke all on table public.rendered_assets from public, anon, authenticated;
revoke all on table public.print_exports from public, anon, authenticated;
revoke all on table public.vehicles from public, anon, authenticated;
revoke all on table public.qr_bindings from public, anon, authenticated;
revoke all on table public.inventory_transactions from public, anon, authenticated;
revoke all on table public.vehicle_imports from public, anon, authenticated;
revoke all on table public.vehicle_import_rows from public, anon, authenticated;

grant select on table public.brand_assets to authenticated;
grant select on table public.sticker_templates to authenticated;
grant select on table public.render_jobs to authenticated;
grant select on table public.rendered_assets to authenticated;
grant select on table public.print_exports to authenticated;
grant select on table public.vehicles to authenticated;
grant select on table public.qr_bindings to authenticated;
grant select on table public.inventory_transactions to authenticated;
grant select on table public.vehicle_imports to authenticated;

grant all on table public.brand_assets to service_role;
grant all on table public.sticker_templates to service_role;
grant all on table public.qr_activation_codes to service_role;
grant all on table public.render_jobs to service_role;
grant all on table public.rendered_assets to service_role;
grant all on table public.print_exports to service_role;
grant all on table public.vehicles to service_role;
grant all on table public.qr_bindings to service_role;
grant all on table public.inventory_transactions to service_role;
grant all on table public.vehicle_imports to service_role;
grant all on table public.vehicle_import_rows to service_role;

create policy brand_assets_select_scoped
on public.brand_assets
for select
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

create policy sticker_templates_select_authenticated
on public.sticker_templates
for select
to authenticated
using (status = 'ACTIVE');

create policy render_jobs_select_scoped
on public.render_jobs
for select
to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

create policy rendered_assets_select_scoped
on public.rendered_assets
for select
to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

create policy print_exports_select_scoped
on public.print_exports
for select
to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

create policy vehicles_select_scoped
on public.vehicles
for select
to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

create policy qr_bindings_select_scoped
on public.qr_bindings
for select
to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

create policy inventory_transactions_select_scoped
on public.inventory_transactions
for select
to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

create policy vehicle_imports_select_scoped
on public.vehicle_imports
for select
to authenticated
using (
  app_private.current_admin_has_site_scope(
    tenant_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

create trigger trg_brand_assets_touch
before update on public.brand_assets
for each row execute function app_private.touch_versioned_row();

create trigger trg_render_jobs_touch
before update on public.render_jobs
for each row execute function app_private.touch_versioned_row();

create trigger trg_vehicles_touch
before update on public.vehicles
for each row execute function app_private.touch_versioned_row();

create trigger trg_vehicle_imports_touch
before update on public.vehicle_imports
for each row execute function app_private.touch_versioned_row();

create or replace function app_private.guard_sticker_template_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '23514', message = 'STICKER_TEMPLATE_IMMUTABLE';
end;
$$;

create trigger trg_sticker_templates_immutable
before update or delete on public.sticker_templates
for each row execute function app_private.guard_sticker_template_mutation();

create or replace function app_private.guard_qr_binding_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.ended_at is not null then
    raise exception using errcode = '23514', message = 'BINDING_HISTORY_IMMUTABLE';
  end if;
  if new.id <> old.id
    or new.tenant_id <> old.tenant_id
    or new.site_id <> old.site_id
    or new.qr_asset_id <> old.qr_asset_id
    or new.vehicle_id <> old.vehicle_id
    or new.owner_id is distinct from old.owner_id
    or new.assignment_method <> old.assignment_method
    or new.started_at <> old.started_at
    or new.is_primary <> old.is_primary
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at
  then
    raise exception using errcode = '23514', message = 'BINDING_IDENTITY_IMMUTABLE';
  end if;
  if new.ended_at is null or new.ended_reason is null then
    raise exception using errcode = '23514', message = 'BINDING_END_REQUIRED';
  end if;
  return new;
end;
$$;

create trigger trg_qr_bindings_guard
before update on public.qr_bindings
for each row execute function app_private.guard_qr_binding_update();

create or replace function app_private.deny_history_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '23514', message = 'HISTORY_DELETE_FORBIDDEN';
end;
$$;

create trigger trg_qr_bindings_no_delete
before delete on public.qr_bindings
for each row execute function app_private.deny_history_delete();

create trigger trg_inventory_transactions_no_update_delete
before update or delete on public.inventory_transactions
for each row execute function app_private.deny_history_delete();

create trigger trg_rendered_assets_no_update_delete
before update or delete on public.rendered_assets
for each row execute function app_private.deny_history_delete();

revoke all on function app_private.guard_sticker_template_mutation()
from public, anon, authenticated;
revoke all on function app_private.guard_qr_binding_update()
from public, anon, authenticated;
revoke all on function app_private.deny_history_delete()
from public, anon, authenticated;

alter table public.qr_batches
  drop constraint chk_qr_batches_requested_quantity,
  add constraint chk_qr_batches_requested_quantity
    check (requested_quantity between 1 and 10000);

commit;
