begin;

select plan(14);

select has_table('public', 'tenants', 'tenants table exists');
select has_table('public', 'management_companies', 'management companies table exists');
select has_table('public', 'sites', 'sites table exists');
select has_table('public', 'admin_memberships', 'admin memberships table exists');
select has_table('public', 'audit_logs', 'audit logs table exists');

select results_eq(
  $$
    select relation.relrowsecurity
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'sites'
  $$,
  array[true],
  'sites have RLS enabled'
);

select policies_are(
  'public',
  'sites',
  array['sites_insert_scoped', 'sites_select_scoped', 'sites_update_scoped'],
  'sites expose only the reviewed scoped policies'
);

select throws_ok(
  $$
    insert into public.sites (
      id,
      tenant_id,
      management_company_id,
      name
    )
    values (
      '40000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      'Cross tenant site'
    )
  $$,
  '23503',
  null,
  'composite FK rejects a cross-tenant management company'
);

select throws_ok(
  $$
    insert into public.admin_memberships (
      user_id,
      role,
      scope_type
    )
    values (
      '90000000-0000-0000-0000-000000000001',
      'SITE_ADMIN',
      'PLATFORM'
    )
  $$,
  '23514',
  null,
  'role/scope constraint rejects a Site Admin at platform scope'
);

select throws_ok(
  $$
    insert into public.audit_logs (
      actor_type,
      action,
      resource_type,
      resource_id,
      request_id,
      after_data
    )
    values (
      'SYSTEM',
      'SITE_UPDATED',
      'SITE',
      '40000000-0000-0000-0000-000000000001',
      '80000000-0000-0000-0000-000000000001',
      '{"phone": "01012345678"}'::jsonb
    )
  $$,
  '23514',
  null,
  'audit constraint rejects sensitive payload keys'
);

select has_function(
  'app_private',
  'current_admin_has_scope',
  array['uuid', 'uuid', 'uuid', 'text[]'],
  'non-recursive membership scope helper exists'
);

select function_privs_are(
  'app_private',
  'current_admin_has_scope',
  array['uuid', 'uuid', 'uuid', 'text[]'],
  'anon',
  array[]::text[],
  'anonymous users cannot execute the admin scope helper'
);

select table_privs_are(
  'public',
  'audit_logs',
  'authenticated',
  array['SELECT'],
  'authenticated browser sessions cannot insert audit logs'
);

select table_privs_are(
  'public',
  'sites',
  'anon',
  array[]::text[],
  'anonymous sessions have no Site table privileges'
);

select * from finish();

rollback;
