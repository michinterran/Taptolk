begin;

create type public.site_lifecycle_action as enum (
  'SUSPEND',
  'REACTIVATE',
  'CLOSE'
);

create type public.site_lifecycle_request_status as enum (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

create table public.site_lifecycle_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid not null,
  action public.site_lifecycle_action not null,
  status public.site_lifecycle_request_status not null default 'PENDING',
  requested_site_version integer not null,
  requested_by uuid not null references auth.users (id) on delete restrict,
  request_reason text not null,
  reviewed_by uuid references auth.users (id) on delete restrict,
  review_reason text,
  reviewed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_site_lifecycle_requests_site
    foreign key (tenant_id, management_company_id, site_id)
    references public.sites (tenant_id, management_company_id, id)
    on delete restrict,
  constraint chk_site_lifecycle_requests_site_version
    check (requested_site_version >= 1),
  constraint chk_site_lifecycle_requests_request_reason
    check (length(trim(request_reason)) between 3 and 500),
  constraint chk_site_lifecycle_requests_review_reason
    check (
      review_reason is null
      or length(trim(review_reason)) between 3 and 500
    ),
  constraint chk_site_lifecycle_requests_state_metadata check (
    (
      status = 'PENDING'
      and reviewed_by is null
      and review_reason is null
      and reviewed_at is null
      and cancelled_at is null
    )
    or (
      status in ('APPROVED', 'REJECTED')
      and reviewed_by is not null
      and review_reason is not null
      and reviewed_at is not null
      and cancelled_at is null
      and requested_by <> reviewed_by
    )
    or (
      status = 'CANCELLED'
      and reviewed_by is null
      and review_reason is null
      and reviewed_at is null
      and cancelled_at is not null
    )
  )
);

create index idx_site_lifecycle_requests_tenant_status_created
on public.site_lifecycle_requests (tenant_id, status, created_at desc);

create index idx_site_lifecycle_requests_site_status_created
on public.site_lifecycle_requests (site_id, status, created_at desc);

create unique index uq_site_lifecycle_requests_pending_site
on public.site_lifecycle_requests (site_id)
where status = 'PENDING';

create or replace function app_private.guard_site_lifecycle_request_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status <> 'PENDING' then
    raise exception using errcode = '23514', message = 'REQUEST_TERMINAL';
  end if;
  if new.id <> old.id
    or new.tenant_id <> old.tenant_id
    or new.management_company_id <> old.management_company_id
    or new.site_id <> old.site_id
    or new.action <> old.action
    or new.requested_site_version <> old.requested_site_version
    or new.requested_by <> old.requested_by
    or new.request_reason <> old.request_reason
    or new.created_at <> old.created_at
  then
    raise exception using errcode = '23514', message = 'REQUEST_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger trg_site_lifecycle_requests_guard
before update on public.site_lifecycle_requests
for each row execute function app_private.guard_site_lifecycle_request_update();

create trigger trg_site_lifecycle_requests_touch
before update on public.site_lifecycle_requests
for each row execute function app_private.touch_versioned_row();

alter table public.site_lifecycle_requests enable row level security;
alter table public.site_lifecycle_requests force row level security;

revoke all on table public.site_lifecycle_requests from public, anon, authenticated;
grant select on table public.site_lifecycle_requests to authenticated;
grant select, delete on table public.site_lifecycle_requests to service_role;

revoke all on function app_private.guard_site_lifecycle_request_update()
from public, anon, authenticated;

create policy site_lifecycle_requests_select_scoped
on public.site_lifecycle_requests
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

create or replace function public.request_site_lifecycle(
  p_site_id uuid,
  p_expected_site_version integer,
  p_action public.site_lifecycle_action,
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
  actor_role public.admin_role;
  target_site public.sites%rowtype;
  created_request public.site_lifecycle_requests%rowtype;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_site_id is null then
    raise exception using errcode = '22023', message = 'INVALID_SITE_ID';
  end if;
  if p_expected_site_version is null or p_expected_site_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_action is null then
    raise exception using errcode = '22023', message = 'INVALID_ACTION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  select candidate.*
  into target_site
  from public.sites as candidate
  where candidate.id = p_site_id
    and candidate.deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'SITE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if target_site.version <> p_expected_site_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  select membership.role
  into actor_role
  from public.admin_memberships as membership
  where membership.user_id = actor_user_id
    and membership.status = 'ACTIVE'
    and (
      (
        p_action in ('SUSPEND', 'REACTIVATE')
        and membership.role in ('SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'SITE_ADMIN')
      )
      or (
        p_action = 'CLOSE'
        and membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN')
      )
    )
    and (
      (
        membership.scope_type = 'PLATFORM'
        and membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
      )
      or (
        membership.scope_type = 'MANAGEMENT_COMPANY'
        and membership.tenant_id = target_site.tenant_id
        and membership.management_company_id = target_site.management_company_id
      )
      or (
        membership.scope_type = 'SITE'
        and membership.tenant_id = target_site.tenant_id
        and membership.management_company_id = target_site.management_company_id
        and membership.site_id = target_site.id
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
    raise exception using errcode = '42501', message = 'SITE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if actor_role in ('SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'SITE_ADMIN')
    and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
  then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  if not (
    (p_action = 'SUSPEND' and target_site.status = 'ACTIVE')
    or (p_action = 'REACTIVATE' and target_site.status = 'SUSPENDED')
    or (p_action = 'CLOSE' and target_site.status in ('ACTIVE', 'SUSPENDED'))
  ) then
    raise exception using errcode = '22023', message = 'INVALID_STATUS_TRANSITION';
  end if;

  insert into public.site_lifecycle_requests (
    tenant_id,
    management_company_id,
    site_id,
    action,
    requested_site_version,
    requested_by,
    request_reason
  )
  values (
    target_site.tenant_id,
    target_site.management_company_id,
    target_site.id,
    p_action,
    target_site.version,
    actor_user_id,
    trim(p_reason)
  )
  returning * into created_request;

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
    created_request.tenant_id,
    created_request.site_id,
    'ADMIN',
    actor_user_id,
    'SITE_LIFECYCLE_REQUESTED',
    'SITE_LIFECYCLE_REQUEST',
    created_request.id,
    jsonb_build_object(
      'action', created_request.action::text,
      'requestStatus', created_request.status::text,
      'requestVersion', created_request.version,
      'siteVersion', created_request.requested_site_version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'requestId', created_request.id,
    'requestVersion', created_request.version,
    'siteId', created_request.site_id,
    'siteVersion', null
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'PENDING_REQUEST_EXISTS';
end;
$$;

create or replace function public.approve_site_lifecycle_request(
  p_lifecycle_request_id uuid,
  p_expected_request_version integer,
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
  actor_role public.admin_role;
  before_request public.site_lifecycle_requests%rowtype;
  before_site public.sites%rowtype;
  updated_request public.site_lifecycle_requests%rowtype;
  updated_site public.sites%rowtype;
  next_status public.organization_status;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_lifecycle_request_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;
  if p_expected_request_version is null or p_expected_request_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_request
  from public.site_lifecycle_requests as candidate
  where candidate.id = p_lifecycle_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_request.status <> 'PENDING' then
    raise exception using errcode = '40001', message = 'REQUEST_TERMINAL';
  end if;
  if before_request.version <> p_expected_request_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_request.requested_by = actor_user_id then
    raise exception using errcode = '42501', message = 'SELF_REVIEW_FORBIDDEN';
  end if;

  select membership.role
  into actor_role
  from public.admin_memberships as membership
  where membership.user_id = actor_user_id
    and membership.status = 'ACTIVE'
    and membership.scope_type = 'PLATFORM'
    and (
      (
        before_request.action in ('SUSPEND', 'REACTIVATE')
        and membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
      )
      or (
        before_request.action = 'CLOSE'
        and membership.role = 'SUPER_ADMIN'
      )
    )
  order by case membership.role
    when 'SUPER_ADMIN' then 1
    when 'PLATFORM_OPERATOR' then 2
    else 99
  end
  limit 1;

  if actor_role is null then
    raise exception using errcode = '42501', message = 'REQUEST_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if actor_role = 'SUPER_ADMIN' and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;

  select candidate.*
  into before_site
  from public.sites as candidate
  where candidate.id = before_request.site_id
    and candidate.tenant_id = before_request.tenant_id
    and candidate.management_company_id = before_request.management_company_id
    and candidate.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SITE_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_site.version <> before_request.requested_site_version then
    raise exception using errcode = '40001', message = 'SITE_VERSION_CONFLICT';
  end if;
  if not (
    (before_request.action = 'SUSPEND' and before_site.status = 'ACTIVE')
    or (before_request.action = 'REACTIVATE' and before_site.status = 'SUSPENDED')
    or (before_request.action = 'CLOSE' and before_site.status in ('ACTIVE', 'SUSPENDED'))
  ) then
    raise exception using errcode = '22023', message = 'INVALID_STATUS_TRANSITION';
  end if;

  next_status := case before_request.action
    when 'SUSPEND' then 'SUSPENDED'::public.organization_status
    when 'REACTIVATE' then 'ACTIVE'::public.organization_status
    when 'CLOSE' then 'CLOSED'::public.organization_status
  end;

  if next_status = 'ACTIVE' and not exists (
    select 1
    from public.management_companies as parent_company
    join public.tenants as parent_tenant
      on parent_tenant.id = parent_company.tenant_id
    where parent_company.id = before_site.management_company_id
      and parent_company.tenant_id = before_site.tenant_id
      and parent_company.status = 'ACTIVE'
      and parent_company.deleted_at is null
      and parent_tenant.status = 'ACTIVE'
      and parent_tenant.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'PARENT_NOT_ACTIVE';
  end if;
  if next_status = 'CLOSED' and exists (
    select 1
    from public.contracts as active_contract
    where active_contract.tenant_id = before_site.tenant_id
      and active_contract.management_company_id = before_site.management_company_id
      and active_contract.site_id = before_site.id
      and active_contract.status = 'ACTIVE'
      and active_contract.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'ACTIVE_CONTRACT_EXISTS';
  end if;

  update public.sites
  set status = next_status
  where id = before_site.id
    and version = before_request.requested_site_version
    and deleted_at is null
  returning * into updated_site;

  if not found then
    raise exception using errcode = '40001', message = 'SITE_VERSION_CONFLICT';
  end if;

  update public.site_lifecycle_requests
  set
    status = 'APPROVED',
    reviewed_by = actor_user_id,
    review_reason = trim(p_reason),
    reviewed_at = now()
  where id = before_request.id
    and status = 'PENDING'
    and version = p_expected_request_version
  returning * into updated_request;

  if not found then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    before_data,
    after_data,
    reason,
    request_id
  )
  values (
    updated_request.tenant_id,
    updated_request.site_id,
    'ADMIN',
    actor_user_id,
    'SITE_LIFECYCLE_REQUEST_APPROVED',
    'SITE_LIFECYCLE_REQUEST',
    updated_request.id,
    jsonb_build_object(
      'action', before_request.action::text,
      'requestStatus', before_request.status::text,
      'requestVersion', before_request.version,
      'siteStatus', before_site.status::text,
      'siteVersion', before_site.version
    ),
    jsonb_build_object(
      'action', updated_request.action::text,
      'requestStatus', updated_request.status::text,
      'requestVersion', updated_request.version,
      'siteStatus', updated_site.status::text,
      'siteVersion', updated_site.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'requestId', updated_request.id,
    'requestVersion', updated_request.version,
    'siteId', updated_site.id,
    'siteVersion', updated_site.version
  );
end;
$$;

create or replace function public.reject_site_lifecycle_request(
  p_lifecycle_request_id uuid,
  p_expected_request_version integer,
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
  actor_role public.admin_role;
  before_request public.site_lifecycle_requests%rowtype;
  updated_request public.site_lifecycle_requests%rowtype;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_lifecycle_request_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;
  if p_expected_request_version is null or p_expected_request_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_request
  from public.site_lifecycle_requests as candidate
  where candidate.id = p_lifecycle_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_request.status <> 'PENDING' then
    raise exception using errcode = '40001', message = 'REQUEST_TERMINAL';
  end if;
  if before_request.version <> p_expected_request_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if before_request.requested_by = actor_user_id then
    raise exception using errcode = '42501', message = 'SELF_REVIEW_FORBIDDEN';
  end if;

  select membership.role
  into actor_role
  from public.admin_memberships as membership
  where membership.user_id = actor_user_id
    and membership.status = 'ACTIVE'
    and membership.scope_type = 'PLATFORM'
    and (
      (
        before_request.action in ('SUSPEND', 'REACTIVATE')
        and membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
      )
      or (
        before_request.action = 'CLOSE'
        and membership.role = 'SUPER_ADMIN'
      )
    )
  order by case membership.role
    when 'SUPER_ADMIN' then 1
    when 'PLATFORM_OPERATOR' then 2
    else 99
  end
  limit 1;

  if actor_role is null then
    raise exception using errcode = '42501', message = 'REQUEST_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if actor_role = 'SUPER_ADMIN' and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;

  update public.site_lifecycle_requests
  set
    status = 'REJECTED',
    reviewed_by = actor_user_id,
    review_reason = trim(p_reason),
    reviewed_at = now()
  where id = before_request.id
    and status = 'PENDING'
    and version = p_expected_request_version
  returning * into updated_request;

  if not found then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    before_data,
    after_data,
    reason,
    request_id
  )
  values (
    updated_request.tenant_id,
    updated_request.site_id,
    'ADMIN',
    actor_user_id,
    'SITE_LIFECYCLE_REQUEST_REJECTED',
    'SITE_LIFECYCLE_REQUEST',
    updated_request.id,
    jsonb_build_object(
      'action', before_request.action::text,
      'requestStatus', before_request.status::text,
      'requestVersion', before_request.version
    ),
    jsonb_build_object(
      'action', updated_request.action::text,
      'requestStatus', updated_request.status::text,
      'requestVersion', updated_request.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'requestId', updated_request.id,
    'requestVersion', updated_request.version,
    'siteId', updated_request.site_id,
    'siteVersion', null
  );
end;
$$;

create or replace function public.cancel_site_lifecycle_request(
  p_lifecycle_request_id uuid,
  p_expected_request_version integer,
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
  actor_role public.admin_role;
  before_request public.site_lifecycle_requests%rowtype;
  updated_request public.site_lifecycle_requests%rowtype;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_lifecycle_request_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;
  if p_expected_request_version is null or p_expected_request_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select candidate.*
  into before_request
  from public.site_lifecycle_requests as candidate
  where candidate.id = p_lifecycle_request_id
  for update;

  if not found or before_request.requested_by <> actor_user_id then
    raise exception using errcode = '42501', message = 'REQUEST_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if before_request.status <> 'PENDING' then
    raise exception using errcode = '40001', message = 'REQUEST_TERMINAL';
  end if;
  if before_request.version <> p_expected_request_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  select membership.role
  into actor_role
  from public.admin_memberships as membership
  where membership.user_id = actor_user_id
    and membership.status = 'ACTIVE'
    and (
      (
        before_request.action in ('SUSPEND', 'REACTIVATE')
        and membership.role in ('SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'SITE_ADMIN')
      )
      or (
        before_request.action = 'CLOSE'
        and membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN')
      )
    )
    and (
      (
        membership.scope_type = 'PLATFORM'
        and membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
      )
      or (
        membership.scope_type = 'MANAGEMENT_COMPANY'
        and membership.tenant_id = before_request.tenant_id
        and membership.management_company_id = before_request.management_company_id
      )
      or (
        membership.scope_type = 'SITE'
        and membership.tenant_id = before_request.tenant_id
        and membership.management_company_id = before_request.management_company_id
        and membership.site_id = before_request.site_id
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
    raise exception using errcode = '42501', message = 'REQUEST_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if actor_role in ('SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'SITE_ADMIN')
    and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
  then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;

  update public.site_lifecycle_requests
  set
    status = 'CANCELLED',
    cancelled_at = now()
  where id = before_request.id
    and status = 'PENDING'
    and version = p_expected_request_version
  returning * into updated_request;

  if not found then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    before_data,
    after_data,
    reason,
    request_id
  )
  values (
    updated_request.tenant_id,
    updated_request.site_id,
    'ADMIN',
    actor_user_id,
    'SITE_LIFECYCLE_REQUEST_CANCELLED',
    'SITE_LIFECYCLE_REQUEST',
    updated_request.id,
    jsonb_build_object(
      'action', before_request.action::text,
      'requestStatus', before_request.status::text,
      'requestVersion', before_request.version
    ),
    jsonb_build_object(
      'action', updated_request.action::text,
      'requestStatus', updated_request.status::text,
      'requestVersion', updated_request.version
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'requestId', updated_request.id,
    'requestVersion', updated_request.version,
    'siteId', updated_request.site_id,
    'siteVersion', null
  );
end;
$$;

revoke all on function public.request_site_lifecycle(
  uuid,
  integer,
  public.site_lifecycle_action,
  text,
  uuid
) from public, anon;
revoke all on function public.approve_site_lifecycle_request(uuid, integer, text, uuid)
from public, anon;
revoke all on function public.reject_site_lifecycle_request(uuid, integer, text, uuid)
from public, anon;
revoke all on function public.cancel_site_lifecycle_request(uuid, integer, text, uuid)
from public, anon;

grant execute on function public.request_site_lifecycle(
  uuid,
  integer,
  public.site_lifecycle_action,
  text,
  uuid
) to authenticated, service_role;
grant execute on function public.approve_site_lifecycle_request(uuid, integer, text, uuid)
to authenticated, service_role;
grant execute on function public.reject_site_lifecycle_request(uuid, integer, text, uuid)
to authenticated, service_role;
grant execute on function public.cancel_site_lifecycle_request(uuid, integer, text, uuid)
to authenticated, service_role;

comment on table public.site_lifecycle_requests is
  'Tenant-scoped maker-checker history for Site suspend, reactivate, and close requests.';
comment on function public.approve_site_lifecycle_request(uuid, integer, text, uuid) is
  'Atomically revalidates maker-checker, Site version, lifecycle policy, request state, and audit.';

commit;
