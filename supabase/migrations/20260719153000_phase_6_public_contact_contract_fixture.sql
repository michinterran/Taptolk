begin;

create or replace function public.provision_public_contact_contract_staging_fixture(
  p_tenant_id uuid,
  p_management_company_id uuid,
  p_site_id uuid,
  p_fixture_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  contract_id uuid := gen_random_uuid();
  normalized_label text := upper(trim(coalesce(p_fixture_label, '')));
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if normalized_label !~ '^PC-[A-Z0-9]{8,24}$'
    or not exists (
      select 1
      from public.tenants as tenant
      join public.management_companies as company
        on company.tenant_id = tenant.id and company.id = p_management_company_id
      join public.sites as site
        on site.tenant_id = tenant.id
        and site.management_company_id = company.id
        and site.id = p_site_id
      where tenant.id = p_tenant_id
        and tenant.slug like 'e2e-%'
        and tenant.name like 'Taptolk E2E % Tenant %'
        and tenant.status = 'ACTIVE'
        and company.status = 'ACTIVE'
        and site.status = 'ACTIVE'
    )
  then
    raise exception using errcode = '42501', message = 'PUBLIC_CONTACT_CONTRACT_SCOPE_REQUIRED';
  end if;
  if exists (
    select 1 from public.contracts
    where tenant_id = p_tenant_id
      and site_id = p_site_id
      and plan_code = 'PUBLIC_CONTACT_E2E'
  ) then
    raise exception using errcode = '23505', message = 'PUBLIC_CONTACT_CONTRACT_EXISTS';
  end if;

  insert into public.contracts (
    id, tenant_id, management_company_id, site_id, plan_code,
    start_date, billing_basis, status, metadata
  )
  values (
    contract_id, p_tenant_id, p_management_company_id, p_site_id,
    'PUBLIC_CONTACT_E2E', current_date, 'FLAT', 'ACTIVE',
    jsonb_build_object('fixtureLabel', normalized_label)
  );
  return contract_id;
end;
$$;

create or replace function public.cleanup_public_contact_contract_staging_fixture(
  p_tenant_id uuid,
  p_contract_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.contracts as contract
    join public.tenants as tenant on tenant.id = contract.tenant_id
    where contract.id = p_contract_id
      and contract.tenant_id = p_tenant_id
      and contract.plan_code = 'PUBLIC_CONTACT_E2E'
      and contract.metadata ->> 'fixtureLabel' ~ '^PC-[A-Z0-9]{8,24}$'
      and tenant.slug like 'e2e-%'
      and tenant.name like 'Taptolk E2E % Tenant %'
  ) then
    raise exception using errcode = '42501', message = 'PUBLIC_CONTACT_CONTRACT_SCOPE_REQUIRED';
  end if;
  delete from public.contracts
  where id = p_contract_id and tenant_id = p_tenant_id;
  return jsonb_build_object('contract_count', 1);
end;
$$;

revoke all on function public.provision_public_contact_contract_staging_fixture(
  uuid, uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.cleanup_public_contact_contract_staging_fixture(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.provision_public_contact_contract_staging_fixture(
  uuid, uuid, uuid, text
) to service_role;
grant execute on function public.cleanup_public_contact_contract_staging_fixture(uuid, uuid)
to service_role;

comment on function public.provision_public_contact_contract_staging_fixture(
  uuid, uuid, uuid, text
) is 'Creates one exact active E2E contract required by public contact availability.';
comment on function public.cleanup_public_contact_contract_staging_fixture(uuid, uuid) is
  'Deletes only one labeled public-contact E2E contract in an E2E tenant.';

commit;
