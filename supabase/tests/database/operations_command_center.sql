begin;

select plan(9);

select has_function(
  'public',
  'read_operations_command_center',
  array['uuid', 'uuid', 'integer'],
  'scoped operations command center function exists'
);

select function_returns(
  'public',
  'read_operations_command_center',
  array['uuid', 'uuid', 'integer'],
  'jsonb',
  'command center returns a redacted JSON read model'
);

select has_function(
  'public',
  'read_operations_command_center_by_range',
  array['uuid', 'uuid', 'date', 'date'],
  'range-aware operations command center function exists'
);

select function_privs_are(
  'public',
  'read_operations_command_center_by_range',
  array['uuid', 'uuid', 'date', 'date'],
  'anon',
  array[]::text[],
  'anon cannot execute range-aware operations analytics'
);

select function_privs_are(
  'public',
  'read_operations_command_center',
  array['uuid', 'uuid', 'integer'],
  'anon',
  array[]::text[],
  'anon cannot execute command center analytics'
);

select function_privs_are(
  'public',
  'read_operations_command_center',
  array['uuid', 'uuid', 'integer'],
  'authenticated',
  array['EXECUTE'],
  'authenticated admins can execute the server-authorized read model'
);

select volatility_is(
  'public',
  'read_operations_command_center',
  array['uuid', 'uuid', 'integer'],
  'stable',
  'command center is a stable read operation'
);

select is_definer(
  'public',
  'read_operations_command_center',
  array['uuid', 'uuid', 'integer'],
  'command center is security definer and checks site scope internally'
);

select ok(
  position(
    'site.is_test_fixture = false'
    in pg_get_functiondef(
      'public.read_operations_command_center(uuid, uuid, integer)'::regprocedure
    )
  ) > 0
  and position(
    'company.is_test_fixture = false'
    in pg_get_functiondef(
      'public.read_operations_command_center(uuid, uuid, integer)'::regprocedure
    )
  ) > 0
  and position(
    'tenant.is_test_fixture = false'
    in pg_get_functiondef(
      'public.read_operations_command_center(uuid, uuid, integer)'::regprocedure
    )
  ) > 0,
  'command center excludes fixture tenants, companies, and sites in the read model'
);

select * from finish();

rollback;
