begin;

select plan(40);

select has_table('public', 'operations_metric_snapshots', 'hourly metric snapshots exist');
select has_table('public', 'privacy_cleanup_runs', 'privacy cleanup ledger exists');
select has_function(
  'public', 'aggregate_operations_metrics',
  array['uuid', 'uuid', 'timestamp with time zone'],
  'hourly metric aggregation exists'
);
select has_function('public', 'read_operations_dashboard', array[]::text[],
  'scoped operations dashboard read exists');
select has_function(
  'public', 'run_privacy_cleanup',
  array['uuid', 'integer', 'integer', 'integer', 'uuid'],
  'tenant-bounded privacy cleanup exists'
);
select has_function('public', 'read_pilot_readiness_snapshot', array[]::text[],
  'pilot readiness snapshot exists');

select is_definer(
  'public', 'aggregate_operations_metrics',
  array['uuid', 'uuid', 'timestamp with time zone'],
  'aggregation stays behind service boundary'
);
select is_definer('public', 'read_operations_dashboard', array[]::text[],
  'dashboard uses authoritative scoped read');
select is_definer(
  'public', 'run_privacy_cleanup',
  array['uuid', 'integer', 'integer', 'integer', 'uuid'],
  'cleanup stays behind service boundary'
);
select is_definer('public', 'read_pilot_readiness_snapshot', array[]::text[],
  'pilot snapshot uses authoritative scoped read');

select function_privs_are(
  'public', 'read_operations_dashboard', array[]::text[],
  'anon', array[]::text[], 'anonymous browser cannot read operations KPIs'
);
select function_privs_are(
  'public', 'run_privacy_cleanup',
  array['uuid', 'integer', 'integer', 'integer', 'uuid'],
  'anon', array[]::text[], 'anonymous browser cannot run privacy cleanup'
);
select function_privs_are(
  'public', 'read_operations_dashboard', array[]::text[],
  'authenticated', array['EXECUTE'], 'authenticated Admin can call scoped KPI read'
);
select function_privs_are(
  'public', 'run_privacy_cleanup',
  array['uuid', 'integer', 'integer', 'integer', 'uuid'],
  'service_role', array['EXECUTE'], 'service cleanup runtime can run bounded cleanup'
);

select table_privs_are(
  'public', 'operations_metric_snapshots', 'anon', array[]::text[],
  'anonymous role has no metric snapshot privileges'
);
select table_privs_are(
  'public', 'privacy_cleanup_runs', 'anon', array[]::text[],
  'anonymous role has no cleanup ledger privileges'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.operations_metric_snapshots'::regclass),
  true, 'metric snapshots have RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class
    where oid = 'public.operations_metric_snapshots'::regclass),
  true, 'metric snapshots force RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.privacy_cleanup_runs'::regclass),
  true, 'cleanup runs have RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class
    where oid = 'public.privacy_cleanup_runs'::regclass),
  true, 'cleanup runs force RLS'
);

select results_eq(
  $$
    select count(*)::integer from information_schema.columns
    where table_schema = 'public'
      and table_name in ('operations_metric_snapshots', 'privacy_cleanup_runs')
      and column_name in (
        'phone', 'message', 'body', 'token', 'cookie', 'ip', 'network_hash',
        'anonymous_hash', 'destination_hash', 'provider_payload'
      )
  $$,
  array[0],
  'operations persistence contains no sensitive payload columns'
);
select results_eq(
  $$
    select count(*)::integer from pg_constraint
    where conrelid = 'public.operations_metric_snapshots'::regclass
      and conname = 'uq_operations_metric_snapshots_window'
  $$,
  array[1],
  'one metric snapshot per Site and hour is enforced'
);
select col_is_unique(
  'public', 'privacy_cleanup_runs', 'request_id',
  'cleanup request identity is unique'
);
select results_eq(
  $$
    select position('current_admin_has_site_scope' in lower(pg_get_functiondef(
      'public.read_operations_dashboard()'::regprocedure
    ))) > 0
  $$,
  array[true],
  'dashboard applies central Site scope before reading rows'
);
select results_eq(
  $$
    select position('interval ''24 hours''' in lower(pg_get_functiondef(
      'public.read_operations_dashboard()'::regprocedure
    ))) > 0
  $$,
  array[true],
  'live dashboard window is bounded to 24 hours'
);
select results_eq(
  $$
    select position('cost_amount' in lower(pg_get_functiondef(
      'public.read_operations_dashboard()'::regprocedure
    ))) > 0
  $$,
  array[true],
  'dashboard cost uses the notification ledger'
);
select results_eq(
  $$
    select position('notification_missing_cost_count' in lower(pg_get_functiondef(
      'public.read_operations_dashboard()'::regprocedure
    ))) > 0
  $$,
  array[true],
  'dashboard makes incomplete provider cost explicit'
);
select results_eq(
  $$
    select position('service_role' in lower(pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'cleanup fails closed outside the service role'
);
select results_eq(
  $$
    select position('between 24 and 8760' in lower(pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    ))) > 0
      and position('between 0 and 168' in lower(pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'cleanup retention inputs are DB-bounded'
);
select results_eq(
  $$
    select position('set status = ''EXPIRED''' in pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    )) > 0
  $$,
  array[true],
  'cleanup expires open sessions without deleting history'
);
select results_eq(
  $$
    select position('update public.response_tokens' in lower(pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'cleanup revokes expired response tokens'
);
select results_eq(
  $$
    select position('update public.caller_blocks' in lower(pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'cleanup revokes expired caller blocks'
);
select results_eq(
  $$
    select position('set body = ''[REDACTED]''' in pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    )) > 0
  $$,
  array[true],
  'cleanup redacts aged message bodies'
);
select results_eq(
  $$
    select position('(to_jsonb(new) - ''body'') = (to_jsonb(old) - ''body'')' in lower(
      pg_get_functiondef('app_private.guard_public_contact_append_only()'::regprocedure)
    )) > 0
  $$,
  array[true],
  'message history guard permits only exact service redaction'
);
select results_eq(
  $$
    select position('privacy_cleanup_completed' in lower(pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'cleanup writes a redacted audit in the same transaction'
);
select results_eq(
  $$
    select position('on conflict (request_id) do nothing' in lower(pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'cleanup is request-idempotent'
);
select results_eq(
  $$
    select position('delete from public.contact_sessions' in lower(pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    ))) = 0
      and position('delete from public.qr_assets' in lower(pg_get_functiondef(
      'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
    ))) = 0
  $$,
  array[true],
  'cleanup preserves Contact Session and QR Asset history'
);
select results_eq(
  $$
    select position('manual_real_device_gate'', false' in lower(pg_get_functiondef(
      'public.read_pilot_readiness_snapshot()'::regprocedure
    ))) > 0
      and position('manual_screen_reader_gate'', false' in lower(pg_get_functiondef(
      'public.read_pilot_readiness_snapshot()'::regprocedure
    ))) > 0
      and position('manual_physical_print_gate'', false' in lower(pg_get_functiondef(
      'public.read_pilot_readiness_snapshot()'::regprocedure
    ))) > 0
  $$,
  array[true],
  'automated readiness never claims manual device or print acceptance'
);
select results_eq(
  $$
    select position('automated_dashboard_gate'', true' in lower(pg_get_functiondef(
      'public.read_pilot_readiness_snapshot()'::regprocedure
    ))) > 0
  $$,
  array[true],
  'pilot snapshot identifies the automated dashboard gate'
);
select results_eq(
  $$
    select position('on conflict (tenant_id, site_id, window_start)' in lower(pg_get_functiondef(
      'public.aggregate_operations_metrics(uuid,uuid,timestamp with time zone)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'hourly aggregation is idempotent'
);

select * from finish();

rollback;
