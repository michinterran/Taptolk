begin;

select plan(16);

select has_function(
  'public',
  'list_due_privacy_cleanup_tenants',
  array['integer'],
  'server-only due-tenant selector exists'
);
select is_definer(
  'public',
  'list_due_privacy_cleanup_tenants',
  array['integer'],
  'due-tenant selection stays behind one reviewed server boundary'
);
select function_privs_are(
  'public',
  'list_due_privacy_cleanup_tenants',
  array['integer'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot list cleanup tenants'
);
select function_privs_are(
  'public',
  'list_due_privacy_cleanup_tenants',
  array['integer'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot list cleanup tenants'
);
select function_privs_are(
  'public',
  'list_due_privacy_cleanup_tenants',
  array['integer'],
  'service_role',
  array['EXECUTE'],
  'service scheduler can list due tenants'
);
select results_eq(
  $$
    select position('service_role' in lower(pg_get_functiondef(
      'public.list_due_privacy_cleanup_tenants(integer)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'selector fails closed outside service role'
);
select results_eq(
  $$
    select position('between 1 and 100' in lower(pg_get_functiondef(
      'public.list_due_privacy_cleanup_tenants(integer)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'selector limit is DB-bounded'
);
select results_eq(
  $$
    select position('date_trunc(''hour''' in lower(pg_get_functiondef(
      'public.list_due_privacy_cleanup_tenants(integer)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'selector excludes tenants already started in the current hour'
);
select results_eq(
  $$
    select position('status = ''ACTIVE''' in pg_get_functiondef(
      'public.list_due_privacy_cleanup_tenants(integer)'::regprocedure
    )) > 0
      and position('deleted_at is null' in lower(pg_get_functiondef(
        'public.list_due_privacy_cleanup_tenants(integer)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'selector includes only active non-deleted tenants'
);
select results_eq(
  $$
    select position('nulls first' in lower(pg_get_functiondef(
      'public.list_due_privacy_cleanup_tenants(integer)'::regprocedure
    ))) > 0
      and position('tenant.id asc' in lower(pg_get_functiondef(
        'public.list_due_privacy_cleanup_tenants(integer)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'never-run and oldest-due tenant ordering is deterministic'
);

insert into public.tenants (id, name, slug, status, deleted_at)
values
  ('f1000000-0000-4000-8000-000000000001', 'Cron active due', 'cron-active-due', 'ACTIVE', null),
  ('f1000000-0000-4000-8000-000000000002', 'Cron active current', 'cron-active-current', 'ACTIVE', null),
  ('f1000000-0000-4000-8000-000000000003', 'Cron suspended', 'cron-suspended', 'SUSPENDED', null),
  ('f1000000-0000-4000-8000-000000000004', 'Cron deleted', 'cron-deleted', 'ACTIVE', statement_timestamp());

insert into public.privacy_cleanup_runs (
  tenant_id,
  request_id,
  status,
  message_retention_hours,
  token_grace_hours,
  block_grace_hours,
  started_at,
  completed_at
)
values
  (
    'f1000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000001',
    'SUCCESS',
    72,
    0,
    0,
    statement_timestamp() - interval '2 hours',
    statement_timestamp() - interval '2 hours'
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'f2000000-0000-4000-8000-000000000002',
    'SUCCESS',
    72,
    0,
    0,
    statement_timestamp(),
    statement_timestamp()
  );

select set_config('request.jwt.claim.role', 'service_role', true);

select results_eq(
  $$
    select (public.list_due_privacy_cleanup_tenants(100)->'tenant_ids')
      ? 'f1000000-0000-4000-8000-000000000001'
  $$,
  array[true],
  'an active tenant with only an older run remains due'
);
select results_eq(
  $$
    select (public.list_due_privacy_cleanup_tenants(100)->'tenant_ids')
      ? 'f1000000-0000-4000-8000-000000000002'
  $$,
  array[false],
  'a current-hour cleanup run excludes its tenant'
);
select results_eq(
  $$
    select (public.list_due_privacy_cleanup_tenants(100)->'tenant_ids')
      ? 'f1000000-0000-4000-8000-000000000003'
  $$,
  array[false],
  'a suspended tenant is not scheduled'
);
select results_eq(
  $$
    select (public.list_due_privacy_cleanup_tenants(100)->'tenant_ids')
      ? 'f1000000-0000-4000-8000-000000000004'
  $$,
  array[false],
  'a deleted tenant is not scheduled'
);
select throws_ok(
  $$ select public.list_due_privacy_cleanup_tenants(101) $$,
  '22023',
  'INVALID_LIMIT',
  'selector rejects a limit above the reviewed maximum'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ select public.list_due_privacy_cleanup_tenants(1) $$,
  '42501',
  'SERVER_ROLE_REQUIRED',
  'authenticated caller is rejected before tenant selection'
);

select * from finish();

rollback;
