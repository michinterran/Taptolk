begin;

select plan(9);

select has_function('public', 'read_admin_account_directory', array[]::text[], 'account directory read model exists');
select ok(
  position('last_changed_at' in pg_get_functiondef(
    'public.read_admin_account_directory()'::regprocedure
  )) > 0,
  'account directory exposes a redacted latest change summary'
);
select has_function(
  'public',
  'update_current_admin_profile',
  array['text', 'integer', 'text', 'uuid'],
  'audited self profile command exists'
);
select has_function(
  'public',
  'update_admin_membership_assignment',
  array['uuid', 'integer', 'admin_role', 'admin_scope_type', 'uuid', 'uuid', 'uuid', 'admin_membership_status', 'text', 'uuid'],
  'audited assignment command exists'
);
select function_privs_are(
  'public', 'read_admin_account_directory', array[]::text[], 'anon', array[]::text[],
  'anon cannot read admin directory'
);
select function_privs_are(
  'public', 'read_admin_account_directory', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated admins reach the server-authorized directory'
);
select function_privs_are(
  'public', 'update_current_admin_profile', array['text', 'integer', 'text', 'uuid'],
  'anon', array[]::text[], 'anon cannot update profiles'
);
select function_privs_are(
  'public', 'update_current_admin_profile', array['text', 'integer', 'text', 'uuid'],
  'authenticated', array['EXECUTE'], 'authenticated users reach the self-only command'
);
select is_definer(
  'public', 'update_admin_membership_assignment',
  array['uuid', 'integer', 'admin_role', 'admin_scope_type', 'uuid', 'uuid', 'uuid', 'admin_membership_status', 'text', 'uuid'],
  'membership assignment is a security definer command with internal authorization'
);

select * from finish();

rollback;
