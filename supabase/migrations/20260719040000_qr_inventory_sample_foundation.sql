begin;

create type public.sticker_design_status as enum (
  'DRAFT',
  'APPROVED',
  'ARCHIVED'
);

create type public.qr_batch_status as enum (
  'DRAFT',
  'SAMPLE_RENDERING',
  'SAMPLE_READY',
  'SAMPLE_APPROVED',
  'FINAL_APPROVAL_PENDING',
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
  'CANCELLED',
  'PARTIALLY_COMPLETED'
);

create type public.qr_batch_sample_status as enum (
  'READY',
  'APPROVED',
  'INVALIDATED'
);

create type public.qr_asset_status as enum (
  'GENERATED',
  'PRINT_READY',
  'PRINTED',
  'IN_STOCK',
  'ASSIGNED',
  'ACTIVATION_PENDING',
  'ACTIVE',
  'SUSPENDED',
  'LOST',
  'DAMAGED',
  'REPLACED',
  'REVOKED',
  'EXPIRED'
);

create table public.sticker_design_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid not null,
  template_code text not null,
  design_config jsonb not null,
  status public.sticker_design_status not null default 'DRAFT',
  created_by uuid not null references auth.users (id) on delete restrict,
  approved_by uuid references auth.users (id) on delete restrict,
  approved_at timestamptz,
  archived_by uuid references auth.users (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_sticker_design_versions_site
    foreign key (tenant_id, management_company_id, site_id)
    references public.sites (tenant_id, management_company_id, id)
    on delete restrict,
  constraint uq_sticker_design_versions_scope_id
    unique (tenant_id, management_company_id, site_id, id),
  constraint chk_sticker_design_versions_template_code
    check (template_code ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'),
  constraint chk_sticker_design_versions_config
    check (
      jsonb_typeof(design_config) = 'object'
      and length(design_config::text) <= 20000
    ),
  constraint chk_sticker_design_versions_state_metadata check (
    (
      status = 'DRAFT'
      and approved_by is null
      and approved_at is null
      and archived_by is null
      and archived_at is null
    )
    or (
      status = 'APPROVED'
      and approved_by is not null
      and approved_at is not null
      and created_by <> approved_by
      and archived_by is null
      and archived_at is null
    )
    or (
      status = 'ARCHIVED'
      and approved_by is not null
      and approved_at is not null
      and created_by <> approved_by
      and archived_by is not null
      and archived_at is not null
    )
  )
);

create unique index uq_sticker_design_versions_site_draft
on public.sticker_design_versions (site_id)
where status = 'DRAFT';

create unique index uq_sticker_design_versions_site_approved
on public.sticker_design_versions (site_id)
where status = 'APPROVED';

create index idx_sticker_design_versions_tenant_status_created
on public.sticker_design_versions (tenant_id, status, created_at desc);

create index idx_sticker_design_versions_site_status_created
on public.sticker_design_versions (site_id, status, created_at desc);

create table public.qr_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid not null,
  batch_code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  sticker_design_version_id uuid not null,
  requested_quantity integer not null,
  generated_quantity integer not null default 0,
  rendered_quantity integer not null default 0,
  passed_quantity integer not null default 0,
  failed_quantity integer not null default 0,
  purpose text not null,
  status public.qr_batch_status not null default 'DRAFT',
  requested_by uuid not null references auth.users (id) on delete restrict,
  sample_approved_by uuid references auth.users (id) on delete restrict,
  sample_approved_at timestamptz,
  generation_approved_by uuid references auth.users (id) on delete restrict,
  generation_approved_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete restrict,
  cancelled_at timestamptz,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_qr_batches_site
    foreign key (tenant_id, management_company_id, site_id)
    references public.sites (tenant_id, management_company_id, id)
    on delete restrict,
  constraint fk_qr_batches_sticker_design
    foreign key (
      tenant_id,
      management_company_id,
      site_id,
      sticker_design_version_id
    )
    references public.sticker_design_versions (
      tenant_id,
      management_company_id,
      site_id,
      id
    )
    on delete restrict,
  constraint uq_qr_batches_scope_id
    unique (tenant_id, management_company_id, site_id, id),
  constraint uq_qr_batches_batch_code unique (batch_code),
  constraint chk_qr_batches_requested_quantity
    check (requested_quantity between 1 and 100),
  constraint chk_qr_batches_counters check (
    generated_quantity >= 0
    and rendered_quantity >= 0
    and passed_quantity >= 0
    and failed_quantity >= 0
    and generated_quantity <= requested_quantity
    and rendered_quantity <= requested_quantity
    and passed_quantity + failed_quantity <= requested_quantity
  ),
  constraint chk_qr_batches_purpose
    check (length(trim(purpose)) between 3 and 200),
  constraint chk_qr_batches_state_metadata check (
    (
      status in ('DRAFT', 'SAMPLE_RENDERING', 'SAMPLE_READY')
      and sample_approved_by is null
      and sample_approved_at is null
      and generation_approved_by is null
      and generation_approved_at is null
      and cancelled_by is null
      and cancelled_at is null
    )
    or (
      status in ('SAMPLE_APPROVED', 'FINAL_APPROVAL_PENDING')
      and sample_approved_by is not null
      and sample_approved_at is not null
      and requested_by <> sample_approved_by
      and generation_approved_by is null
      and generation_approved_at is null
      and cancelled_by is null
      and cancelled_at is null
    )
    or (
      status in (
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
      and sample_approved_by is not null
      and sample_approved_at is not null
      and requested_by <> sample_approved_by
      and generation_approved_by is not null
      and generation_approved_at is not null
      and requested_by <> generation_approved_by
      and cancelled_by is null
      and cancelled_at is null
    )
    or (
      status = 'CANCELLED'
      and generation_approved_by is null
      and generation_approved_at is null
      and cancelled_by is not null
      and cancelled_at is not null
    )
  )
);

create index idx_qr_batches_tenant_status_created
on public.qr_batches (tenant_id, status, created_at desc);

create index idx_qr_batches_site_status_created
on public.qr_batches (site_id, status, created_at desc);

create table public.qr_batch_samples (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid not null,
  batch_id uuid not null,
  status public.qr_batch_sample_status not null default 'READY',
  storage_bucket text not null,
  storage_path text not null,
  checksum_sha256 text not null,
  mime_type text not null,
  byte_size integer not null,
  decode_passed boolean not null default false,
  quiet_zone_passed boolean not null default false,
  contrast_passed boolean not null default false,
  attached_by uuid not null references auth.users (id) on delete restrict,
  approved_by uuid references auth.users (id) on delete restrict,
  approved_at timestamptz,
  invalidated_by uuid references auth.users (id) on delete restrict,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_qr_batch_samples_batch
    foreign key (tenant_id, management_company_id, site_id, batch_id)
    references public.qr_batches (tenant_id, management_company_id, site_id, id)
    on delete restrict,
  constraint uq_qr_batch_samples_scope_id
    unique (tenant_id, management_company_id, site_id, batch_id, id),
  constraint chk_qr_batch_samples_bucket
    check (storage_bucket ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'),
  constraint chk_qr_batch_samples_path check (
    length(trim(storage_path)) between 3 and 500
    and left(storage_path, 1) <> '/'
    and storage_path !~ '(^|/)\.\.(/|$)'
  ),
  constraint chk_qr_batch_samples_checksum
    check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint chk_qr_batch_samples_mime
    check (mime_type in ('image/png', 'image/svg+xml', 'application/pdf')),
  constraint chk_qr_batch_samples_byte_size
    check (byte_size between 1 and 20000000),
  constraint chk_qr_batch_samples_invalidation_reason check (
    invalidation_reason is null
    or length(trim(invalidation_reason)) between 3 and 500
  ),
  constraint chk_qr_batch_samples_state_metadata check (
    (
      status = 'READY'
      and approved_by is null
      and approved_at is null
      and invalidated_by is null
      and invalidated_at is null
      and invalidation_reason is null
    )
    or (
      status = 'APPROVED'
      and approved_by is not null
      and approved_at is not null
      and invalidated_by is null
      and invalidated_at is null
      and invalidation_reason is null
    )
    or (
      status = 'INVALIDATED'
      and invalidated_by is not null
      and invalidated_at is not null
      and invalidation_reason is not null
    )
  )
);

create unique index uq_qr_batch_samples_active_batch
on public.qr_batch_samples (batch_id)
where status <> 'INVALIDATED';

create index idx_qr_batch_samples_site_status_created
on public.qr_batch_samples (site_id, status, created_at desc);

create table public.qr_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid not null,
  batch_id uuid not null,
  internal_uuid uuid not null unique default gen_random_uuid(),
  public_token_hash text not null unique,
  public_token_ciphertext text not null,
  token_key_version integer not null,
  human_code text not null unique,
  status public.qr_asset_status not null default 'GENERATED',
  current_vehicle_id uuid,
  current_binding_id uuid,
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_qr_assets_batch
    foreign key (tenant_id, management_company_id, site_id, batch_id)
    references public.qr_batches (tenant_id, management_company_id, site_id, id)
    on delete restrict,
  constraint uq_qr_assets_scope_id
    unique (tenant_id, management_company_id, site_id, batch_id, id),
  constraint chk_qr_assets_key_version check (token_key_version >= 1),
  constraint chk_qr_assets_human_code
    check (length(trim(human_code)) between 4 and 64),
  constraint chk_qr_assets_revoke_reason
    check (revoke_reason is null or length(trim(revoke_reason)) between 3 and 500)
);

create index idx_qr_assets_tenant_status_created
on public.qr_assets (tenant_id, status, created_at desc);

create index idx_qr_assets_site_status_created
on public.qr_assets (site_id, status, created_at desc);

create table public.qr_asset_status_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid not null,
  batch_id uuid not null,
  qr_asset_id uuid not null,
  from_status public.qr_asset_status,
  to_status public.qr_asset_status not null,
  reason_code text not null,
  reason_text text,
  actor_type public.audit_actor_type not null,
  actor_id uuid,
  created_at timestamptz not null default now(),
  constraint fk_qr_asset_status_logs_asset
    foreign key (
      tenant_id,
      management_company_id,
      site_id,
      batch_id,
      qr_asset_id
    )
    references public.qr_assets (
      tenant_id,
      management_company_id,
      site_id,
      batch_id,
      id
    )
    on delete restrict,
  constraint chk_qr_asset_status_logs_reason_code
    check (reason_code ~ '^[A-Z0-9][A-Z0-9_]{1,63}$'),
  constraint chk_qr_asset_status_logs_reason_text
    check (reason_text is null or length(trim(reason_text)) between 3 and 500),
  constraint chk_qr_asset_status_logs_transition
    check (from_status is null or from_status <> to_status)
);

create index idx_qr_asset_status_logs_asset_created
on public.qr_asset_status_logs (qr_asset_id, created_at desc);

create or replace function app_private.guard_sticker_design_version_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status = 'ARCHIVED' then
    raise exception using errcode = '23514', message = 'DESIGN_TERMINAL';
  end if;
  if new.id <> old.id
    or new.tenant_id <> old.tenant_id
    or new.management_company_id <> old.management_company_id
    or new.site_id <> old.site_id
    or new.template_code <> old.template_code
    or new.design_config <> old.design_config
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at
  then
    raise exception using errcode = '23514', message = 'DESIGN_IDENTITY_IMMUTABLE';
  end if;
  if not (
    (old.status = 'DRAFT' and new.status = 'APPROVED')
    or (old.status = 'APPROVED' and new.status = 'ARCHIVED')
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DESIGN_TRANSITION';
  end if;
  return new;
end;
$$;

create or replace function app_private.guard_qr_batch_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status in ('COMPLETED', 'CANCELLED') then
    raise exception using errcode = '23514', message = 'BATCH_TERMINAL';
  end if;
  if new.id <> old.id
    or new.tenant_id <> old.tenant_id
    or new.management_company_id <> old.management_company_id
    or new.site_id <> old.site_id
    or new.batch_code <> old.batch_code
    or new.sticker_design_version_id <> old.sticker_design_version_id
    or new.requested_quantity <> old.requested_quantity
    or new.purpose <> old.purpose
    or new.requested_by <> old.requested_by
    or new.idempotency_key <> old.idempotency_key
    or new.created_at <> old.created_at
  then
    raise exception using errcode = '23514', message = 'BATCH_IDENTITY_IMMUTABLE';
  end if;
  if not (
    (old.status = 'DRAFT' and new.status in ('SAMPLE_READY', 'CANCELLED'))
    or (old.status = 'SAMPLE_READY' and new.status in ('SAMPLE_APPROVED', 'DRAFT', 'CANCELLED'))
    or (old.status = 'SAMPLE_APPROVED' and new.status = 'DRAFT')
  ) then
    raise exception using errcode = '23514', message = 'INVALID_BATCH_TRANSITION';
  end if;
  return new;
end;
$$;

create or replace function app_private.guard_qr_batch_sample_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status = 'INVALIDATED' then
    raise exception using errcode = '23514', message = 'SAMPLE_TERMINAL';
  end if;
  if new.id <> old.id
    or new.tenant_id <> old.tenant_id
    or new.management_company_id <> old.management_company_id
    or new.site_id <> old.site_id
    or new.batch_id <> old.batch_id
    or new.storage_bucket <> old.storage_bucket
    or new.storage_path <> old.storage_path
    or new.checksum_sha256 <> old.checksum_sha256
    or new.mime_type <> old.mime_type
    or new.byte_size <> old.byte_size
    or new.decode_passed <> old.decode_passed
    or new.quiet_zone_passed <> old.quiet_zone_passed
    or new.contrast_passed <> old.contrast_passed
    or new.attached_by <> old.attached_by
    or new.created_at <> old.created_at
  then
    raise exception using errcode = '23514', message = 'SAMPLE_IDENTITY_IMMUTABLE';
  end if;
  if not (
    (old.status = 'READY' and new.status in ('APPROVED', 'INVALIDATED'))
    or (old.status = 'APPROVED' and new.status = 'INVALIDATED')
  ) then
    raise exception using errcode = '23514', message = 'INVALID_SAMPLE_TRANSITION';
  end if;
  return new;
end;
$$;

create or replace function app_private.guard_qr_asset_status_log()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '23514', message = 'QR_ASSET_STATUS_LOG_IMMUTABLE';
end;
$$;

create trigger trg_sticker_design_versions_guard
before update on public.sticker_design_versions
for each row execute function app_private.guard_sticker_design_version_update();

create trigger trg_sticker_design_versions_touch
before update on public.sticker_design_versions
for each row execute function app_private.touch_versioned_row();

create trigger trg_qr_batches_guard
before update on public.qr_batches
for each row execute function app_private.guard_qr_batch_update();

create trigger trg_qr_batches_touch
before update on public.qr_batches
for each row execute function app_private.touch_versioned_row();

create trigger trg_qr_batch_samples_guard
before update on public.qr_batch_samples
for each row execute function app_private.guard_qr_batch_sample_update();

create trigger trg_qr_batch_samples_touch
before update on public.qr_batch_samples
for each row execute function app_private.touch_versioned_row();

create trigger trg_qr_assets_touch
before update on public.qr_assets
for each row execute function app_private.touch_versioned_row();

create trigger trg_qr_asset_status_logs_immutable
before update or delete on public.qr_asset_status_logs
for each row execute function app_private.guard_qr_asset_status_log();

create or replace function app_private.assert_qr_inventory_actor(
  target_tenant_id uuid,
  target_management_company_id uuid,
  target_site_id uuid,
  allowed_roles text[]
)
returns public.admin_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role public.admin_role;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select membership.role
  into actor_role
  from public.admin_memberships as membership
  where membership.user_id = auth.uid()
    and membership.status = 'ACTIVE'
    and membership.role::text = any(allowed_roles)
    and (
      (
        membership.scope_type = 'PLATFORM'
        and membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
      )
      or (
        membership.scope_type = 'MANAGEMENT_COMPANY'
        and membership.tenant_id = target_tenant_id
        and membership.management_company_id = target_management_company_id
      )
      or (
        membership.scope_type = 'SITE'
        and membership.tenant_id = target_tenant_id
        and membership.management_company_id = target_management_company_id
        and membership.site_id = target_site_id
      )
    )
  order by case membership.role
    when 'SUPER_ADMIN' then 1
    when 'PLATFORM_OPERATOR' then 2
    when 'MANAGEMENT_ADMIN' then 3
    when 'SITE_ADMIN' then 4
    else 99
  end
  limit 1;

  if actor_role is null then
    raise exception using errcode = '42501', message = 'QR_RESOURCE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if actor_role in ('SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'SITE_ADMIN')
    and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
  then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  return actor_role;
end;
$$;

alter table public.sticker_design_versions enable row level security;
alter table public.sticker_design_versions force row level security;
alter table public.qr_batches enable row level security;
alter table public.qr_batches force row level security;
alter table public.qr_batch_samples enable row level security;
alter table public.qr_batch_samples force row level security;
alter table public.qr_assets enable row level security;
alter table public.qr_assets force row level security;
alter table public.qr_asset_status_logs enable row level security;
alter table public.qr_asset_status_logs force row level security;

revoke all on table
  public.sticker_design_versions,
  public.qr_batches,
  public.qr_batch_samples,
  public.qr_assets,
  public.qr_asset_status_logs
from public, anon, authenticated;

grant select on table public.sticker_design_versions to authenticated;
grant select on table public.qr_batches to authenticated;
grant select (
  id,
  tenant_id,
  management_company_id,
  site_id,
  batch_id,
  status,
  mime_type,
  byte_size,
  decode_passed,
  quiet_zone_passed,
  contrast_passed,
  approved_at,
  invalidated_at,
  created_at,
  updated_at,
  version
) on public.qr_batch_samples to authenticated;
grant select (
  id,
  tenant_id,
  management_company_id,
  site_id,
  batch_id,
  internal_uuid,
  human_code,
  status,
  current_vehicle_id,
  activated_at,
  suspended_at,
  revoked_at,
  expires_at,
  created_at,
  updated_at,
  version
) on public.qr_assets to authenticated;
grant select on table public.qr_asset_status_logs to authenticated;

grant select, delete on table
  public.sticker_design_versions,
  public.qr_batches,
  public.qr_batch_samples,
  public.qr_assets
to service_role;
grant select on table public.qr_asset_status_logs to service_role;

create policy sticker_design_versions_select_scoped
on public.sticker_design_versions
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

create policy qr_batches_select_scoped
on public.qr_batches
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

create policy qr_batch_samples_select_scoped
on public.qr_batch_samples
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

create policy qr_assets_select_scoped
on public.qr_assets
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

create policy qr_asset_status_logs_select_scoped
on public.qr_asset_status_logs
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

revoke all on function app_private.guard_sticker_design_version_update()
from public, anon, authenticated;
revoke all on function app_private.guard_qr_batch_update()
from public, anon, authenticated;
revoke all on function app_private.guard_qr_batch_sample_update()
from public, anon, authenticated;
revoke all on function app_private.guard_qr_asset_status_log()
from public, anon, authenticated;
revoke all on function app_private.assert_qr_inventory_actor(uuid, uuid, uuid, text[])
from public, anon, authenticated;

create or replace function public.create_sticker_design_version(
  p_site_id uuid,
  p_expected_site_version integer,
  p_template_code text,
  p_design_config jsonb,
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
  target_site public.sites%rowtype;
  created_design public.sticker_design_versions%rowtype;
begin
  if p_site_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_site_version is null or p_expected_site_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_template_code is null or p_template_code !~ '^[A-Z0-9][A-Z0-9_-]{1,63}$' then
    raise exception using errcode = '22023', message = 'INVALID_TEMPLATE_CODE';
  end if;
  if p_design_config is null
    or jsonb_typeof(p_design_config) <> 'object'
    or length(p_design_config::text) > 20000
  then
    raise exception using errcode = '22023', message = 'INVALID_DESIGN_CONFIG';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into target_site
  from public.sites as candidate
  join public.management_companies as company
    on company.id = candidate.management_company_id
    and company.tenant_id = candidate.tenant_id
  join public.tenants as tenant on tenant.id = candidate.tenant_id
  where candidate.id = p_site_id
    and candidate.deleted_at is null
    and candidate.status = 'ACTIVE'
    and company.deleted_at is null
    and company.status = 'ACTIVE'
    and tenant.deleted_at is null
    and tenant.status = 'ACTIVE'
  for update of candidate;

  if not found then
    raise exception using errcode = 'P0001', message = 'PARENT_NOT_ACTIVE';
  end if;
  if target_site.version <> p_expected_site_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  perform app_private.assert_qr_inventory_actor(
    target_site.tenant_id,
    target_site.management_company_id,
    target_site.id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  insert into public.sticker_design_versions (
    tenant_id,
    management_company_id,
    site_id,
    template_code,
    design_config,
    created_by
  )
  values (
    target_site.tenant_id,
    target_site.management_company_id,
    target_site.id,
    p_template_code,
    p_design_config,
    actor_user_id
  )
  returning * into created_design;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, after_data, reason, request_id
  )
  values (
    created_design.tenant_id,
    created_design.site_id,
    'ADMIN',
    actor_user_id,
    'STICKER_DESIGN_CREATED',
    'STICKER_DESIGN_VERSION',
    created_design.id,
    jsonb_build_object(
      'designStatus', created_design.status::text,
      'designVersion', created_design.version,
      'templateCode', created_design.template_code
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resourceId', created_design.id,
    'version', created_design.version,
    'relatedResourceId', null,
    'relatedVersion', null
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'DESIGN_DRAFT_EXISTS';
end;
$$;

create or replace function public.approve_sticker_design_version(
  p_design_id uuid,
  p_expected_version integer,
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
  before_design public.sticker_design_versions%rowtype;
  updated_design public.sticker_design_versions%rowtype;
begin
  if p_design_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_design
  from public.sticker_design_versions as candidate
  where candidate.id = p_design_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'DESIGN_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_design.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_design.status <> 'DRAFT' then
    raise exception using errcode = '40001', message = 'INVALID_DESIGN_TRANSITION';
  end if;
  if before_design.created_by = actor_user_id then
    raise exception using errcode = '42501', message = 'SELF_REVIEW_FORBIDDEN';
  end if;

  perform app_private.assert_qr_inventory_actor(
    before_design.tenant_id,
    before_design.management_company_id,
    before_design.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  update public.sticker_design_versions
  set
    status = 'APPROVED',
    approved_by = actor_user_id,
    approved_at = now()
  where id = before_design.id
  returning * into updated_design;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, before_data, after_data, reason, request_id
  )
  values (
    updated_design.tenant_id,
    updated_design.site_id,
    'ADMIN',
    actor_user_id,
    'STICKER_DESIGN_APPROVED',
    'STICKER_DESIGN_VERSION',
    updated_design.id,
    jsonb_build_object(
      'designStatus', before_design.status::text,
      'designVersion', before_design.version
    ),
    jsonb_build_object(
      'designStatus', updated_design.status::text,
      'designVersion', updated_design.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resourceId', updated_design.id,
    'version', updated_design.version,
    'relatedResourceId', null,
    'relatedVersion', null
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'APPROVED_DESIGN_EXISTS';
end;
$$;

create or replace function public.archive_sticker_design_version(
  p_design_id uuid,
  p_expected_version integer,
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
  before_design public.sticker_design_versions%rowtype;
  updated_design public.sticker_design_versions%rowtype;
begin
  if p_design_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_design
  from public.sticker_design_versions as candidate
  where candidate.id = p_design_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'DESIGN_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_design.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_design.status <> 'APPROVED' then
    raise exception using errcode = '40001', message = 'INVALID_DESIGN_TRANSITION';
  end if;

  perform app_private.assert_qr_inventory_actor(
    before_design.tenant_id,
    before_design.management_company_id,
    before_design.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  if exists (
    select 1
    from public.qr_batches as batch
    where batch.sticker_design_version_id = before_design.id
      and batch.status <> 'CANCELLED'
  ) then
    raise exception using errcode = 'P0001', message = 'DESIGN_IN_USE';
  end if;

  update public.sticker_design_versions
  set
    status = 'ARCHIVED',
    archived_by = actor_user_id,
    archived_at = now()
  where id = before_design.id
  returning * into updated_design;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, before_data, after_data, reason, request_id
  )
  values (
    updated_design.tenant_id,
    updated_design.site_id,
    'ADMIN',
    actor_user_id,
    'STICKER_DESIGN_ARCHIVED',
    'STICKER_DESIGN_VERSION',
    updated_design.id,
    jsonb_build_object(
      'designStatus', before_design.status::text,
      'designVersion', before_design.version
    ),
    jsonb_build_object(
      'designStatus', updated_design.status::text,
      'designVersion', updated_design.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resourceId', updated_design.id,
    'version', updated_design.version,
    'relatedResourceId', null,
    'relatedVersion', null
  );
end;
$$;

create or replace function public.request_qr_batch(
  p_site_id uuid,
  p_expected_site_version integer,
  p_sticker_design_version_id uuid,
  p_expected_design_version integer,
  p_quantity integer,
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
begin
  if p_site_id is null
    or p_sticker_design_version_id is null
    or p_idempotency_key is null
    or p_request_id is null
  then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_site_version is null
    or p_expected_site_version < 1
    or p_expected_design_version is null
    or p_expected_design_version < 1
  then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_quantity is null or p_quantity not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_QUANTITY';
  end if;
  if p_purpose is null or length(trim(p_purpose)) not between 3 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_PURPOSE';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into target_site
  from public.sites as candidate
  join public.management_companies as company
    on company.id = candidate.management_company_id
    and company.tenant_id = candidate.tenant_id
  join public.tenants as tenant on tenant.id = candidate.tenant_id
  where candidate.id = p_site_id
    and candidate.deleted_at is null
    and candidate.status = 'ACTIVE'
    and company.deleted_at is null
    and company.status = 'ACTIVE'
    and tenant.deleted_at is null
    and tenant.status = 'ACTIVE'
  for update of candidate;

  if not found then
    raise exception using errcode = 'P0001', message = 'PARENT_NOT_ACTIVE';
  end if;
  if target_site.version <> p_expected_site_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  perform app_private.assert_qr_inventory_actor(
    target_site.tenant_id,
    target_site.management_company_id,
    target_site.id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  select candidate.*
  into target_design
  from public.sticker_design_versions as candidate
  where candidate.id = p_sticker_design_version_id
    and candidate.tenant_id = target_site.tenant_id
    and candidate.management_company_id = target_site.management_company_id
    and candidate.site_id = target_site.id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'DESIGN_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if target_design.version <> p_expected_design_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if target_design.status <> 'APPROVED' then
    raise exception using errcode = 'P0001', message = 'DESIGN_NOT_APPROVED';
  end if;

  insert into public.qr_batches (
    tenant_id,
    management_company_id,
    site_id,
    sticker_design_version_id,
    requested_quantity,
    purpose,
    requested_by,
    idempotency_key
  )
  values (
    target_site.tenant_id,
    target_site.management_company_id,
    target_site.id,
    target_design.id,
    p_quantity,
    trim(p_purpose),
    actor_user_id,
    p_idempotency_key
  )
  returning * into created_batch;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, after_data, reason, request_id
  )
  values (
    created_batch.tenant_id,
    created_batch.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_REQUESTED',
    'QR_BATCH',
    created_batch.id,
    jsonb_build_object(
      'batchStatus', created_batch.status::text,
      'batchVersion', created_batch.version,
      'quantity', created_batch.requested_quantity
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resourceId', created_batch.id,
    'version', created_batch.version,
    'relatedResourceId', created_batch.sticker_design_version_id,
    'relatedVersion', target_design.version
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_CONFLICT';
end;
$$;

create or replace function public.attach_qr_batch_sample(
  p_batch_id uuid,
  p_expected_batch_version integer,
  p_storage_bucket text,
  p_storage_path text,
  p_checksum_sha256 text,
  p_mime_type text,
  p_byte_size integer,
  p_decode_passed boolean,
  p_quiet_zone_passed boolean,
  p_contrast_passed boolean,
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
  before_batch public.qr_batches%rowtype;
  updated_batch public.qr_batches%rowtype;
  created_sample public.qr_batch_samples%rowtype;
begin
  if p_batch_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_batch_version is null or p_expected_batch_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_storage_bucket is null
    or p_storage_bucket !~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'
    or p_storage_path is null
    or length(trim(p_storage_path)) not between 3 and 500
    or left(p_storage_path, 1) = '/'
    or p_storage_path ~ '(^|/)\.\.(/|$)'
  then
    raise exception using errcode = '22023', message = 'INVALID_PATH';
  end if;
  if p_checksum_sha256 is null or p_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_CHECKSUM';
  end if;
  if p_mime_type is null
    or p_mime_type not in ('image/png', 'image/svg+xml', 'application/pdf')
  then
    raise exception using errcode = '22023', message = 'INVALID_MIME_TYPE';
  end if;
  if p_byte_size is null or p_byte_size not between 1 and 20000000 then
    raise exception using errcode = '22023', message = 'INVALID_BYTE_SIZE';
  end if;
  if p_decode_passed is null or p_quiet_zone_passed is null or p_contrast_passed is null then
    raise exception using errcode = '22023', message = 'INVALID_QA';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_batch
  from public.qr_batches as candidate
  where candidate.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BATCH_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_batch.version <> p_expected_batch_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_batch.status <> 'DRAFT' then
    raise exception using errcode = '40001', message = 'INVALID_BATCH_TRANSITION';
  end if;

  perform app_private.assert_qr_inventory_actor(
    before_batch.tenant_id,
    before_batch.management_company_id,
    before_batch.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  insert into public.qr_batch_samples (
    tenant_id,
    management_company_id,
    site_id,
    batch_id,
    storage_bucket,
    storage_path,
    checksum_sha256,
    mime_type,
    byte_size,
    decode_passed,
    quiet_zone_passed,
    contrast_passed,
    attached_by
  )
  values (
    before_batch.tenant_id,
    before_batch.management_company_id,
    before_batch.site_id,
    before_batch.id,
    trim(p_storage_bucket),
    trim(p_storage_path),
    p_checksum_sha256,
    p_mime_type,
    p_byte_size,
    p_decode_passed,
    p_quiet_zone_passed,
    p_contrast_passed,
    actor_user_id
  )
  returning * into created_sample;

  update public.qr_batches
  set status = 'SAMPLE_READY'
  where id = before_batch.id
  returning * into updated_batch;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, after_data, reason, request_id
  )
  values (
    created_sample.tenant_id,
    created_sample.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_SAMPLE_ATTACHED',
    'QR_BATCH_SAMPLE',
    created_sample.id,
    jsonb_build_object(
      'batchStatus', updated_batch.status::text,
      'batchVersion', updated_batch.version,
      'sampleStatus', created_sample.status::text,
      'sampleVersion', created_sample.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resourceId', created_sample.id,
    'version', created_sample.version,
    'relatedResourceId', updated_batch.id,
    'relatedVersion', updated_batch.version
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'ACTIVE_SAMPLE_EXISTS';
end;
$$;

create or replace function public.approve_qr_batch_sample(
  p_batch_id uuid,
  p_expected_batch_version integer,
  p_sample_id uuid,
  p_expected_sample_version integer,
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
  before_batch public.qr_batches%rowtype;
  updated_batch public.qr_batches%rowtype;
  before_sample public.qr_batch_samples%rowtype;
  updated_sample public.qr_batch_samples%rowtype;
begin
  if p_batch_id is null or p_sample_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_batch_version is null
    or p_expected_batch_version < 1
    or p_expected_sample_version is null
    or p_expected_sample_version < 1
  then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_batch
  from public.qr_batches as candidate
  where candidate.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BATCH_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_batch.version <> p_expected_batch_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_batch.status <> 'SAMPLE_READY' then
    raise exception using errcode = '40001', message = 'INVALID_BATCH_TRANSITION';
  end if;
  if before_batch.requested_by = actor_user_id then
    raise exception using errcode = '42501', message = 'SELF_REVIEW_FORBIDDEN';
  end if;

  perform app_private.assert_qr_inventory_actor(
    before_batch.tenant_id,
    before_batch.management_company_id,
    before_batch.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  select candidate.*
  into before_sample
  from public.qr_batch_samples as candidate
  where candidate.id = p_sample_id
    and candidate.batch_id = before_batch.id
    and candidate.tenant_id = before_batch.tenant_id
    and candidate.management_company_id = before_batch.management_company_id
    and candidate.site_id = before_batch.site_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SAMPLE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_sample.version <> p_expected_sample_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_sample.status <> 'READY' then
    raise exception using errcode = '40001', message = 'INVALID_SAMPLE_TRANSITION';
  end if;
  if not (
    before_sample.decode_passed
    and before_sample.quiet_zone_passed
    and before_sample.contrast_passed
  ) then
    raise exception using errcode = 'P0001', message = 'SAMPLE_QA_REQUIRED';
  end if;

  update public.qr_batch_samples
  set
    status = 'APPROVED',
    approved_by = actor_user_id,
    approved_at = now()
  where id = before_sample.id
  returning * into updated_sample;

  update public.qr_batches
  set
    status = 'SAMPLE_APPROVED',
    sample_approved_by = actor_user_id,
    sample_approved_at = now()
  where id = before_batch.id
  returning * into updated_batch;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, before_data, after_data, reason, request_id
  )
  values (
    updated_sample.tenant_id,
    updated_sample.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_SAMPLE_APPROVED',
    'QR_BATCH_SAMPLE',
    updated_sample.id,
    jsonb_build_object(
      'batchStatus', before_batch.status::text,
      'batchVersion', before_batch.version,
      'sampleStatus', before_sample.status::text,
      'sampleVersion', before_sample.version
    ),
    jsonb_build_object(
      'batchStatus', updated_batch.status::text,
      'batchVersion', updated_batch.version,
      'quantity', updated_batch.requested_quantity,
      'sampleStatus', updated_sample.status::text,
      'sampleVersion', updated_sample.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resourceId', updated_sample.id,
    'version', updated_sample.version,
    'relatedResourceId', updated_batch.id,
    'relatedVersion', updated_batch.version
  );
end;
$$;

create or replace function public.invalidate_qr_batch_sample(
  p_batch_id uuid,
  p_expected_batch_version integer,
  p_sample_id uuid,
  p_expected_sample_version integer,
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
  before_batch public.qr_batches%rowtype;
  updated_batch public.qr_batches%rowtype;
  before_sample public.qr_batch_samples%rowtype;
  updated_sample public.qr_batch_samples%rowtype;
begin
  if p_batch_id is null or p_sample_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_batch_version is null
    or p_expected_batch_version < 1
    or p_expected_sample_version is null
    or p_expected_sample_version < 1
  then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_batch
  from public.qr_batches as candidate
  where candidate.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BATCH_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_batch.version <> p_expected_batch_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_batch.status not in ('SAMPLE_READY', 'SAMPLE_APPROVED') then
    raise exception using errcode = '40001', message = 'INVALID_BATCH_TRANSITION';
  end if;

  perform app_private.assert_qr_inventory_actor(
    before_batch.tenant_id,
    before_batch.management_company_id,
    before_batch.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  select candidate.*
  into before_sample
  from public.qr_batch_samples as candidate
  where candidate.id = p_sample_id
    and candidate.batch_id = before_batch.id
    and candidate.tenant_id = before_batch.tenant_id
    and candidate.management_company_id = before_batch.management_company_id
    and candidate.site_id = before_batch.site_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SAMPLE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_sample.version <> p_expected_sample_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_sample.status not in ('READY', 'APPROVED') then
    raise exception using errcode = '40001', message = 'INVALID_SAMPLE_TRANSITION';
  end if;

  update public.qr_batch_samples
  set
    status = 'INVALIDATED',
    invalidated_by = actor_user_id,
    invalidated_at = now(),
    invalidation_reason = trim(p_reason)
  where id = before_sample.id
  returning * into updated_sample;

  update public.qr_batches
  set
    status = 'DRAFT',
    sample_approved_by = null,
    sample_approved_at = null
  where id = before_batch.id
  returning * into updated_batch;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, before_data, after_data, reason, request_id
  )
  values (
    updated_sample.tenant_id,
    updated_sample.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_SAMPLE_INVALIDATED',
    'QR_BATCH_SAMPLE',
    updated_sample.id,
    jsonb_build_object(
      'batchStatus', before_batch.status::text,
      'batchVersion', before_batch.version,
      'sampleStatus', before_sample.status::text,
      'sampleVersion', before_sample.version
    ),
    jsonb_build_object(
      'batchStatus', updated_batch.status::text,
      'batchVersion', updated_batch.version,
      'sampleStatus', updated_sample.status::text,
      'sampleVersion', updated_sample.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resourceId', updated_sample.id,
    'version', updated_sample.version,
    'relatedResourceId', updated_batch.id,
    'relatedVersion', updated_batch.version
  );
end;
$$;

create or replace function public.cancel_qr_batch(
  p_batch_id uuid,
  p_expected_batch_version integer,
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
  before_batch public.qr_batches%rowtype;
  updated_batch public.qr_batches%rowtype;
begin
  if p_batch_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_batch_version is null or p_expected_batch_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_batch
  from public.qr_batches as candidate
  where candidate.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BATCH_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_batch.version <> p_expected_batch_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_batch.status not in ('DRAFT', 'SAMPLE_READY') then
    raise exception using errcode = '40001', message = 'INVALID_BATCH_TRANSITION';
  end if;
  if before_batch.requested_by <> actor_user_id then
    raise exception using errcode = '42501', message = 'REQUESTER_REQUIRED';
  end if;

  perform app_private.assert_qr_inventory_actor(
    before_batch.tenant_id,
    before_batch.management_company_id,
    before_batch.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  );

  if before_batch.status = 'SAMPLE_READY' then
    update public.qr_batch_samples
    set
      status = 'INVALIDATED',
      invalidated_by = actor_user_id,
      invalidated_at = now(),
      invalidation_reason = trim(p_reason)
    where batch_id = before_batch.id
      and status = 'READY';
  end if;

  update public.qr_batches
  set
    status = 'CANCELLED',
    cancelled_by = actor_user_id,
    cancelled_at = now()
  where id = before_batch.id
  returning * into updated_batch;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type,
    resource_id, before_data, after_data, reason, request_id
  )
  values (
    updated_batch.tenant_id,
    updated_batch.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_CANCELLED',
    'QR_BATCH',
    updated_batch.id,
    jsonb_build_object(
      'batchStatus', before_batch.status::text,
      'batchVersion', before_batch.version,
      'quantity', before_batch.requested_quantity
    ),
    jsonb_build_object(
      'batchStatus', updated_batch.status::text,
      'batchVersion', updated_batch.version,
      'quantity', updated_batch.requested_quantity
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resourceId', updated_batch.id,
    'version', updated_batch.version,
    'relatedResourceId', null,
    'relatedVersion', null
  );
end;
$$;

revoke all on function public.create_sticker_design_version(
  uuid, integer, text, jsonb, text, uuid
) from public, anon;
revoke all on function public.approve_sticker_design_version(
  uuid, integer, text, uuid
) from public, anon;
revoke all on function public.archive_sticker_design_version(
  uuid, integer, text, uuid
) from public, anon;
revoke all on function public.request_qr_batch(
  uuid, integer, uuid, integer, integer, text, text, uuid, uuid
) from public, anon;
revoke all on function public.attach_qr_batch_sample(
  uuid, integer, text, text, text, text, integer, boolean, boolean, boolean, text, uuid
) from public, anon;
revoke all on function public.approve_qr_batch_sample(
  uuid, integer, uuid, integer, text, uuid
) from public, anon;
revoke all on function public.invalidate_qr_batch_sample(
  uuid, integer, uuid, integer, text, uuid
) from public, anon;
revoke all on function public.cancel_qr_batch(
  uuid, integer, text, uuid
) from public, anon;

grant execute on function public.create_sticker_design_version(
  uuid, integer, text, jsonb, text, uuid
) to authenticated;
grant execute on function public.approve_sticker_design_version(
  uuid, integer, text, uuid
) to authenticated;
grant execute on function public.archive_sticker_design_version(
  uuid, integer, text, uuid
) to authenticated;
grant execute on function public.request_qr_batch(
  uuid, integer, uuid, integer, integer, text, text, uuid, uuid
) to authenticated;
grant execute on function public.attach_qr_batch_sample(
  uuid, integer, text, text, text, text, integer, boolean, boolean, boolean, text, uuid
) to authenticated;
grant execute on function public.approve_qr_batch_sample(
  uuid, integer, uuid, integer, text, uuid
) to authenticated;
grant execute on function public.invalidate_qr_batch_sample(
  uuid, integer, uuid, integer, text, uuid
) to authenticated;
grant execute on function public.cancel_qr_batch(
  uuid, integer, text, uuid
) to authenticated;

comment on table public.sticker_design_versions is
  'Tenant/Site-owned immutable sticker design versions. No browser mutation privilege.';
comment on table public.qr_batches is
  'Tenant/Site-owned QR issuance requests. Sample approval does not start generation.';
comment on table public.qr_batch_samples is
  'Retained sample artifact metadata and quality evidence. Invalidated rows are terminal history.';
comment on table public.qr_assets is
  'Reserved QR inventory foundation. No issuance command exists in this slice.';
comment on table public.qr_asset_status_logs is
  'Append-only QR Asset lifecycle evidence.';

commit;
