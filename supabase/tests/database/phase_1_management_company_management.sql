begin;

select plan(28);

select policies_are(
  'public',
  'management_companies',
  array['management_companies_select_scoped'],
  'Management Company exposes only scoped read policy'
);

select has_function(
  'public',
  'create_management_company',
  array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid'],
  'atomic Management Company registration command exists'
);

select has_function(
  'public',
  'update_management_company',
  array['uuid', 'integer', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid'],
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
  array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid'],
  'registration command atomically writes tenant, company and audit'
);

select is_definer(
  'public',
  'update_management_company',
  array['uuid', 'integer', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid'],
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
  array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot create Management Companies'
);

select function_privs_are(
  'public',
  'update_management_company',
  array['uuid', 'integer', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid'],
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
  array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions enter create where actor is rechecked'
);

select function_privs_are(
  'public',
  'update_management_company',
  array['uuid', 'integer', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'uuid'],
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

select has_column(
  'public',
  'tenants',
  'is_test_fixture',
  'Tenants can mark deterministic E2E fixture data'
);

select has_column(
  'public',
  'management_companies',
  'management_code',
  'Management Companies store a separate operator management code'
);

select has_column(
  'public',
  'management_companies',
  'address',
  'Management Companies store an operating address'
);

select has_column(
  'public',
  'management_companies',
  'representative_phone_encrypted',
  'Management Companies store an encrypted representative operating phone'
);

select has_column(
  'public',
  'management_companies',
  'contact_email',
  'Management Companies store a primary operating contact email'
);

select has_column(
  'public',
  'management_companies',
  'operations_manager_name',
  'Management Companies store an operations manager name'
);

select has_column(
  'public',
  'management_companies',
  'operations_manager_phone_encrypted',
  'Management Companies store an encrypted operations manager phone'
);

select has_column(
  'public',
  'management_companies',
  'operations_manager_email',
  'Management Companies store an operations manager email'
);

select has_column(
  'public',
  'management_companies',
  'is_test_fixture',
  'Management Companies can be hidden from operator catalogs by fixture flag'
);

select has_column(
  'public',
  'sites',
  'management_code',
  'Sites store a separate operator management code'
);

select has_column(
  'public',
  'sites',
  'is_test_fixture',
  'Sites can be hidden from operator catalogs by fixture flag'
);

select has_index(
  'public',
  'management_companies',
  'uq_management_companies_active_management_code',
  'active management code is unique inside a Tenant'
);

select has_index(
  'public',
  'sites',
  'uq_sites_active_management_code',
  'active site management code is unique inside a Management Company'
);

select * from finish();

rollback;
