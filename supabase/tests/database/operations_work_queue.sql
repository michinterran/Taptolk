begin;

select plan(15);

select has_function(
  'public',
  'read_operations_work_queue',
  array['uuid', 'uuid', 'integer', 'text'],
  'source-backed operations work queue function exists'
);

select function_returns(
  'public',
  'read_operations_work_queue',
  array['uuid', 'uuid', 'integer', 'text'],
  'jsonb',
  'operations work queue returns a JSON read model'
);

select function_privs_are(
  'public',
  'read_operations_work_queue',
  array['uuid', 'uuid', 'integer', 'text'],
  'anon',
  array[]::text[],
  'anon cannot execute operations work queue'
);

select function_privs_are(
  'public',
  'read_operations_work_queue',
  array['uuid', 'uuid', 'integer', 'text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated admins can execute the scoped work queue'
);

select volatility_is(
  'public',
  'read_operations_work_queue',
  array['uuid', 'uuid', 'integer', 'text'],
  'stable',
  'work queue is a stable read operation'
);

select is_definer(
  'public',
  'read_operations_work_queue',
  array['uuid', 'uuid', 'integer', 'text'],
  'work queue is security definer and checks site scope internally'
);

select ok(
  position('site.is_test_fixture = false' in pg_get_functiondef(
    'public.read_operations_work_queue(uuid, uuid, integer, text)'::regprocedure
  )) > 0
  and position('company.is_test_fixture = false' in pg_get_functiondef(
    'public.read_operations_work_queue(uuid, uuid, integer, text)'::regprocedure
  )) > 0
  and position('tenant.is_test_fixture = false' in pg_get_functiondef(
    'public.read_operations_work_queue(uuid, uuid, integer, text)'::regprocedure
  )) > 0,
  'work queue excludes fixture tenants, companies, and sites'
);

select ok(
  position('delivery.purpose <> ''OTP''' in pg_get_functiondef(
    'public.read_operations_work_queue(uuid, uuid, integer, text)'::regprocedure
  )) > 0
  and position('''assignee_display_name'', null' in pg_get_functiondef(
    'public.read_operations_work_queue(uuid, uuid, integer, text)'::regprocedure
  )) > 0
  and position('''priority'', null' in pg_get_functiondef(
    'public.read_operations_work_queue(uuid, uuid, integer, text)'::regprocedure
  )) > 0
  and position('''sla'', null' in pg_get_functiondef(
    'public.read_operations_work_queue(uuid, uuid, integer, text)'::regprocedure
  )) > 0,
  'work queue excludes OTP deliveries and unpersisted operational fields'
);

select has_table(
  'public',
  'operations_work_queue_overrides',
  'operator workflow state uses a separate persisted overlay'
);

select has_function(
  'public',
  'read_operations_work_queue_with_state',
  array['uuid', 'uuid', 'integer', 'text'],
  'stateful operations work queue function exists'
);

select function_privs_are(
  'public',
  'read_operations_work_queue_with_state',
  array['uuid', 'uuid', 'integer', 'text'],
  'anon',
  array[]::text[],
  'anon cannot execute the stateful work queue'
);

select function_privs_are(
  'public',
  'read_operations_work_queue_with_state',
  array['uuid', 'uuid', 'integer', 'text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated admins can read the stateful work queue'
);

select function_returns(
  'public',
  'mutate_operations_work_queue',
  array['uuid', 'text', 'text', 'integer', 'uuid', 'text', 'uuid'],
  'jsonb',
  'operations work queue mutation returns a redacted result'
);

select function_privs_are(
  'public',
  'mutate_operations_work_queue',
  array['uuid', 'text', 'text', 'integer', 'uuid', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anon cannot mutate the operations work queue'
);

select ok(
  position('OPERATIONS_WORK_QUEUE_VERSION_CONFLICT' in pg_get_functiondef(
    'public.mutate_operations_work_queue(uuid, text, text, integer, uuid, text, uuid)'::regprocedure
  )) > 0
  and position('OPERATIONS_WORK_ITEM_UPDATED' in pg_get_functiondef(
    'public.mutate_operations_work_queue(uuid, text, text, integer, uuid, text, uuid)'::regprocedure
  )) > 0
  and position('p_assignee_membership_id' in pg_get_functiondef(
    'public.mutate_operations_work_queue(uuid, text, text, integer, uuid, text, uuid)'::regprocedure
  )) > 0,
  'queue mutation is optimistic, audited, and assignment-aware'
);

select * from finish();

rollback;
