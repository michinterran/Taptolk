begin;

select plan(30);

select has_table(
  'public', 'solapi_delivery_reports',
  'SOLAPI delivery reports table exists'
);
select has_table(
  'public', 'solapi_account_health_snapshots',
  'SOLAPI account health snapshots table exists'
);

select has_column(
  'public', 'solapi_delivery_reports', 'provider_message_id',
  'delivery report keeps provider correlation id'
);
select has_column(
  'public', 'solapi_delivery_reports', 'status_code',
  'delivery report keeps provider status code'
);
select has_column(
  'public', 'solapi_account_health_snapshots', 'balance_amount',
  'account health snapshot keeps balance amount'
);
select has_column(
  'public', 'solapi_account_health_snapshots', 'warning_threshold_amount',
  'account health snapshot keeps warning threshold'
);

select results_eq(
  $$
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'solapi_delivery_reports'
      and column_name in (
        'to', 'from', 'phone', 'phone_number', 'message', 'message_body',
        'raw_payload', 'payload', 'custom_fields'
      )
  $$,
  array[0],
  'delivery reports persist no phone, message, or raw provider payload'
);
select results_eq(
  $$
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'solapi_account_health_snapshots'
      and column_name in ('api_key', 'api_secret', 'account_id', 'payment_method')
  $$,
  array[0],
  'account snapshots persist no provider credentials or payment details'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.solapi_delivery_reports'::regclass),
  true,
  'SOLAPI delivery reports have RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.solapi_delivery_reports'::regclass),
  true,
  'SOLAPI delivery reports force RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.solapi_account_health_snapshots'::regclass),
  true,
  'SOLAPI account health snapshots have RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.solapi_account_health_snapshots'::regclass),
  true,
  'SOLAPI account health snapshots force RLS'
);

select table_privs_are(
  'public', 'solapi_delivery_reports', 'anon', array[]::text[],
  'anonymous browser has no SOLAPI delivery report privileges'
);
select table_privs_are(
  'public', 'solapi_delivery_reports', 'authenticated', array[]::text[],
  'authenticated browser has no direct SOLAPI delivery report privileges'
);
select table_privs_are(
  'public', 'solapi_account_health_snapshots', 'anon', array[]::text[],
  'anonymous browser has no SOLAPI account health privileges'
);
select table_privs_are(
  'public', 'solapi_account_health_snapshots', 'authenticated', array[]::text[],
  'authenticated browser has no direct SOLAPI account health privileges'
);

select has_function(
  'public', 'record_solapi_delivery_report',
  array['text', 'text', 'timestamp with time zone', 'timestamp with time zone', 'text'],
  'one SOLAPI delivery report can be recorded'
);
select has_function(
  'public', 'record_solapi_delivery_report_batch', array['jsonb'],
  'SOLAPI delivery report batches can be recorded atomically'
);
select has_function(
  'public', 'record_solapi_account_health',
  array['text', 'numeric', 'text', 'numeric', 'numeric', 'boolean', 'boolean', 'text'],
  'SOLAPI account health can be recorded'
);
select has_function(
  'public', 'read_solapi_operations_health', array['uuid', 'uuid', 'integer'],
  'authorized console can read SOLAPI operations health'
);

select is_definer(
  'public', 'record_solapi_delivery_report',
  array['text', 'text', 'timestamp with time zone', 'timestamp with time zone', 'text'],
  'delivery report recording stays behind the service role'
);
select is_definer(
  'public', 'record_solapi_delivery_report_batch', array['jsonb'],
  'delivery batch recording stays behind the service role'
);
select is_definer(
  'public', 'record_solapi_account_health',
  array['text', 'numeric', 'text', 'numeric', 'numeric', 'boolean', 'boolean', 'text'],
  'account health recording stays behind the service role'
);
select is_definer(
  'public', 'read_solapi_operations_health', array['uuid', 'uuid', 'integer'],
  'operations health read enforces authorization in one database boundary'
);

select function_privs_are(
  'public', 'record_solapi_delivery_report_batch', array['jsonb'],
  'anon', array[]::text[], 'anonymous requests cannot write delivery reports'
);
select function_privs_are(
  'public', 'record_solapi_delivery_report_batch', array['jsonb'],
  'authenticated', array[]::text[], 'browser sessions cannot write delivery reports'
);
select function_privs_are(
  'public', 'record_solapi_delivery_report_batch', array['jsonb'],
  'service_role', array['EXECUTE'], 'webhook server can record delivery reports'
);
select function_privs_are(
  'public', 'read_solapi_operations_health', array['uuid', 'uuid', 'integer'],
  'authenticated', array['EXECUTE'], 'authenticated console can call scoped operations health read'
);

select results_eq(
  $$
    select position('p_status_code in (''2000'', ''3000'')' in lower(pg_get_functiondef(
      'public.record_solapi_delivery_report(text,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure
    ))) > 0
      and position('p_status_code = ''4000''' in lower(pg_get_functiondef(
        'public.record_solapi_delivery_report(text,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'provider accepted, sending, and delivered codes are classified explicitly'
);
select results_eq(
  $$
    select position('jsonb_array_length(p_reports) not between 1 and 100' in lower(pg_get_functiondef(
      'public.record_solapi_delivery_report_batch(jsonb)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'delivery webhook batch size is bounded'
);

select * from finish();

rollback;
