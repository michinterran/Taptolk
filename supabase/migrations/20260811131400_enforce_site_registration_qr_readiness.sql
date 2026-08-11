-- Active Sites are immediately operational in the current lifecycle model.
-- Keep legacy pilot rows readable, but require every new or corrected Site to
-- carry the identity and contract capacity needed before QR issuance.

begin;

alter table public.sites
  add constraint chk_sites_required_operating_address_v2
    check (
      deleted_at is not null
      or (
        nullif(trim(address), '') is not null
        and length(trim(address)) between 2 and 500
      )
    ) not valid,
  add constraint chk_sites_required_contract_capacity_v2
    check (
      deleted_at is not null
      or contract_vehicle_limit between 1 and 1000000
    ) not valid,
  add constraint chk_sites_required_timezone_v2
    check (
      deleted_at is not null
      or length(trim(timezone)) between 1 and 64
    ) not valid;

comment on constraint chk_sites_required_operating_address_v2 on public.sites is
  'Active Site registration requires a base operating address. Address detail remains optional and is stored only when supplied. NOT VALID preserves legacy pilot rows while enforcing new writes.';

comment on constraint chk_sites_required_contract_capacity_v2 on public.sites is
  'Active Site registration requires a positive contracted vehicle capacity before QR issuance. QR orders may still exceed this value only through the separately audited over-contract workflow.';

comment on constraint chk_sites_required_timezone_v2 on public.sites is
  'Site timezone is system-managed and must remain a non-empty IANA timezone value.';

create or replace function app_private.assert_site_registration_parent_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_company public.management_companies%rowtype;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select company.*
  into parent_company
  from public.management_companies as company
  where company.id = new.management_company_id
    and company.tenant_id = new.tenant_id;

  if not found then
    return new;
  end if;

  if not parent_company.is_platform_direct
    and (
      nullif(trim(parent_company.address), '') is null
      or nullif(trim(parent_company.business_number), '') is null
      or parent_company.business_number !~ '^[0-9]{10}$'
      or nullif(trim(parent_company.contact_name), '') is null
      or (
        nullif(trim(parent_company.contact_phone_encrypted), '') is null
        and nullif(trim(parent_company.contact_email), '') is null
      )
    )
  then
    raise exception using errcode = '23514', message = 'MANAGEMENT_COMPANY_PROFILE_INCOMPLETE';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sites_registration_parent_ready on public.sites;
create trigger trg_sites_registration_parent_ready
before insert or update of tenant_id, management_company_id, deleted_at on public.sites
for each row execute function app_private.assert_site_registration_parent_ready();

create or replace function app_private.assert_direct_qr_site_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_site public.sites%rowtype;
begin
  select site.*
  into target_site
  from public.sites as site
  where site.id = new.site_id
    and site.tenant_id = new.tenant_id
    and site.management_company_id = new.management_company_id;

  if not found
    or target_site.status <> 'ACTIVE'
    or target_site.deleted_at is not null
    or nullif(trim(target_site.address), '') is null
    or target_site.contract_vehicle_limit < 1
    or length(trim(target_site.timezone)) < 1
  then
    raise exception using errcode = 'P0001', message = 'SITE_QR_PROFILE_INCOMPLETE';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_qr_direct_generation_site_ready
  on public.qr_direct_generation_requests;
create trigger trg_qr_direct_generation_site_ready
before insert on public.qr_direct_generation_requests
for each row execute function app_private.assert_direct_qr_site_ready();

revoke all on function app_private.assert_site_registration_parent_ready() from public;
revoke all on function app_private.assert_direct_qr_site_ready() from public;

comment on function app_private.assert_site_registration_parent_ready() is
  'Prevents a legacy incomplete external management-company profile from receiving a new Site.';

comment on function app_private.assert_direct_qr_site_ready() is
  'Fail-closed QR readiness gate: the opaque QR token never embeds Site address or customer contact data.';

commit;
