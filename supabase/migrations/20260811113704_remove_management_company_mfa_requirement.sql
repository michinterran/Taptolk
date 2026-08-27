-- Restore the approved optional-MFA pilot policy for management-company commands.
-- The later operating-contact migration recreated these functions with an AAL2
-- gate. Keep the original migrations immutable and patch only the current
-- signatures while preserving their platform SUPER_ADMIN authorization checks.

begin;

do $migration$
declare
  definition text;
  patched_definition text;
  target_function regprocedure;
begin
  for target_function in
    select target.signature
    from (
      values
        (
          'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'
            ::regprocedure
        ),
        (
          'public.update_management_company(uuid,integer,text,text,text,text,text,text,text,text,text,text,text,uuid)'
            ::regprocedure
        )
    ) as target(signature)
  loop
    definition := pg_get_functiondef(target_function);

    if position('MFA_REQUIRED' in definition) = 0 then
      raise exception using
        errcode = 'P0001',
        message = 'MANAGEMENT_COMPANY_MFA_PATCH_TARGET_MISSING';
    end if;

    patched_definition := regexp_replace(
      definition,
      E'\\s*if\\s+coalesce\\(auth\\.jwt\\(\\)\\s*->>\\s*''aal''\\s*,\\s*''''\\)\\s*<>\\s*''aal2''\\s+then\\s+raise exception using errcode\\s*=\\s*''42501''\\s*,\\s*message\\s*=\\s*''MFA_REQUIRED''\\s*;\\s*end if\\s*;',
      E'\n',
      'gi'
    );

    if patched_definition = definition
      or position('MFA_REQUIRED' in patched_definition) > 0
    then
      raise exception using
        errcode = 'P0001',
        message = 'MANAGEMENT_COMPANY_MFA_PATCH_FAILED';
    end if;

    execute patched_definition;
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
'Platform SUPER_ADMIN management-company registration with server-side role validation and no MFA dependency during the approved pilot.';
comment on function public.update_management_company(
  uuid, integer, text, text, text, text, text, text, text, text, text, text, text, uuid
) is
'Platform SUPER_ADMIN management-company update with server-side role validation and no MFA dependency during the approved pilot.';

commit;
