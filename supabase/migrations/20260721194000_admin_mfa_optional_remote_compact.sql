begin;

-- Follow-up for staging functions whose definitions were compacted before this
-- policy change. MFA remains optional; role, scope, active membership, RLS, and
-- audit requirements remain intact.

create or replace function app_private.relax_compact_admin_mfa_requirement(
  target_function regprocedure
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  original_definition text;
  relaxed_definition text;
begin
  original_definition := pg_get_functiondef(target_function);
  relaxed_definition := original_definition;

  relaxed_definition := regexp_replace(
    relaxed_definition,
    E'\\s*if\\s+coalesce\\(auth\\.jwt\\(\\)\\s*->>\\s*''aal''\\s*,\\s*''''\\)\\s*<>\\s*''aal2''\\s+then\\s+raise exception using errcode\\s*=\\s*''42501''\\s*,\\s*message\\s*=\\s*''MFA_REQUIRED''\\s*;\\s*end if\\s*;',
    '',
    'g'
  );
  relaxed_definition := regexp_replace(
    relaxed_definition,
    E'\\s*if\\s+actor_role\\s*=\\s*''SUPER_ADMIN''\\s+and\\s+coalesce\\(auth\\.jwt\\(\\)\\s*->>\\s*''aal''\\s*,\\s*''''\\)\\s*<>\\s*''aal2''\\s+then\\s+raise exception using errcode\\s*=\\s*''42501''\\s*,\\s*message\\s*=\\s*''MFA_REQUIRED''\\s*;\\s*end if\\s*;',
    '',
    'g'
  );
  relaxed_definition := regexp_replace(
    relaxed_definition,
    E'\\s*if\\s+actor_role\\s+in\\s+\\(''SUPER_ADMIN'',\\s*''MANAGEMENT_ADMIN'',\\s*''SITE_ADMIN''\\)\\s+and\\s+coalesce\\(auth\\.jwt\\(\\)\\s*->>\\s*''aal''\\s*,\\s*''''\\)\\s*<>\\s*''aal2''\\s+then\\s+raise exception using errcode\\s*=\\s*''42501''\\s*,\\s*message\\s*=\\s*''MFA_REQUIRED''\\s*;\\s*end if\\s*;',
    '',
    'g'
  );

  if relaxed_definition <> original_definition then
    execute relaxed_definition;
  end if;
end;
$$;

select app_private.relax_compact_admin_mfa_requirement(function_name)
from (
  values
    ('public.approve_admin_account(uuid,text,public.admin_role,public.admin_scope_type,uuid,uuid,uuid,text,uuid)'::regprocedure),
    ('public.reject_admin_account(uuid,text,text,uuid)'::regprocedure),
    ('public.create_tenant(text,text,text,uuid)'::regprocedure),
    ('public.update_tenant(uuid,integer,text,text,text,uuid)'::regprocedure),
    ('public.change_tenant_status(uuid,integer,public.tenant_status,text,uuid)'::regprocedure),
    ('public.create_management_company(uuid,text,text,text,uuid)'::regprocedure),
    ('public.update_management_company(uuid,integer,text,text,text,uuid)'::regprocedure),
    ('public.change_management_company_status(uuid,integer,public.organization_status,text,uuid)'::regprocedure),
    ('public.create_site(uuid,uuid,text,public.site_type,text,text,integer,text,uuid)'::regprocedure),
    ('public.update_site_operational(uuid,integer,text,public.site_type,text,text,text,uuid)'::regprocedure),
    ('public.update_site_contract(uuid,integer,integer,text,uuid)'::regprocedure),
    ('public.change_site_status(uuid,integer,public.organization_status,text,uuid)'::regprocedure),
    ('public.request_site_lifecycle(uuid,integer,public.site_lifecycle_action,text,uuid)'::regprocedure),
    ('public.approve_site_lifecycle_request(uuid,integer,text,uuid)'::regprocedure),
    ('public.reject_site_lifecycle_request(uuid,integer,text,uuid)'::regprocedure),
    ('public.cancel_site_lifecycle_request(uuid,integer,text,uuid)'::regprocedure),
    ('app_private.assert_qr_inventory_actor(uuid,uuid,uuid,text[])'::regprocedure)
) as target(function_name);

drop function app_private.relax_compact_admin_mfa_requirement(regprocedure);

commit;
