-- Keep legacy pilot rows readable while enforcing the confirmed registration
-- contract for every new or corrected external management-company row.

begin;

alter table public.management_companies
  add constraint chk_management_companies_required_identity_v2
    check (
      deleted_at is not null
      or is_platform_direct
      or (
        nullif(trim(address), '') is not null
        and length(trim(address)) between 2 and 300
        and nullif(trim(business_number), '') is not null
        and business_number ~ '^[0-9]{10}$'
      )
    ) not valid,
  add constraint chk_management_companies_primary_contact_v2
    check (
      deleted_at is not null
      or is_platform_direct
      or (
        nullif(trim(contact_name), '') is not null
        and length(trim(contact_name)) between 1 and 100
        and (
          nullif(trim(contact_phone_encrypted), '') is not null
          or nullif(trim(contact_email), '') is not null
        )
      )
    ) not valid,
  add constraint chk_management_companies_operations_manager_completeness_v2
    check (
      deleted_at is not null
      or is_platform_direct
      or (
        (
          nullif(trim(operations_manager_name), '') is null
          and nullif(trim(operations_manager_phone_encrypted), '') is null
          and nullif(trim(operations_manager_email), '') is null
        )
        or (
          nullif(trim(operations_manager_name), '') is not null
          and (
            nullif(trim(operations_manager_phone_encrypted), '') is not null
            or nullif(trim(operations_manager_email), '') is not null
          )
        )
      )
    ) not valid;

comment on constraint chk_management_companies_required_identity_v2
  on public.management_companies is
  'External management companies require a base address and normalized business registration number. NOT VALID preserves legacy pilot rows while enforcing new writes.';

comment on constraint chk_management_companies_primary_contact_v2
  on public.management_companies is
  'External management companies require a primary contact name and at least one protected phone or email contact method.';

comment on constraint chk_management_companies_operations_manager_completeness_v2
  on public.management_companies is
  'Operations manager details are optional as a group; once started, a name and at least one protected phone or email contact method are required.';

commit;
