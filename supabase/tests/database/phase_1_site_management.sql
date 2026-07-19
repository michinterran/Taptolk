begin;

select plan(15);

select policies_are(
  'public',
  'sites',
  array['sites_select_scoped'],
  'Site exposes only scoped read policy'
);

select has_function(
  'public',
  'create_site',
  array['uuid', 'uuid', 'text', 'site_type', 'text', 'text', 'integer', 'text', 'uuid'],
  'atomic Site create command exists'
);

select has_function(
  'public',
  'update_site_operational',
  array['uuid', 'integer', 'text', 'site_type', 'text', 'text', 'text', 'uuid'],
  'atomic Site operational update command exists'
);

select has_function(
  'public',
  'update_site_contract',
  array['uuid', 'integer', 'integer', 'text', 'uuid'],
  'atomic Site contract limit command exists'
);

select has_function(
  'public',
  'change_site_status',
  array['uuid', 'integer', 'organization_status', 'text', 'uuid'],
  'atomic Site lifecycle command exists'
);

select is_definer(
  'public',
  'create_site',
  array['uuid', 'uuid', 'text', 'site_type', 'text', 'text', 'integer', 'text', 'uuid'],
  'create command atomically writes Site and audit'
);

select is_definer(
  'public',
  'update_site_operational',
  array['uuid', 'integer', 'text', 'site_type', 'text', 'text', 'text', 'uuid'],
  'operational command atomically writes Site and audit'
);

select is_definer(
  'public',
  'update_site_contract',
  array['uuid', 'integer', 'integer', 'text', 'uuid'],
  'contract command atomically writes Site and audit'
);

select is_definer(
  'public',
  'change_site_status',
  array['uuid', 'integer', 'organization_status', 'text', 'uuid'],
  'lifecycle command atomically writes Site and audit'
);

select function_privs_are(
  'public',
  'create_site',
  array['uuid', 'uuid', 'text', 'site_type', 'text', 'text', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot create Sites'
);

select function_privs_are(
  'public',
  'update_site_operational',
  array['uuid', 'integer', 'text', 'site_type', 'text', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot update Sites'
);

select function_privs_are(
  'public',
  'update_site_contract',
  array['uuid', 'integer', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot change Site contracts'
);

select function_privs_are(
  'public',
  'change_site_status',
  array['uuid', 'integer', 'organization_status', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot change Site lifecycle'
);

select table_privs_are(
  'public',
  'sites',
  'authenticated',
  array['SELECT'],
  'authenticated sessions cannot directly mutate Sites'
);

select has_index(
  'public',
  'sites',
  'uq_sites_active_management_name',
  'active Site names are unique within a Management Company'
);

select * from finish();

rollback;
