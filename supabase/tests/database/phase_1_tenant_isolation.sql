begin;

select plan(24);

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
  array['sites_select_scoped'],
  'sites expose only the reviewed read policy to browser sessions'
);

select policies_are(
  'public',
  'contracts',
  array[
    'contracts_insert_scoped',
    'contracts_select_scoped',
    'contracts_update_scoped'
  ],
  'contracts separate read, insert, and update policy paths'
);

select throws_ok(
  $$
    insert into public.sites (
      id,
      tenant_id,
      management_company_id,
      name,
      address,
      contract_vehicle_limit
    )
    values (
      '40000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      'Cross tenant site',
      'Test address',
      100
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
  'authenticated',
  array['SELECT'],
  'authenticated browser sessions cannot bypass the Site application service'
);

select table_privs_are(
  'public',
  'sites',
  'anon',
  array[]::text[],
  'anonymous sessions have no Site table privileges'
);

select table_privs_are(
  'public',
  'tenants',
  'authenticated',
  array['SELECT'],
  'authenticated Tenant table access is read-only; mutations use audited commands'
);

select table_privs_are(
  'public',
  'management_companies',
  'authenticated',
  array['SELECT'],
  'authenticated Management Company table access is read-only'
);

select table_privs_are(
  'public',
  'contracts',
  'authenticated',
  array['INSERT', 'SELECT', 'UPDATE'],
  'authenticated contract access matches the reviewed contract'
);

select table_privs_are(
  'public',
  'admin_profiles',
  'authenticated',
  array['SELECT', 'UPDATE'],
  'authenticated admin profile access excludes insert and destructive privileges'
);

select table_privs_are(
  'public',
  'admin_memberships',
  'authenticated',
  array['INSERT', 'SELECT', 'UPDATE'],
  'authenticated membership access matches the reviewed contract'
);

select has_index(
  'public',
  'admin_memberships',
  'idx_admin_memberships_invited_by',
  'admin membership inviter FK has a covering index'
);

select has_index(
  'public',
  'audit_logs',
  'idx_audit_logs_tenant_site',
  'audit tenant/site FK has a covering index'
);

select has_index(
  'public',
  'contracts',
  'idx_contracts_tenant_management_site',
  'contract tenant/management/site FKs share a covering index'
);

select * from finish();

rollback;
