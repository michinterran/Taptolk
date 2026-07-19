begin;

select plan(9);

select has_function(
  'public',
  'approve_admin_account',
  array[
    'uuid',
    'text',
    'admin_role',
    'admin_scope_type',
    'uuid',
    'uuid',
    'uuid',
    'text',
    'uuid'
  ],
  'atomic admin approval function exists'
);

select has_function(
  'public',
  'reject_admin_account',
  array['uuid', 'text', 'text', 'uuid'],
  'atomic admin rejection function exists'
);

select is_definer(
  'public',
  'approve_admin_account',
  array[
    'uuid',
    'text',
    'admin_role',
    'admin_scope_type',
    'uuid',
    'uuid',
    'uuid',
    'text',
    'uuid'
  ],
  'approval command can atomically write profile, membership, and append-only audit'
);

select is_definer(
  'public',
  'reject_admin_account',
  array['uuid', 'text', 'text', 'uuid'],
  'rejection command can atomically write profile and append-only audit'
);

select function_privs_are(
  'public',
  'approve_admin_account',
  array[
    'uuid',
    'text',
    'admin_role',
    'admin_scope_type',
    'uuid',
    'uuid',
    'uuid',
    'text',
    'uuid'
  ],
  'anon',
  array[]::text[],
  'anonymous users cannot execute admin approval'
);

select function_privs_are(
  'public',
  'reject_admin_account',
  array['uuid', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous users cannot execute admin rejection'
);

select function_privs_are(
  'public',
  'approve_admin_account',
  array[
    'uuid',
    'text',
    'admin_role',
    'admin_scope_type',
    'uuid',
    'uuid',
    'uuid',
    'text',
    'uuid'
  ],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions enter the DB command where AAL2 and Super Admin are rechecked'
);

select function_privs_are(
  'public',
  'reject_admin_account',
  array['uuid', 'text', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions enter the rejection command where AAL2 and Super Admin are rechecked'
);

select policies_are(
  'public',
  'admin_profiles',
  array[
    'admin_profiles_select_platform_super_admin',
    'admin_profiles_select_self',
    'admin_profiles_update_self'
  ],
  'admin profile policies include self-service and AAL2 platform Super Admin review'
);

select * from finish();

rollback;
