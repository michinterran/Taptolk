-- Enforce the minimum operational identity required when a Management Company
-- is first registered. Existing records and the update command remain
-- compatible so incomplete pilot data can be corrected without fabricating it.

begin;

do $migration$
declare
  definition text;
  patched_definition text;
  validation_anchor constant text := $anchor$  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
$anchor$;
  required_registration_validation constant text := $validation$  if normalized_address is null then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
  end if;
  if normalized_business_number is null then
    raise exception using errcode = '22023', message = 'INVALID_BUSINESS_NUMBER';
  end if;
  if normalized_contact_name is null then
    raise exception using errcode = '22023', message = 'INVALID_CONTACT_NAME';
  end if;
  if normalized_contact_email is null
    and nullif(trim(coalesce(p_contact_phone_encrypted, '')), '') is null
  then
    raise exception using errcode = '22023', message = 'INVALID_CONTACT_CHANNEL';
  end if;
  if (
    normalized_operations_manager_name is not null
    or normalized_operations_manager_email is not null
    or nullif(trim(coalesce(p_operations_manager_phone_encrypted, '')), '') is not null
  ) then
    if normalized_operations_manager_name is null then
      raise exception using errcode = '22023', message = 'INVALID_OPERATIONS_MANAGER_NAME';
    end if;
    if normalized_operations_manager_email is null
      and nullif(trim(coalesce(p_operations_manager_phone_encrypted, '')), '') is null
    then
      raise exception using
        errcode = '22023',
        message = 'INVALID_OPERATIONS_MANAGER_CHANNEL';
    end if;
  end if;
$validation$;
  target_function constant regprocedure :=
    'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'
      ::regprocedure;
begin
  definition := pg_get_functiondef(target_function);

  if position(validation_anchor in definition) = 0
    or position('INVALID_CONTACT_CHANNEL' in definition) > 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'MANAGEMENT_COMPANY_REQUIRED_FIELDS_PATCH_TARGET_MISSING';
  end if;

  patched_definition := replace(
    definition,
    validation_anchor,
    required_registration_validation || validation_anchor
  );

  if patched_definition = definition
    or position('INVALID_CONTACT_CHANNEL' in patched_definition) = 0
    or position('INVALID_OPERATIONS_MANAGER_CHANNEL' in patched_definition) = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'MANAGEMENT_COMPANY_REQUIRED_FIELDS_PATCH_FAILED';
  end if;

  execute patched_definition;
end;
$migration$;

revoke all on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
)
from public, anon;

grant execute on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
)
to authenticated, service_role;

comment on function public.create_management_company(
  text, text, text, text, text, text, text, text, text, text, text, uuid
) is
'Platform SUPER_ADMIN registration with required company identity, primary contact, optional complete operations-manager group, and redacted audit metadata.';

commit;
