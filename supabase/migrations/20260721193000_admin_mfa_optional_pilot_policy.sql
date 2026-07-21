begin;

-- Pilot policy: MFA remains available for admin accounts, but it is not a
-- required authorization factor. Role, scope, active membership, RLS, and
-- redacted audit requirements remain unchanged.

create or replace function app_private.relax_admin_mfa_requirement(target_function regprocedure)
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
    E'\\n\\s*if coalesce\\(auth\\.jwt\\(\\) ->> ''aal'', ''''\\) <> ''aal2'' then\\s+raise exception using errcode = ''42501'', message = ''MFA_REQUIRED'';\\s+end if;',
    '',
    'g'
  );
  relaxed_definition := regexp_replace(
    relaxed_definition,
    E'\\n\\s*if actor_role = ''SUPER_ADMIN'' and coalesce\\(auth\\.jwt\\(\\) ->> ''aal'', ''''\\) <> ''aal2'' then\\s+raise exception using errcode = ''42501'', message = ''MFA_REQUIRED'';\\s+end if;',
    '',
    'g'
  );
  relaxed_definition := regexp_replace(
    relaxed_definition,
    E'\\n\\s*if actor_role in \\(''SUPER_ADMIN'', ''MANAGEMENT_ADMIN'', ''SITE_ADMIN''\\)\\s+and coalesce\\(auth\\.jwt\\(\\) ->> ''aal'', ''''\\) <> ''aal2''\\s+then\\s+raise exception using errcode = ''42501'', message = ''MFA_REQUIRED'';\\s+end if;',
    '',
    'g'
  );

  if relaxed_definition <> original_definition then
    execute relaxed_definition;
  end if;
end;
$$;

select app_private.relax_admin_mfa_requirement(function_name)
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

drop function app_private.relax_admin_mfa_requirement(regprocedure);

drop policy if exists admin_profiles_select_platform_super_admin
on public.admin_profiles;

create policy admin_profiles_select_platform_super_admin
on public.admin_profiles
for select
to authenticated
using (
  app_private.current_admin_has_scope(
    null,
    null,
    null,
    array['SUPER_ADMIN']
  )
);

comment on policy admin_profiles_select_platform_super_admin
on public.admin_profiles is
  'Allows an active platform Super Admin to review profile status while the Auth directory remains server-only. MFA is optional during the pilot.';

commit;
