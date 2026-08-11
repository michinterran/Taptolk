begin;

select plan(20);

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

select ok(
  exists (
    select constraint_row.conname::text
    from pg_catalog.pg_constraint as constraint_row
    join pg_catalog.pg_class as relation on relation.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'sites'
      and constraint_row.conname = 'chk_sites_required_operating_address_v2'
  ),
  'new or corrected Sites require an operating address'
);

select ok(
  exists (
    select constraint_row.conname::text
    from pg_catalog.pg_constraint as constraint_row
    join pg_catalog.pg_class as relation on relation.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'sites'
      and constraint_row.conname = 'chk_sites_required_contract_capacity_v2'
  ),
  'new or corrected Sites require positive contract capacity'
);

select ok(
  exists (
    select constraint_row.conname::text
    from pg_catalog.pg_constraint as constraint_row
    join pg_catalog.pg_class as relation on relation.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'sites'
      and constraint_row.conname = 'chk_sites_required_timezone_v2'
  ),
  'Site timezone remains a protected system field'
);

select has_trigger(
  'public',
  'sites',
  'trg_sites_registration_parent_ready',
  'Site registration rejects an incomplete external management-company profile'
);

select has_trigger(
  'public',
  'qr_direct_generation_requests',
  'trg_qr_direct_generation_site_ready',
  'direct QR generation fails closed for an incomplete Site profile'
);

select * from finish();

rollback;
