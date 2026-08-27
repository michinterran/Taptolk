begin;

create type public.tenant_status as enum ('ACTIVE', 'SUSPENDED', 'CLOSED');
create type public.organization_status as enum ('ACTIVE', 'SUSPENDED', 'CLOSED');
create type public.site_type as enum ('APARTMENT', 'OFFICETEL', 'BUILDING', 'OTHER');
create type public.contract_status as enum (
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'TERMINATED'
);
create type public.billing_basis as enum (
  'ACTIVE_VEHICLE',
  'CONTRACTED_VEHICLE',
  'FLAT'
);
create type public.admin_profile_status as enum (
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED'
);
create type public.admin_role as enum (
  'SUPER_ADMIN',
  'PLATFORM_OPERATOR',
  'MANAGEMENT_ADMIN',
  'SITE_ADMIN',
  'SITE_OPERATOR',
  'READ_ONLY'
);
create type public.admin_scope_type as enum (
  'PLATFORM',
  'TENANT',
  'MANAGEMENT_COMPANY',
  'SITE'
);
create type public.admin_membership_status as enum (
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED'
);
create type public.audit_actor_type as enum (
  'ADMIN',
  'OWNER',
  'CALLER',
  'SYSTEM',
  'WORKER'
);

create or replace function app_private.touch_versioned_row()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create or replace function app_private.audit_payload_is_safe(payload jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    payload is null
    or (
      jsonb_typeof(payload) = 'object'
      and not exists (
        select 1
        from jsonb_object_keys(payload) as payload_key
        where payload_key ~* '(authorization|cookie|phone|message|otp|token|secret|password|api.?key)'
      )
    );
$$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status public.tenant_status not null default 'ACTIVE',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  constraint uq_tenants_tenant_id unique (id),
  constraint chk_tenants_name check (length(trim(name)) between 1 and 200),
  constraint chk_tenants_slug check (slug ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'),
  constraint chk_tenants_settings_object check (jsonb_typeof(settings) = 'object')
);

create unique index uq_tenants_active_slug
on public.tenants (lower(slug))
where deleted_at is null;

create table public.management_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  business_number text,
  status public.organization_status not null default 'ACTIVE',
  contact_name text,
  contact_phone_encrypted text,
  billing_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  constraint fk_management_companies_tenant
    foreign key (tenant_id) references public.tenants (id) on delete restrict,
  constraint uq_management_companies_tenant_id unique (tenant_id, id),
  constraint chk_management_companies_name
    check (length(trim(name)) between 1 and 200)
);

create index idx_management_companies_tenant_status
on public.management_companies (tenant_id, status);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  name text not null,
  site_type public.site_type not null default 'APARTMENT',
  address text,
  timezone text not null default 'Asia/Seoul',
  contract_vehicle_limit integer not null default 0,
  status public.organization_status not null default 'ACTIVE',
  escalation_phone_encrypted text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  constraint fk_sites_tenant_management_company
    foreign key (tenant_id, management_company_id)
    references public.management_companies (tenant_id, id)
    on delete restrict,
  constraint uq_sites_tenant_management_id
    unique (tenant_id, management_company_id, id),
  constraint uq_sites_tenant_id unique (tenant_id, id),
  constraint chk_sites_name check (length(trim(name)) between 1 and 200),
  constraint chk_sites_vehicle_limit check (contract_vehicle_limit >= 0),
  constraint chk_sites_settings_object check (jsonb_typeof(settings) = 'object')
);

create index idx_sites_tenant_status on public.sites (tenant_id, status);
create index idx_sites_management_status
on public.sites (management_company_id, status);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid,
  plan_code text not null,
  start_date date not null,
  end_date date,
  minimum_vehicle_count integer not null default 0,
  billing_basis public.billing_basis not null,
  status public.contract_status not null default 'DRAFT',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  constraint fk_contracts_tenant_management_company
    foreign key (tenant_id, management_company_id)
    references public.management_companies (tenant_id, id)
    on delete restrict,
  constraint fk_contracts_tenant_management_site
    foreign key (tenant_id, management_company_id, site_id)
    references public.sites (tenant_id, management_company_id, id)
    on delete restrict,
  constraint chk_contracts_date_range check (end_date is null or end_date >= start_date),
  constraint chk_contracts_minimum_vehicle_count check (minimum_vehicle_count >= 0),
  constraint chk_contracts_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index idx_contracts_tenant_status on public.contracts (tenant_id, status);

create table public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  status public.admin_profile_status not null default 'INVITED',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint chk_admin_profiles_display_name
    check (length(trim(display_name)) between 1 and 100)
);

create table public.admin_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete restrict,
  management_company_id uuid,
  site_id uuid,
  role public.admin_role not null,
  scope_type public.admin_scope_type not null,
  status public.admin_membership_status not null default 'INVITED',
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_admin_memberships_tenant_management_company
    foreign key (tenant_id, management_company_id)
    references public.management_companies (tenant_id, id)
    on delete restrict,
  constraint fk_admin_memberships_tenant_management_site
    foreign key (tenant_id, management_company_id, site_id)
    references public.sites (tenant_id, management_company_id, id)
    on delete restrict,
  constraint chk_admin_memberships_role_scope check (
    (
      role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
      and scope_type = 'PLATFORM'
      and tenant_id is null
      and management_company_id is null
      and site_id is null
    )
    or (
      role = 'MANAGEMENT_ADMIN'
      and scope_type = 'MANAGEMENT_COMPANY'
      and tenant_id is not null
      and management_company_id is not null
      and site_id is null
    )
    or (
      role in ('SITE_ADMIN', 'SITE_OPERATOR')
      and scope_type = 'SITE'
      and tenant_id is not null
      and management_company_id is not null
      and site_id is not null
    )
    or (
      role = 'READ_ONLY'
      and (
        (
          scope_type = 'TENANT'
          and tenant_id is not null
          and management_company_id is null
          and site_id is null
        )
        or (
          scope_type = 'MANAGEMENT_COMPANY'
          and tenant_id is not null
          and management_company_id is not null
          and site_id is null
        )
        or (
          scope_type = 'SITE'
          and tenant_id is not null
          and management_company_id is not null
          and site_id is not null
        )
      )
    )
  )
);

create unique index uq_admin_memberships_user_scope
on public.admin_memberships (
  user_id,
  scope_type,
  coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(management_company_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
  role
);

create index idx_admin_memberships_user_status
on public.admin_memberships (user_id, status);
create index idx_admin_memberships_tenant_scope
on public.admin_memberships (
  tenant_id,
  management_company_id,
  site_id,
  status
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete restrict,
  site_id uuid,
  actor_type public.audit_actor_type not null,
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint fk_audit_logs_tenant_site
    foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id)
    on delete restrict,
  constraint chk_audit_logs_redacted_payload check (
    app_private.audit_payload_is_safe(before_data)
    and app_private.audit_payload_is_safe(after_data)
  )
);

create index idx_audit_logs_tenant_created
on public.audit_logs (tenant_id, created_at desc);
create index idx_audit_logs_request on public.audit_logs (request_id);
create index idx_audit_logs_resource
on public.audit_logs (resource_type, resource_id);

create trigger trg_tenants_touch
before update on public.tenants
for each row execute function app_private.touch_versioned_row();

create trigger trg_management_companies_touch
before update on public.management_companies
for each row execute function app_private.touch_versioned_row();

create trigger trg_sites_touch
before update on public.sites
for each row execute function app_private.touch_versioned_row();

create trigger trg_contracts_touch
before update on public.contracts
for each row execute function app_private.touch_versioned_row();

create trigger trg_admin_profiles_touch
before update on public.admin_profiles
for each row execute function app_private.touch_versioned_row();

create trigger trg_admin_memberships_touch
before update on public.admin_memberships
for each row execute function app_private.touch_versioned_row();

create or replace function app_private.current_admin_has_scope(
  target_tenant_id uuid,
  target_management_company_id uuid,
  target_site_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.admin_memberships as membership
    where membership.user_id = auth.uid()
      and membership.status = 'ACTIVE'
      and membership.role::text = any(allowed_roles)
      and (
        membership.scope_type = 'PLATFORM'
        or (
          target_tenant_id is not null
          and membership.tenant_id = target_tenant_id
          and (
            membership.scope_type = 'TENANT'
            or (
              membership.scope_type = 'MANAGEMENT_COMPANY'
              and target_management_company_id is not null
              and membership.management_company_id = target_management_company_id
            )
            or (
              membership.scope_type = 'SITE'
              and target_site_id is not null
              and membership.site_id = target_site_id
            )
          )
        )
      )
  );
$$;

alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.management_companies enable row level security;
alter table public.management_companies force row level security;
alter table public.sites enable row level security;
alter table public.sites force row level security;
alter table public.contracts enable row level security;
alter table public.contracts force row level security;
alter table public.admin_profiles enable row level security;
alter table public.admin_profiles force row level security;
alter table public.admin_memberships enable row level security;
alter table public.admin_memberships force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

revoke all on table
  public.tenants,
  public.management_companies,
  public.sites,
  public.contracts,
  public.admin_profiles,
  public.admin_memberships,
  public.audit_logs
from anon;

grant usage on schema app_private to authenticated, service_role;
revoke all on function app_private.touch_versioned_row() from public, anon, authenticated;
revoke all on function app_private.audit_payload_is_safe(jsonb) from public, anon;
revoke all on function app_private.current_admin_has_scope(uuid, uuid, uuid, text[])
from public, anon;
grant execute on function app_private.current_admin_has_scope(uuid, uuid, uuid, text[])
to authenticated, service_role;
grant execute on function app_private.audit_payload_is_safe(jsonb)
to authenticated, service_role;

grant select, insert, update on public.tenants to authenticated;
grant select, insert, update on public.management_companies to authenticated;
grant select, insert, update on public.sites to authenticated;
grant select, insert, update on public.contracts to authenticated;
grant select, update on public.admin_profiles to authenticated;
grant select, insert, update on public.admin_memberships to authenticated;
grant select on public.audit_logs to authenticated;

create policy tenants_select_scoped
on public.tenants
for select
to authenticated
using (
  app_private.current_admin_has_scope(
    id,
    null,
    null,
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

create policy tenants_insert_platform
on public.tenants
for insert
to authenticated
with check (
  app_private.current_admin_has_scope(
    null,
    null,
    null,
    array['SUPER_ADMIN']
  )
);

create policy tenants_update_platform
on public.tenants
for update
to authenticated
using (
  app_private.current_admin_has_scope(
    id,
    null,
    null,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR']
  )
)
with check (
  app_private.current_admin_has_scope(
    id,
    null,
    null,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR']
  )
);

create policy management_companies_select_scoped
on public.management_companies
for select
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    id,
    null,
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

create policy management_companies_insert_platform
on public.management_companies
for insert
to authenticated
with check (
  app_private.current_admin_has_scope(
    tenant_id,
    id,
    null,
    array['SUPER_ADMIN']
  )
);

create policy management_companies_update_platform
on public.management_companies
for update
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    id,
    null,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR']
  )
)
with check (
  app_private.current_admin_has_scope(
    tenant_id,
    id,
    null,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR']
  )
);

create policy sites_select_scoped
on public.sites
for select
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    id,
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

create policy sites_insert_scoped
on public.sites
for insert
to authenticated
with check (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN']
  )
);

create policy sites_update_scoped
on public.sites
for update
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
)
with check (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
);

create policy contracts_select_scoped
on public.contracts
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

create policy contracts_mutate_scoped
on public.contracts
for all
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN']
  )
)
with check (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN']
  )
);

create policy admin_profiles_select_self
on public.admin_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy admin_profiles_update_self
on public.admin_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy admin_memberships_select_scoped
on public.admin_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
);

create policy admin_memberships_insert_scoped
on public.admin_memberships
for insert
to authenticated
with check (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
);

create policy admin_memberships_update_scoped
on public.admin_memberships
for update
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
)
with check (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN']
  )
);

create policy audit_logs_select_scoped
on public.audit_logs
for select
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    null,
    site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN', 'READ_ONLY']
  )
);

comment on function app_private.current_admin_has_scope(uuid, uuid, uuid, text[]) is
  'RLS helper owned by the database. Uses a fixed search_path and bypasses membership RLS recursion.';
comment on table public.audit_logs is
  'Append-only server audit events. Browser roles have SELECT only.';

commit;
