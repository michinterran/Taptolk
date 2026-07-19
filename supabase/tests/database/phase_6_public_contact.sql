begin;

select plan(50);

select has_table('public', 'contact_sessions', 'Contact Session table exists');
select has_table('public', 'session_participants', 'session participant table exists');
select has_table('public', 'messages', 'bounded session message table exists');
select has_table('public', 'notification_deliveries', 'notification intent ledger exists');
select has_table('public', 'public_contact_attempts', 'public rate attempt ledger exists');

select col_is_unique(
  'public',
  'contact_sessions',
  'session_token_hash',
  'session recovery hash is unique'
);
select col_is_unique(
  'public',
  'notification_deliveries',
  'idempotency_key',
  'notification intent idempotency is unique'
);

select has_function(
  'public',
  'inspect_public_contact',
  array['text'],
  'minimal ACTIVE QR inspection exists'
);
select has_function(
  'public',
  'create_public_contact_session',
  array['jsonb'],
  'atomic public contact command exists'
);
select has_function(
  'public',
  'read_public_contact_session',
  array['text', 'text'],
  'dual-hash caller polling read exists'
);

select is_definer(
  'public',
  'inspect_public_contact',
  array['text'],
  'public inspection stays behind server boundary'
);
select is_definer(
  'public',
  'create_public_contact_session',
  array['jsonb'],
  'contact creation stays behind server boundary'
);
select is_definer(
  'public',
  'read_public_contact_session',
  array['text', 'text'],
  'caller polling stays behind server boundary'
);

select function_privs_are(
  'public',
  'inspect_public_contact',
  array['text'],
  'anon',
  array[]::text[],
  'anonymous browser cannot call inspection RPC directly'
);
select function_privs_are(
  'public',
  'create_public_contact_session',
  array['jsonb'],
  'anon',
  array[]::text[],
  'anonymous browser cannot mutate contact tables directly'
);
select function_privs_are(
  'public',
  'read_public_contact_session',
  array['text', 'text'],
  'authenticated',
  array[]::text[],
  'authenticated browser cannot bypass caller token policy'
);
select function_privs_are(
  'public',
  'create_public_contact_session',
  array['jsonb'],
  'service_role',
  array['EXECUTE'],
  'service application boundary can create contact sessions'
);

select table_privs_are(
  'public',
  'contact_sessions',
  'anon',
  array[]::text[],
  'anonymous role has no Contact Session table privileges'
);
select table_privs_are(
  'public',
  'messages',
  'authenticated',
  array[]::text[],
  'authenticated role has no direct message privileges'
);
select table_privs_are(
  'public',
  'notification_deliveries',
  'anon',
  array[]::text[],
  'anonymous role cannot inspect notification destinations'
);
select table_privs_are(
  'public',
  'public_contact_attempts',
  'authenticated',
  array[]::text[],
  'browser roles cannot inspect rate hashes'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.contact_sessions'::regclass),
  true,
  'Contact Sessions have RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.contact_sessions'::regclass),
  true,
  'Contact Sessions force RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  true,
  'messages have RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.messages'::regclass),
  true,
  'messages force RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.notification_deliveries'::regclass),
  true,
  'notification intent ledger has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.public_contact_attempts'::regclass),
  true,
  'public contact attempt ledger forces RLS'
);

select results_eq(
  $$
    select position('asset.status = ''ACTIVE''' in pg_get_functiondef(
      'public.inspect_public_contact(text)'::regprocedure
    )) > 0
      and position('owner.status = ''ACTIVE''' in pg_get_functiondef(
        'public.inspect_public_contact(text)'::regprocedure
      )) > 0
      and position('contract.status = ''ACTIVE''' in pg_get_functiondef(
        'public.inspect_public_contact(text)'::regprocedure
      )) > 0
  $$,
  array[true],
  'inspection requires active QR, Owner, and contract'
);

select results_eq(
  $$
    select position('phone' in lower(pg_get_function_result(
      'public.inspect_public_contact(text)'::regprocedure
    ))) = 0
  $$,
  array[true],
  'inspection signature exposes no phone result type'
);

select results_eq(
  $$
    select position('pg_advisory_xact_lock' in lower(pg_get_functiondef(
      'public.create_public_contact_session(jsonb)'::regprocedure
    ))) > 0
      and position('for update' in lower(pg_get_functiondef(
        'public.create_public_contact_session(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'creation serializes duplicate identity and locks active scope'
);

select results_eq(
  $$
    select position('duplicate_seconds <> 180' in lower(pg_get_functiondef(
      'public.create_public_contact_session(jsonb)'::regprocedure
    ))) > 0
      and position('anon_limit <> 5' in lower(pg_get_functiondef(
        'public.create_public_contact_session(jsonb)'::regprocedure
      ))) > 0
      and position('ip_limit <> 3' in lower(pg_get_functiondef(
        'public.create_public_contact_session(jsonb)'::regprocedure
      ))) > 0
      and position('qr_limit <> 5' in lower(pg_get_functiondef(
        'public.create_public_contact_session(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'approved merge and rate limits are DB-enforced'
);

select results_eq(
  $$
    select position('notification_queued' in lower(pg_get_functiondef(
      'public.create_public_contact_session(jsonb)'::regprocedure
    ))) > 0
      and position('owner_contact' in lower(pg_get_functiondef(
        'public.create_public_contact_session(jsonb)'::regprocedure
      ))) > 0
      and position('public_contact_created' in lower(pg_get_functiondef(
        'public.create_public_contact_session(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'session, notification intent, and redacted audit share one command'
);

select results_eq(
  $$
    select position('p_session_token_hash' in lower(pg_get_functiondef(
      'public.read_public_contact_session(text,text)'::regprocedure
    ))) > 0
      and position('p_anonymous_token_hash' in lower(pg_get_functiondef(
        'public.read_public_contact_session(text,text)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'caller read validates both session and anonymous hashes'
);

select results_eq(
  $$
    select count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'public_contact_attempts'
      and indexname in (
        'idx_public_contact_attempts_anon_qr',
        'idx_public_contact_attempts_anon_created',
        'idx_public_contact_attempts_network_qr',
        'idx_public_contact_attempts_qr_created'
      )
  $$,
  array[4],
  'rate windows have all four required indexes'
);

select results_eq(
  $$
    select count(*)::integer
    from pg_trigger
    where tgrelid in (
      'public.messages'::regclass,
      'public.public_contact_attempts'::regclass
    )
      and not tgisinternal
      and tgname in ('trg_messages_immutable', 'trg_public_contact_attempts_immutable')
  $$,
  array[2],
  'message and attempt history are append-only'
);

select col_has_check(
  'public',
  'contact_sessions',
  'reason_code',
  'contact reason uses the approved allowlist'
);
select col_has_check(
  'public',
  'messages',
  'body',
  'message length and unsafe patterns have DB checks'
);
select col_has_check(
  'public',
  'notification_deliveries',
  'idempotency_key',
  'notification idempotency hash is constrained'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.public_contact_attempts'::regclass
      and contype = 'c'
      and conname = 'chk_public_contact_attempts_hashes'
      and pg_get_constraintdef(oid) like '%anonymous_hash ~%'
  ),
  'anonymous identity is hash-only'
);

select has_function(
  'public',
  'provision_public_contact_staging_fixture',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text'],
  'bounded public contact staging fixture exists'
);
select has_function(
  'public',
  'cleanup_public_contact_staging_fixture',
  array['uuid', 'text'],
  'exact public contact cleanup exists'
);
select is_definer(
  'public',
  'provision_public_contact_staging_fixture',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text'],
  'public contact fixture stays behind service boundary'
);
select function_privs_are(
  'public',
  'provision_public_contact_staging_fixture',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot provision caller fixtures'
);
select function_privs_are(
  'public',
  'cleanup_public_contact_staging_fixture',
  array['uuid', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot cleanup caller fixtures'
);
select has_function(
  'public',
  'provision_public_contact_contract_staging_fixture',
  array['uuid', 'uuid', 'uuid', 'text'],
  'bounded active contract fixture exists'
);
select has_function(
  'public',
  'cleanup_public_contact_contract_staging_fixture',
  array['uuid', 'uuid'],
  'exact contract fixture cleanup exists'
);
select is_definer(
  'public',
  'provision_public_contact_contract_staging_fixture',
  array['uuid', 'uuid', 'uuid', 'text'],
  'contract fixture stays behind service boundary'
);
select function_privs_are(
  'public',
  'provision_public_contact_contract_staging_fixture',
  array['uuid', 'uuid', 'uuid', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot create active contract fixtures'
);
select function_privs_are(
  'public',
  'cleanup_public_contact_contract_staging_fixture',
  array['uuid', 'uuid'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot delete contract fixtures'
);
select function_privs_are(
  'public',
  'cleanup_public_contact_contract_staging_fixture',
  array['uuid', 'uuid'],
  'service_role',
  array['EXECUTE'],
  'staging service can cleanup exact contract fixture'
);

select * from finish();

rollback;
