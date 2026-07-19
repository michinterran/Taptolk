begin;

select plan(15);

select policies_are(
  'public',
  'tenants',
  array['tenants_select_scoped'],
  'Tenant table exposes only the scoped read policy'
);

select has_function(
  'public',
  'create_tenant',
  array['text', 'text', 'text', 'uuid'],
  'atomic Tenant creation command exists'
);

select has_function(
  'public',
  'update_tenant',
  array['uuid', 'integer', 'text', 'text', 'text', 'uuid'],
  'atomic Tenant update command exists'
);

select has_function(
  'public',
  'change_tenant_status',
  array['uuid', 'integer', 'tenant_status', 'text', 'uuid'],
  'atomic Tenant lifecycle command exists'
);

select is_definer(
  'public',
  'create_tenant',
  array['text', 'text', 'text', 'uuid'],
  'creation can write Tenant and append-only audit in one transaction'
);

select is_definer(
  'public',
  'update_tenant',
  array['uuid', 'integer', 'text', 'text', 'text', 'uuid'],
  'update can write Tenant and append-only audit in one transaction'
);

select is_definer(
  'public',
  'change_tenant_status',
  array['uuid', 'integer', 'tenant_status', 'text', 'uuid'],
  'status change can write Tenant and append-only audit in one transaction'
);

select function_privs_are(
  'public',
  'create_tenant',
  array['text', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot create Tenants'
);

select function_privs_are(
  'public',
  'update_tenant',
  array['uuid', 'integer', 'text', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot update Tenants'
);

select function_privs_are(
  'public',
  'change_tenant_status',
  array['uuid', 'integer', 'tenant_status', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot change Tenant lifecycle'
);

select function_privs_are(
  'public',
  'create_tenant',
  array['text', 'text', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions enter creation where AAL2 and Super Admin are rechecked'
);

select function_privs_are(
  'public',
  'update_tenant',
  array['uuid', 'integer', 'text', 'text', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions enter update where AAL2 and Super Admin are rechecked'
);

select function_privs_are(
  'public',
  'change_tenant_status',
  array['uuid', 'integer', 'tenant_status', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions enter lifecycle command where actor is rechecked'
);

select table_privs_are(
  'public',
  'tenants',
  'authenticated',
  array['SELECT'],
  'authenticated sessions cannot mutate Tenant rows directly'
);

select table_privs_are(
  'public',
  'audit_logs',
  'authenticated',
  array['SELECT'],
  'authenticated sessions cannot forge Tenant audit rows'
);

select * from finish();

rollback;
