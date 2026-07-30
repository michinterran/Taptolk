begin;

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
        and site.is_test_fixture = false
    ) as site_metric on true
    left join lateral (
      select count(*)::integer as active_qr_count
      from public.qr_assets as qr
      join public.sites as site
        on site.tenant_id = qr.tenant_id and site.id = qr.site_id
      where site.management_company_id = company.id
        and site.is_test_fixture = false
        and qr.status = 'ACTIVE'
    ) as qr_metric on true
    left join lateral (
      select count(*)::integer as completed_batch_count,
        coalesce(sum(batch.requested_quantity), 0)::bigint as produced_sticker_count
      from public.qr_batches as batch
      join public.sites as site
        on site.tenant_id = batch.tenant_id and site.id = batch.site_id
      where site.management_company_id = company.id
        and site.is_test_fixture = false
        and batch.status in ('GENERATED', 'QUALITY_CHECKED', 'PRINT_FILE_READY', 'COMPLETED')
    ) as batch_metric on true
    where company.deleted_at is null
      and company.is_test_fixture = false
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

revoke all on function public.read_revenue_command_center() from public, anon;
grant execute on function public.read_revenue_command_center() to authenticated;

comment on function public.read_revenue_command_center() is
  'Returns platform revenue metrics from non-fixture management companies and sites only.';

commit;
