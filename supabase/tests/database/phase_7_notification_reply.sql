begin;

select plan(35);

select has_table('public', 'response_tokens', 'Response Token table exists');
select col_is_unique('public', 'response_tokens', 'token_hash', 'Response Token hash is unique');

select has_function(
  'public', 'claim_notification_deliveries', array['text', 'integer', 'integer'],
  'notification lease claim exists'
);
select has_function(
  'public', 'attach_notification_response_token',
  array['uuid', 'text', 'integer', 'text', 'integer'],
  'leased delivery can attach one token hash'
);
select has_function(
  'public', 'record_notification_sent', array['uuid', 'text', 'integer', 'text'],
  'sent acknowledgement exists'
);
select has_function(
  'public', 'record_notification_failure',
  array['uuid', 'text', 'integer', 'text', 'boolean', 'timestamp with time zone'],
  'failure acknowledgement exists'
);
select has_function(
  'public', 'inspect_owner_response', array['text'],
  'Owner response inspection exists'
);
select has_function(
  'public', 'submit_owner_response', array['text', 'text', 'text', 'text'],
  'atomic Owner reply exists'
);

select is_definer(
  'public', 'claim_notification_deliveries', array['text', 'integer', 'integer'],
  'claim stays behind service role'
);
select is_definer(
  'public', 'attach_notification_response_token',
  array['uuid', 'text', 'integer', 'text', 'integer'],
  'token attach stays behind service role'
);
select is_definer(
  'public', 'record_notification_sent', array['uuid', 'text', 'integer', 'text'],
  'sent acknowledgement stays behind service role'
);
select is_definer(
  'public', 'record_notification_failure',
  array['uuid', 'text', 'integer', 'text', 'boolean', 'timestamp with time zone'],
  'failure acknowledgement stays behind service role'
);
select is_definer(
  'public', 'inspect_owner_response', array['text'],
  'Owner inspection stays behind server route'
);
select is_definer(
  'public', 'submit_owner_response', array['text', 'text', 'text', 'text'],
  'Owner reply stays behind server route'
);

select function_privs_are(
  'public', 'claim_notification_deliveries', array['text', 'integer', 'integer'],
  'anon', array[]::text[], 'anonymous browser cannot lease notifications'
);
select function_privs_are(
  'public', 'attach_notification_response_token',
  array['uuid', 'text', 'integer', 'text', 'integer'],
  'authenticated', array[]::text[], 'browser cannot issue response tokens'
);
select function_privs_are(
  'public', 'record_notification_sent', array['uuid', 'text', 'integer', 'text'],
  'anon', array[]::text[], 'anonymous browser cannot acknowledge provider send'
);
select function_privs_are(
  'public', 'record_notification_failure',
  array['uuid', 'text', 'integer', 'text', 'boolean', 'timestamp with time zone'],
  'authenticated', array[]::text[], 'browser cannot mutate provider failure state'
);
select function_privs_are(
  'public', 'inspect_owner_response', array['text'],
  'anon', array[]::text[], 'raw token inspection requires the server route'
);
select function_privs_are(
  'public', 'submit_owner_response', array['text', 'text', 'text', 'text'],
  'authenticated', array[]::text[], 'browser cannot bypass Owner reply policy'
);
select function_privs_are(
  'public', 'claim_notification_deliveries', array['text', 'integer', 'integer'],
  'service_role', array['EXECUTE'], 'Worker can lease notifications'
);

select table_privs_are(
  'public', 'response_tokens', 'anon', array[]::text[],
  'anonymous role has no Response Token table privileges'
);
select table_privs_are(
  'public', 'response_tokens', 'authenticated', array[]::text[],
  'authenticated role has no Response Token table privileges'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.response_tokens'::regclass),
  true, 'Response Tokens have RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.response_tokens'::regclass),
  true, 'Response Tokens force RLS'
);

select results_eq(
  $$
    select count(*)::integer from pg_indexes
    where schemaname = 'public' and tablename = 'response_tokens'
      and indexname = 'uq_response_tokens_active_contact_reply'
  $$,
  array[1],
  'one active CONTACT_REPLY token is database-enforced'
);
select results_eq(
  $$
    select count(*)::integer from information_schema.columns
    where table_schema = 'public' and table_name = 'response_tokens'
      and column_name in ('token', 'raw_token', 'token_ciphertext')
  $$,
  array[0],
  'Response Token persistence is hash-only'
);
select results_eq(
  $$
    select position('skip locked' in lower(pg_get_functiondef(
      'public.claim_notification_deliveries(text,integer,integer)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'notification claim uses SKIP LOCKED'
);
select results_eq(
  $$
    select position('lease_expires_at <= statement_timestamp()' in lower(pg_get_functiondef(
      'public.claim_notification_deliveries(text,integer,integer)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'expired PROCESSING lease is recoverable'
);
select results_eq(
  $$
    select position('owner_notified' in lower(pg_get_functiondef(
      'public.record_notification_sent(uuid,text,integer,text)'::regprocedure
    ))) > 0
      and position('owner_notification_sent' in lower(pg_get_functiondef(
        'public.record_notification_sent(uuid,text,integer,text)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'provider receipt, session state, and audit share sent transaction'
);
select results_eq(
  $$
    select position('failed_retryable' in lower(pg_get_functiondef(
      'public.record_notification_failure(uuid,text,integer,text,boolean,timestamp with time zone)'::regprocedure
    ))) > 0
      and position('failed_final' in lower(pg_get_functiondef(
        'public.record_notification_failure(uuid,text,integer,text,boolean,timestamp with time zone)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'retry and final failure states are explicit'
);
select results_eq(
  $$
    select position('owner_replied' in lower(pg_get_functiondef(
      'public.submit_owner_response(text,text,text,text)'::regprocedure
    ))) > 0
      and position('used_at' in lower(pg_get_functiondef(
        'public.submit_owner_response(text,text,text,text)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'Owner reply atomically consumes token and updates session'
);
select results_eq(
  $$
    select count(*)::integer from pg_constraint
    where conrelid = 'public.response_tokens'::regclass and contype = 'f'
  $$,
  array[2],
  'Response Tokens are scoped to session and delivery'
);
select results_eq(
  $$
    select count(*)::integer from information_schema.columns
    where table_schema = 'public' and table_name = 'notification_deliveries'
      and column_name in (
        'lease_owner', 'lease_version', 'lease_expires_at',
        'first_attempted_at', 'last_attempted_at', 'archived_at'
      )
  $$,
  array[6],
  'notification delivery has complete lease evidence'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_deliveries'::regclass
      and conname = 'chk_notification_delivery_archive'
  ),
  'final notification failures require archive timestamp'
);

select * from finish();

rollback;
