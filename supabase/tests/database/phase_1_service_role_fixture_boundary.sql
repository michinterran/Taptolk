begin;

select plan(7);

select table_privs_are(
  'public',
  'tenants',
  'service_role',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'server-only fixture role can create, inspect, and clean Tenant rows without UPDATE'
);

select table_privs_are(
  'public',
  'management_companies',
  'service_role',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'server-only fixture role can create, inspect, and clean Management Company rows'
);

select table_privs_are(
  'public',
  'sites',
  'service_role',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'server-only fixture role can create, inspect, and clean Site rows without UPDATE'
);

select table_privs_are(
  'public',
  'admin_profiles',
  'service_role',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'server-only fixture role can create and clean ephemeral Admin profiles'
);

select table_privs_are(
  'public',
  'admin_memberships',
  'service_role',
  array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'server-only fixture role can create and clean ephemeral Admin memberships'
);

select table_privs_are(
  'public',
  'audit_logs',
  'service_role',
  array['DELETE', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'server-only fixture role can inspect and clean its Site audit evidence without INSERT or UPDATE'
);

select table_privs_are(
  'public',
  'sites',
  'authenticated',
  array['SELECT'],
  'browser Site privilege remains read-only'
);

select * from finish();

rollback;
