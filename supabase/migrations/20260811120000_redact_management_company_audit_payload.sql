-- Keep management-company audit records useful without persisting contact PII.
-- The audit payload safety constraint rejects phone-related keys, and raw
-- contact names/emails do not belong in the audit stream even when permitted.

begin;

do $migration$
declare
  definition text;
  original_definition text;
  company_alias text;
  target record;
begin
  for target in
    select *
    from (
      values
        (
          'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'
            ::regprocedure,
          array['created_company']::text[]
        ),
        (
          'public.update_management_company(uuid,integer,text,text,text,text,text,text,text,text,text,text,text,uuid)'
            ::regprocedure,
          array['before_company', 'updated_company']::text[]
        )
    ) as targets(signature, company_aliases)
  loop
    definition := pg_get_functiondef(target.signature);
    original_definition := definition;

    if position('''representativePhonePresent''' in definition) = 0 then
      raise exception using
        errcode = 'P0001',
        message = 'MANAGEMENT_COMPANY_AUDIT_PATCH_TARGET_MISSING';
    end if;

    definition := replace(
      definition,
      '''representativePhonePresent''',
      '''representativeContactConfigured'''
    );
    definition := replace(
      definition,
      '''contactPhonePresent''',
      '''primaryContactChannelConfigured'''
    );
    definition := replace(
      definition,
      '''operationsManagerPhonePresent''',
      '''operationsManagerContactConfigured'''
    );

    foreach company_alias in array target.company_aliases
    loop
      definition := replace(
        definition,
        format('''contactName'', %I.contact_name', company_alias),
        format(
          '''primaryContactNamePresent'', %I.contact_name is not null',
          company_alias
        )
      );
      definition := replace(
        definition,
        format('''contactEmail'', %I.contact_email', company_alias),
        format(
          '''primaryContactEmailPresent'', %I.contact_email is not null',
          company_alias
        )
      );
      definition := replace(
        definition,
        format('''operationsManagerName'', %I.operations_manager_name', company_alias),
        format(
          '''operationsManagerNamePresent'', %I.operations_manager_name is not null',
          company_alias
        )
      );
      definition := replace(
        definition,
        format('''operationsManagerEmail'', %I.operations_manager_email', company_alias),
        format(
          '''operationsManagerEmailPresent'', %I.operations_manager_email is not null',
          company_alias
        )
      );
    end loop;

    if definition = original_definition
      or position('''representativePhonePresent''' in definition) > 0
      or position('''contactPhonePresent''' in definition) > 0
      or position('''operationsManagerPhonePresent''' in definition) > 0
      or position('''contactName''' in definition) > 0
      or position('''contactEmail''' in definition) > 0
      or position('''operationsManagerName''' in definition) > 0
      or position('''operationsManagerEmail''' in definition) > 0
    then
      raise exception using
        errcode = 'P0001',
        message = 'MANAGEMENT_COMPANY_AUDIT_PATCH_FAILED';
    end if;

    execute definition;
  end loop;
end;
$migration$;

revoke all on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
)
from public, anon;
revoke all on function public.update_management_company(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, uuid
)
from public, anon;

grant execute on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
)
to authenticated, service_role;
grant execute on function public.update_management_company(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, uuid
)
to authenticated, service_role;

comment on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
) is
'Platform SUPER_ADMIN management-company registration with redacted, policy-safe audit metadata.';
comment on function public.update_management_company(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, uuid
) is
'Platform SUPER_ADMIN management-company update with redacted, policy-safe audit metadata.';

commit;
