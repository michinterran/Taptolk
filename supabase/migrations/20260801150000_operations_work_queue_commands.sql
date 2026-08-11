begin;

create table public.operations_work_queue_overrides (
  item_id uuid primary key,
  item_kind text not null,
  source text not null,
  source_id uuid not null,
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid not null,
  state text not null default 'WAITING',
  assignee_membership_id uuid references public.admin_memberships (id) on delete restrict,
  priority text,
  sla_due_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint uq_operations_work_queue_override_source unique (item_kind, source, source_id),
  constraint fk_operations_work_queue_override_site
    foreign key (tenant_id, management_company_id, site_id)
    references public.sites (tenant_id, management_company_id, id)
    on delete restrict,
  constraint chk_operations_work_queue_override_kind check (
    item_kind in (
      'CONTACT_REQUEST', 'UNANSWERED_CONTACT', 'NOTIFICATION_FAILURE',
      'ESCALATION', 'REPORT_REVIEW'
    )
  ),
  constraint chk_operations_work_queue_override_source check (
    source in ('CONTACT_SESSIONS', 'NOTIFICATION_DELIVERIES', 'CONTACT_REPORTS')
  ),
  constraint chk_operations_work_queue_override_state check (
    state in ('WAITING', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'RETRY_PENDING')
  ),
  constraint chk_operations_work_queue_override_priority check (
    priority is null or priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')
  ),
  constraint chk_operations_work_queue_override_version check (version >= 1)
);

create index idx_operations_work_queue_overrides_site_state
on public.operations_work_queue_overrides (tenant_id, site_id, state, updated_at desc);

alter table public.operations_work_queue_overrides enable row level security;
alter table public.operations_work_queue_overrides force row level security;
revoke all on table public.operations_work_queue_overrides from public, anon, authenticated;
grant all on table public.operations_work_queue_overrides to service_role;

create or replace function public.read_operations_work_queue_with_state(
  p_management_company_id uuid default null,
  p_site_id uuid default null,
  p_limit integer default 50,
  p_cursor text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base_result jsonb;
begin
  base_result := public.read_operations_work_queue(
    p_management_company_id,
    p_site_id,
    p_limit,
    p_cursor
  );

  return jsonb_build_object(
    'as_of', base_result -> 'as_of',
    'has_more', base_result -> 'has_more',
    'items', coalesce(
      (
        select jsonb_agg(
          item.value || jsonb_build_object(
            'id', md5(
              (item.value ->> 'kind') || ':' ||
              (item.value ->> 'source') || ':' ||
              (item.value ->> 'id')
            )::uuid,
            'queue_state', coalesce(override.state, 'WAITING'),
            'version', coalesce(override.version, 1),
            'assignee_display_name', profile.display_name,
            'priority', override.priority,
            'sla', override.sla_due_at
          )
          order by item.value ->> 'created_at' desc, item.value ->> 'id' desc
        )
        from jsonb_array_elements(coalesce(base_result -> 'items', '[]'::jsonb)) as item(value)
        left join public.operations_work_queue_overrides as override
          on override.item_id = md5(
            (item.value ->> 'kind') || ':' ||
            (item.value ->> 'source') || ':' ||
            (item.value ->> 'id')
          )::uuid
        left join public.admin_memberships as membership
          on membership.id = override.assignee_membership_id
        left join public.admin_profiles as profile
          on profile.user_id = membership.user_id
      ),
      '[]'::jsonb
    ),
    'next_cursor', base_result -> 'next_cursor'
  );
end;
$$;

create or replace function public.mutate_operations_work_queue(
  p_item_id uuid,
  p_item_kind text,
  p_action text,
  p_expected_version integer,
  p_assignee_membership_id uuid default null,
  p_reason text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  current_override public.operations_work_queue_overrides%rowtype;
  target_assignee uuid;
  next_state text;
  current_version integer;
begin
  if auth.role() <> 'authenticated'
    or p_item_id is null
    or p_item_kind not in (
      'CONTACT_REQUEST', 'UNANSWERED_CONTACT', 'NOTIFICATION_FAILURE',
      'ESCALATION', 'REPORT_REVIEW'
    )
    or p_action not in ('ACKNOWLEDGE', 'ASSIGN', 'START', 'RESOLVE', 'RETRY')
    or p_expected_version < 1
    or p_request_id is null
    or length(trim(coalesce(p_reason, ''))) not between 3 and 500
  then
    raise exception using errcode = '42501', message = 'OPERATIONS_WORK_QUEUE_MUTATION_NOT_ALLOWED';
  end if;

  next_state := case p_action
    when 'ACKNOWLEDGE' then 'ACKNOWLEDGED'
    when 'ASSIGN' then 'ASSIGNED'
    when 'START' then 'IN_PROGRESS'
    when 'RESOLVE' then 'RESOLVED'
    when 'RETRY' then 'RETRY_PENDING'
  end;

  with visible_sites as materialized (
    select site.tenant_id, site.id as site_id, site.management_company_id
    from public.sites as site
    join public.management_companies as company
      on company.tenant_id = site.tenant_id and company.id = site.management_company_id
    join public.tenants as tenant on tenant.id = site.tenant_id
    where site.deleted_at is null
      and company.deleted_at is null
      and tenant.deleted_at is null
      and site.is_test_fixture = false
      and company.is_test_fixture = false
      and tenant.is_test_fixture = false
      and app_private.current_admin_has_site_scope(
        site.tenant_id, site.id,
        array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN', 'SITE_OPERATOR']
      )
  ), candidates as (
    select
      md5('CONTACT_REQUEST:CONTACT_SESSIONS:' || session.id::text)::uuid as item_id,
      'CONTACT_REQUEST'::text as item_kind,
      'CONTACT_SESSIONS'::text as source,
      session.id as source_id,
      site.tenant_id, site.management_company_id, site.site_id
    from public.contact_sessions as session
    join visible_sites as site on site.tenant_id = session.tenant_id and site.site_id = session.site_id
    where session.status in ('CREATED', 'MESSAGE_SUBMITTED', 'NOTIFICATION_QUEUED')

    union all
    select
      md5('UNANSWERED_CONTACT:CONTACT_SESSIONS:' || session.id::text)::uuid,
      'UNANSWERED_CONTACT', 'CONTACT_SESSIONS', session.id,
      site.tenant_id, site.management_company_id, site.site_id
    from public.contact_sessions as session
    join visible_sites as site on site.tenant_id = session.tenant_id and site.site_id = session.site_id
    where session.status in ('OWNER_NOTIFIED', 'OWNER_VIEWED', 'CALLER_VIEWED')
      and session.owner_replied_at is null

    union all
    select
      md5('ESCALATION:CONTACT_SESSIONS:' || session.id::text)::uuid,
      'ESCALATION', 'CONTACT_SESSIONS', session.id,
      site.tenant_id, site.management_company_id, site.site_id
    from public.contact_sessions as session
    join visible_sites as site on site.tenant_id = session.tenant_id and site.site_id = session.site_id
    where session.status = 'ESCALATED'

    union all
    select
      md5('NOTIFICATION_FAILURE:NOTIFICATION_DELIVERIES:' || delivery.id::text)::uuid,
      'NOTIFICATION_FAILURE', 'NOTIFICATION_DELIVERIES', delivery.id,
      site.tenant_id, site.management_company_id, site.site_id
    from public.notification_deliveries as delivery
    join visible_sites as site on site.tenant_id = delivery.tenant_id and site.site_id = delivery.site_id
    where delivery.purpose <> 'OTP'
      and delivery.status in ('FAILED_RETRYABLE', 'FAILED_FINAL')

    union all
    select
      md5('REPORT_REVIEW:CONTACT_REPORTS:' || report.id::text)::uuid,
      'REPORT_REVIEW', 'CONTACT_REPORTS', report.id,
      site.tenant_id, site.management_company_id, site.site_id
    from public.contact_reports as report
    join visible_sites as site on site.tenant_id = report.tenant_id and site.site_id = report.site_id
    where report.status = 'OPEN'
  )
  select * into target
  from candidates
  where item_id = p_item_id and item_kind = p_item_kind
  limit 1;

  if target.item_id is null then
    raise exception using errcode = '42501', message = 'OPERATIONS_WORK_QUEUE_ITEM_NOT_ALLOWED';
  end if;

  select * into current_override
  from public.operations_work_queue_overrides
  where item_id = target.item_id
  for update;
  current_version := coalesce(current_override.version, 1);
  if current_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'OPERATIONS_WORK_QUEUE_VERSION_CONFLICT';
  end if;

  if p_action = 'ASSIGN' then
    if p_assignee_membership_id is null then
      select membership.id into target_assignee
      from public.admin_memberships as membership
      where membership.user_id = auth.uid()
        and membership.status = 'ACTIVE'
        and (
          (membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR') and membership.scope_type = 'PLATFORM')
          or (membership.role = 'MANAGEMENT_ADMIN'
            and membership.tenant_id = target.tenant_id
            and membership.management_company_id = target.management_company_id)
          or (membership.role in ('SITE_ADMIN', 'SITE_OPERATOR')
            and membership.tenant_id = target.tenant_id
            and membership.management_company_id = target.management_company_id
            and membership.site_id = target.site_id)
        )
      order by membership.created_at
      limit 1;
    else
      select membership.id into target_assignee
      from public.admin_memberships as membership
      where membership.id = p_assignee_membership_id
        and membership.status = 'ACTIVE'
        and (
          (membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR') and membership.scope_type = 'PLATFORM')
          or (membership.role = 'MANAGEMENT_ADMIN'
            and membership.tenant_id = target.tenant_id
            and membership.management_company_id = target.management_company_id)
          or (membership.role in ('SITE_ADMIN', 'SITE_OPERATOR')
            and membership.tenant_id = target.tenant_id
            and membership.management_company_id = target.management_company_id
            and membership.site_id = target.site_id)
        );
    end if;
    if target_assignee is null then
      raise exception using errcode = '42501', message = 'OPERATIONS_WORK_QUEUE_ASSIGNEE_NOT_ALLOWED';
    end if;
  end if;

  insert into public.operations_work_queue_overrides (
    item_id, item_kind, source, source_id, tenant_id, management_company_id, site_id,
    state, assignee_membership_id, version
  )
  values (
    target.item_id, target.item_kind, target.source, target.source_id,
    target.tenant_id, target.management_company_id, target.site_id,
    next_state,
    case when p_action = 'ASSIGN' then target_assignee else current_override.assignee_membership_id end,
    current_version + 1
  )
  on conflict (item_id) do update set
    state = excluded.state,
    assignee_membership_id = excluded.assignee_membership_id,
    version = public.operations_work_queue_overrides.version + 1,
    updated_at = statement_timestamp();

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type, resource_id,
    before_data, after_data, reason, request_id
  )
  values (
    target.tenant_id, target.site_id, 'ADMIN', auth.uid(), 'OPERATIONS_WORK_ITEM_UPDATED',
    'OPERATIONS_WORK_ITEM', target.item_id,
    jsonb_build_object(
      'state', coalesce(current_override.state, 'WAITING'),
      'has_assignee', current_override.assignee_membership_id is not null
    ),
    jsonb_build_object(
      'state', next_state,
      'has_assignee', (case when p_action = 'ASSIGN' then target_assignee else current_override.assignee_membership_id end) is not null
    ),
    trim(p_reason), p_request_id
  );

  return jsonb_build_object('item_id', target.item_id, 'state', next_state, 'version', current_version + 1);
end;
$$;

revoke all on function public.read_operations_work_queue_with_state(uuid, uuid, integer, text)
from public, anon;
grant execute on function public.read_operations_work_queue_with_state(uuid, uuid, integer, text)
to authenticated;
revoke all on function public.mutate_operations_work_queue(uuid, text, text, integer, uuid, text, uuid)
from public, anon;
grant execute on function public.mutate_operations_work_queue(uuid, text, text, integer, uuid, text, uuid)
to authenticated;

comment on table public.operations_work_queue_overrides is
  'Redacted operator workflow overlay. Source contact, notification, and report rows remain immutable here; no phone, message, OTP, token, or provider data is stored.';
comment on function public.read_operations_work_queue_with_state(uuid, uuid, integer, text) is
  'Reads source-backed operations work items with the redacted operator state overlay.';
comment on function public.mutate_operations_work_queue(uuid, text, text, integer, uuid, text, uuid) is
  'Atomically records scoped operator work state or self/explicit assignment with optimistic versioning and redacted audit.';

commit;
