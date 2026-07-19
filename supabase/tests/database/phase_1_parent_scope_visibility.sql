begin;

select plan(8);

select has_function(
  'app_private',
  'current_admin_can_read_tenant',
  array['uuid', 'text[]'],
  'tenant parent visibility helper exists'
);

select has_function(
  'app_private',
  'current_admin_can_read_management_company',
  array['uuid', 'uuid', 'text[]'],
  'management-company parent visibility helper exists'
);

select is_definer(
  'app_private',
  'current_admin_can_read_tenant',
  array['uuid', 'text[]'],
  'tenant parent visibility avoids recursive membership RLS'
);

select is_definer(
  'app_private',
  'current_admin_can_read_management_company',
  array['uuid', 'uuid', 'text[]'],
  'management-company parent visibility avoids recursive membership RLS'
);

select policies_are(
  'public',
  'tenants',
  array['tenants_select_scoped'],
  'Tenant table remains scoped read-only while mutations stay RPC-only'
);

select policies_are(
  'public',
  'management_companies',
  array['management_companies_select_scoped'],
  'Management Company table remains scoped read-only while mutations stay RPC-only'
);

select function_privs_are(
  'app_private',
  'current_admin_can_read_tenant',
  array['uuid', 'text[]'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot call the Tenant parent helper'
);

select function_privs_are(
  'app_private',
  'current_admin_can_read_management_company',
  array['uuid', 'uuid', 'text[]'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot call the Management Company parent helper'
);

select * from finish();

rollback;
