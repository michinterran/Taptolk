begin;

select plan(15);

select policies_are(
  'public',
  'management_companies',
  array['management_companies_select_scoped'],
  'Management Company exposes only scoped read policy'
);

select has_function(
  'public',
  'create_management_company',
  array['uuid', 'text', 'text', 'text', 'uuid'],
  'atomic Management Company create command exists'
);

select has_function(
  'public',
  'update_management_company',
  array['uuid', 'integer', 'text', 'text', 'text', 'uuid'],
  'atomic Management Company update command exists'
);

select has_function(
  'public',
  'change_management_company_status',
  array['uuid', 'integer', 'organization_status', 'text', 'uuid'],
  'atomic Management Company lifecycle command exists'
);

select is_definer(
  'public',
  'create_management_company',
  array['uuid', 'text', 'text', 'text', 'uuid'],
  'create command atomically writes company and audit'
);

select is_definer(
  'public',
  'update_management_company',
  array['uuid', 'integer', 'text', 'text', 'text', 'uuid'],
  'update command atomically writes company and audit'
);

select is_definer(
  'public',
  'change_management_company_status',
  array['uuid', 'integer', 'organization_status', 'text', 'uuid'],
  'lifecycle command atomically writes company and audit'
);

select function_privs_are(
  'public',
  'create_management_company',
  array['uuid', 'text', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot create Management Companies'
);

select function_privs_are(
  'public',
  'update_management_company',
  array['uuid', 'integer', 'text', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot update Management Companies'
);

select function_privs_are(
  'public',
  'change_management_company_status',
  array['uuid', 'integer', 'organization_status', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot change company lifecycle'
);

select function_privs_are(
  'public',
  'create_management_company',
  array['uuid', 'text', 'text', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions enter create where actor is rechecked'
);

select function_privs_are(
  'public',
  'update_management_company',
  array['uuid', 'integer', 'text', 'text', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions enter update where actor is rechecked'
);

select function_privs_are(
  'public',
  'change_management_company_status',
  array['uuid', 'integer', 'organization_status', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions enter lifecycle where actor is rechecked'
);

select table_privs_are(
  'public',
  'management_companies',
  'authenticated',
  array['SELECT'],
  'authenticated sessions cannot directly mutate Management Companies'
);

select has_index(
  'public',
  'management_companies',
  'uq_management_companies_active_business_number',
  'active business number is unique inside a Tenant'
);

select * from finish();

rollback;
