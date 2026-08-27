begin;

create table public.revenue_pricing_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  monthly_unit_price_krw integer not null,
  effective_from date not null,
  effective_to date,
  status text not null default 'ACTIVE',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint fk_revenue_pricing_company
    foreign key (tenant_id, management_company_id)
    references public.management_companies (tenant_id, id) on delete restrict,
  constraint chk_revenue_pricing_amount
    check (monthly_unit_price_krw between 0 and 1000000),
  constraint chk_revenue_pricing_dates
    check (effective_to is null or effective_to >= effective_from),
  constraint chk_revenue_pricing_status
    check (status in ('ACTIVE', 'RETIRED'))
);

create unique index uq_revenue_pricing_active_company
on public.revenue_pricing_policies (management_company_id)
where status = 'ACTIVE';

create index idx_revenue_pricing_company_period
on public.revenue_pricing_policies (management_company_id, effective_from desc);

alter table public.revenue_pricing_policies enable row level security;
alter table public.revenue_pricing_policies force row level security;

revoke all on table public.revenue_pricing_policies from public, anon, authenticated;
grant select on table public.revenue_pricing_policies to authenticated;
grant all on table public.revenue_pricing_policies to service_role;

create policy revenue_pricing_select_scoped
on public.revenue_pricing_policies
for select to authenticated
using (
  exists (
    select 1 from public.sites as site
    where site.tenant_id = revenue_pricing_policies.tenant_id
      and site.management_company_id = revenue_pricing_policies.management_company_id
      and app_private.current_admin_has_site_scope(
        site.tenant_id,
        site.id,
        array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'READ_ONLY']
      )
  )
);

create trigger trg_revenue_pricing_touch
before update on public.revenue_pricing_policies
for each row execute function app_private.touch_versioned_row();

create or replace function public.set_management_company_monthly_unit_price(
  p_tenant_id uuid,
  p_management_company_id uuid,
  p_monthly_unit_price_krw integer,
  p_effective_from date,
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
  policy_id uuid;
begin
  if actor_user_id is null or not exists (
    select 1 from public.admin_memberships as membership
    join public.admin_profiles as profile on profile.user_id = membership.user_id
    where membership.user_id = actor_user_id
      and membership.role = 'SUPER_ADMIN'
      and membership.scope_type = 'PLATFORM'
      and membership.status = 'ACTIVE'
      and profile.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'REVENUE_PRICING_NOT_ALLOWED';
  end if;
  if p_monthly_unit_price_krw not between 0 and 1000000
    or p_effective_from is null
    or p_reason is null
    or length(trim(p_reason)) not between 3 and 500
    or p_request_id is null
    or not exists (
      select 1 from public.management_companies as company
      where company.tenant_id = p_tenant_id
        and company.id = p_management_company_id
        and company.deleted_at is null
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_REVENUE_PRICING';
  end if;

  update public.revenue_pricing_policies
  set status = 'RETIRED', effective_to = greatest(p_effective_from - 1, effective_from)
  where management_company_id = p_management_company_id and status = 'ACTIVE';

  insert into public.revenue_pricing_policies (
    tenant_id,
    management_company_id,
    monthly_unit_price_krw,
    effective_from,
    created_by
  ) values (
    p_tenant_id,
    p_management_company_id,
    p_monthly_unit_price_krw,
    p_effective_from,
    actor_user_id
  )
  returning id into policy_id;

  insert into public.audit_logs (
    tenant_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  ) values (
    p_tenant_id,
    'ADMIN',
    actor_user_id,
    'REVENUE_PRICING_POLICY_SET',
    'REVENUE_PRICING_POLICY',
    policy_id,
    jsonb_build_object(
      'managementCompanyId', p_management_company_id,
      'monthlyUnitPriceKrw', p_monthly_unit_price_krw,
      'effectiveFrom', p_effective_from
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object('id', policy_id, 'status', 'ACTIVE');
end;
$$;

create or replace function public.read_revenue_command_center()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'authenticated' or not exists (
    select 1 from public.admin_memberships as membership
    join public.admin_profiles as profile on profile.user_id = membership.user_id
    where membership.user_id = auth.uid()
      and membership.role in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
      and membership.scope_type = 'PLATFORM'
      and membership.status = 'ACTIVE'
      and profile.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'REVENUE_COMMAND_CENTER_NOT_ALLOWED';
  end if;

  with company_revenue as (
    select company.id,
      company.tenant_id,
      company.name,
      site_metric.site_count,
      qr_metric.active_qr_count,
      policy.monthly_unit_price_krw,
      (qr_metric.active_qr_count * coalesce(policy.monthly_unit_price_krw, 0))::bigint
        as projected_monthly_revenue_krw,
      batch_metric.completed_batch_count,
      batch_metric.produced_sticker_count
    from public.management_companies as company
    left join public.revenue_pricing_policies as policy
      on policy.tenant_id = company.tenant_id
      and policy.management_company_id = company.id
      and policy.status = 'ACTIVE'
      and current_date >= policy.effective_from
      and (policy.effective_to is null or current_date <= policy.effective_to)
    left join lateral (
      select count(*)::integer as site_count
      from public.sites as site
      where site.tenant_id = company.tenant_id
        and site.management_company_id = company.id
        and site.deleted_at is null
    ) as site_metric on true
    left join lateral (
      select count(*)::integer as active_qr_count
      from public.qr_assets as qr
      join public.sites as site
        on site.tenant_id = qr.tenant_id and site.id = qr.site_id
      where site.management_company_id = company.id and qr.status = 'ACTIVE'
    ) as qr_metric on true
    left join lateral (
      select count(*)::integer as completed_batch_count,
        coalesce(sum(batch.requested_quantity), 0)::bigint as produced_sticker_count
      from public.qr_batches as batch
      join public.sites as site
        on site.tenant_id = batch.tenant_id and site.id = batch.site_id
      where site.management_company_id = company.id
        and batch.status in ('GENERATED', 'QUALITY_CHECKED', 'PRINT_FILE_READY', 'COMPLETED')
    ) as batch_metric on true
    where company.deleted_at is null
  )
  select jsonb_build_object(
    'fresh_at', statement_timestamp(),
    'management_company_count', count(*)::integer,
    'site_count', coalesce(sum(site_count), 0)::integer,
    'active_qr_count', coalesce(sum(active_qr_count), 0)::integer,
    'priced_company_count', count(*) filter (where monthly_unit_price_krw is not null)::integer,
    'projected_monthly_revenue_krw', coalesce(sum(projected_monthly_revenue_krw), 0)::bigint,
    'completed_batch_count', coalesce(sum(completed_batch_count), 0)::integer,
    'produced_sticker_count', coalesce(sum(produced_sticker_count), 0)::bigint,
    'companies', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'tenant_id', tenant_id,
        'name', name,
        'site_count', site_count,
        'active_qr_count', active_qr_count,
        'monthly_unit_price_krw', monthly_unit_price_krw,
        'projected_monthly_revenue_krw', projected_monthly_revenue_krw,
        'completed_batch_count', completed_batch_count,
        'produced_sticker_count', produced_sticker_count
      ) order by projected_monthly_revenue_krw desc, name
    ), '[]'::jsonb)
  ) into result
  from company_revenue;

  return result;
end;
$$;

revoke all on function public.set_management_company_monthly_unit_price(
  uuid, uuid, integer, date, text, uuid
) from public, anon, authenticated;
grant execute on function public.set_management_company_monthly_unit_price(
  uuid, uuid, integer, date, text, uuid
) to authenticated;

revoke all on function public.read_revenue_command_center() from public, anon;
grant execute on function public.read_revenue_command_center() to authenticated;

commit;
