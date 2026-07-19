begin;

drop function public.cleanup_public_contact_contract_staging_fixture(uuid, uuid);

create function public.cleanup_public_contact_contract_staging_fixture(
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

revoke all on function public.cleanup_public_contact_contract_staging_fixture(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.cleanup_public_contact_contract_staging_fixture(uuid, uuid)
to service_role;

comment on function public.cleanup_public_contact_contract_staging_fixture(uuid, uuid) is
  'Deletes only one labeled public-contact E2E contract in an E2E tenant.';

commit;
