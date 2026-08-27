begin;

select plan(65);

select has_table('public', 'owners', 'Owner identity table exists');
select has_table('public', 'owner_devices', 'Owner device table exists');
select has_table('public', 'vehicle_owners', 'tenant-owned vehicle relationship exists');
select has_table(
  'public',
  'vehicle_site_contact_locations',
  'site-only Owner location table exists'
);
select has_table('public', 'owner_otp_challenges', 'service-only OTP lifecycle exists');
select has_table(
  'public',
  'owner_phone_verification_proofs',
  'one-use phone proof table exists'
);
select has_table('public', 'owner_sessions', 'hash-only Owner session table exists');

select col_is_unique('public', 'owners', 'phone_hash', 'phone identity hash is unique');
select col_is_unique(
  'public',
  'owner_phone_verification_proofs',
  'proof_hash',
  'proof hash is unique'
);
select col_is_unique('public', 'owner_sessions', 'session_hash', 'session hash is unique');
select col_is_unique(
  'public',
  'owner_phone_verification_proofs',
  'challenge_id',
  'one challenge issues at most one proof'
);

select has_function(
  'public',
  'inspect_owner_activation',
  array['text'],
  'minimal activation inspection exists'
);
select has_function(
  'public',
  'request_owner_activation_otp',
  array['jsonb'],
  'bounded OTP request command exists'
);
select has_function(
  'public',
  'mark_owner_otp_delivery',
  array['uuid', 'owner_otp_delivery_status'],
  'OTP provider result boundary exists'
);
select has_function(
  'public',
  'verify_owner_activation_otp',
  array['jsonb'],
  'atomic OTP verification command exists'
);
select has_function(
  'public',
  'complete_owner_activation',
  array['jsonb'],
  'atomic Owner activation command exists'
);
select has_function(
  'public',
  'read_site_escalation_queue',
  array['uuid'],
  'site-scoped escalation queue read model exists'
);
select has_function(
  'public',
  'list_owner_vehicles',
  array['text', 'text'],
  'Owner-scoped vehicle read model exists'
);
select has_function(
  'public',
  'update_owner_sticker_state',
  array['jsonb'],
  'Owner Settings sticker state command exists'
);
select has_function(
  'public',
  'request_owner_session_reclaim_otp',
  array['jsonb'],
  'Owner session reclaim OTP request command exists'
);
select has_function(
  'public',
  'verify_owner_session_reclaim_otp',
  array['jsonb'],
  'Owner session reclaim OTP verify command exists'
);

select is_definer('public', 'inspect_owner_activation', array['text'], 'inspect is server-only');
select is_definer(
  'public',
  'request_owner_activation_otp',
  array['jsonb'],
  'OTP request is server-only'
);
select is_definer(
  'public',
  'verify_owner_activation_otp',
  array['jsonb'],
  'OTP verify is server-only'
);
select is_definer(
  'public',
  'complete_owner_activation',
  array['jsonb'],
  'activation completion is server-only'
);
select is_definer(
  'public',
  'read_site_escalation_queue',
  array['uuid'],
  'site escalation queue enforces scope in the database'
);
select is_definer(
  'public',
  'update_owner_sticker_state',
  array['jsonb'],
  'Owner Settings sticker command is server-only'
);
select is_definer(
  'public',
  'request_owner_session_reclaim_otp',
  array['jsonb'],
  'reclaim OTP request is server-only'
);
select is_definer(
  'public',
  'verify_owner_session_reclaim_otp',
  array['jsonb'],
  'reclaim OTP verify is server-only'
);

select function_privs_are(
  'public',
  'inspect_owner_activation',
  array['text'],
  'anon',
  array[]::text[],
  'anonymous browser cannot call activation inspection directly'
);
select function_privs_are(
  'public',
  'request_owner_activation_otp',
  array['jsonb'],
  'authenticated',
  array[]::text[],
  'authenticated browser cannot write OTP challenges directly'
);
select function_privs_are(
  'public',
  'verify_owner_activation_otp',
  array['jsonb'],
  'authenticated',
  array[]::text[],
  'authenticated browser cannot verify OTP directly'
);
select function_privs_are(
  'public',
  'complete_owner_activation',
  array['jsonb'],
  'anon',
  array[]::text[],
  'anonymous browser cannot complete activation directly'
);
select function_privs_are(
  'public',
  'complete_owner_activation',
  array['jsonb'],
  'service_role',
  array['EXECUTE'],
  'service application boundary can complete activation'
);
select function_privs_are(
  'public',
  'read_site_escalation_queue',
  array['uuid'],
  'anon',
  array[]::text[],
  'anonymous browser cannot read site escalation queue'
);
select function_privs_are(
  'public',
  'update_owner_sticker_state',
  array['jsonb'],
  'authenticated',
  array[]::text[],
  'authenticated browser cannot mutate Owner sticker state directly'
);
select function_privs_are(
  'public',
  'update_owner_sticker_state',
  array['jsonb'],
  'service_role',
  array['EXECUTE'],
  'service application boundary can mutate Owner sticker state'
);
select function_privs_are(
  'public',
  'request_owner_session_reclaim_otp',
  array['jsonb'],
  'authenticated',
  array[]::text[],
  'authenticated browser cannot request reclaim OTP directly'
);
select function_privs_are(
  'public',
  'verify_owner_session_reclaim_otp',
  array['jsonb'],
  'authenticated',
  array[]::text[],
  'authenticated browser cannot verify reclaim OTP directly'
);
select function_privs_are(
  'public',
  'request_owner_session_reclaim_otp',
  array['jsonb'],
  'service_role',
  array['EXECUTE'],
  'service application boundary can request reclaim OTP'
);
select function_privs_are(
  'public',
  'verify_owner_session_reclaim_otp',
  array['jsonb'],
  'service_role',
  array['EXECUTE'],
  'service application boundary can verify reclaim OTP'
);

select table_privs_are(
  'public',
  'owner_otp_challenges',
  'anon',
  array[]::text[],
  'anonymous role has no OTP table privileges'
);
select table_privs_are(
  'public',
  'owner_phone_verification_proofs',
  'authenticated',
  array[]::text[],
  'authenticated role has no proof table privileges'
);
select table_privs_are(
  'public',
  'owner_sessions',
  'authenticated',
  array[]::text[],
  'authenticated role has no Owner session table privileges'
);
select table_privs_are(
  'public',
  'vehicle_site_contact_locations',
  'authenticated',
  array[]::text[],
  'authenticated role cannot directly select site contact locations'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.owners'::regclass),
  true,
  'owners has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.owners'::regclass),
  true,
  'owners forces RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.vehicle_owners'::regclass),
  true,
  'vehicle-owner relationships have RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.vehicle_owners'::regclass),
  true,
  'vehicle-owner relationships force RLS'
);

select results_eq(
  $$
    select pg_get_constraintdef(oid) like
      '%(created_by IS NULL) <> (created_by_owner_id IS NULL)%'
    from pg_constraint
    where conrelid = 'public.qr_bindings'::regclass
      and conname = 'chk_qr_bindings_creation_actor'
  $$,
  array[true],
  'each Binding has exactly one creation actor'
);

select results_eq(
  $$
    select position('for update' in lower(pg_get_functiondef(
      'public.complete_owner_activation(jsonb)'::regprocedure
    ))) > 0
      and position('owner_phone_verification_proofs' in lower(pg_get_functiondef(
        'public.complete_owner_activation(jsonb)'::regprocedure
      ))) > 0
      and position('qr_activation_codes' in lower(pg_get_functiondef(
        'public.complete_owner_activation(jsonb)'::regprocedure
      ))) > 0
      and position('activation_code_hash' in lower(pg_get_functiondef(
        'public.complete_owner_activation(jsonb)'::regprocedure
      ))) = 0
      and position('site_contact_location' in lower(pg_get_functiondef(
        'public.complete_owner_activation(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'completion does not require activation code hash and stores site-only contact location'
);

select results_eq(
  $$
    select position('owner_id' in lower(pg_get_functiondef(
      'public.read_site_escalation_queue(uuid)'::regprocedure
    ))) = 0
      and position('phone' in lower(pg_get_functiondef(
        'public.read_site_escalation_queue(uuid)'::regprocedure
      ))) = 0
      and position('site_contact_location' in lower(pg_get_functiondef(
        'public.read_site_escalation_queue(uuid)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'site escalation queue excludes Owner identity and direct phone fields'
);

select results_eq(
  $$
    select position('ttl_seconds <> 180' in lower(pg_get_functiondef(
      'public.request_owner_activation_otp(jsonb)'::regprocedure
    ))) > 0
      and position('resend_seconds <> 60' in lower(pg_get_functiondef(
        'public.request_owner_activation_otp(jsonb)'::regprocedure
      ))) > 0
      and position('hourly_limit <> 5' in lower(pg_get_functiondef(
        'public.request_owner_activation_otp(jsonb)'::regprocedure
      ))) > 0
      and position('daily_limit <> 10' in lower(pg_get_functiondef(
        'public.request_owner_activation_otp(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'approved OTP TTL, resend, hourly, and daily policy is DB-enforced'
);

select results_eq(
  $$
    select position('next_attempt >= 5' in lower(pg_get_functiondef(
      'public.verify_owner_activation_otp(jsonb)'::regprocedure
    ))) > 0
      and position('attempt_count = next_attempt' in lower(pg_get_functiondef(
        'public.verify_owner_activation_otp(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'OTP mismatch attempts persist and lock at five'
);

select results_eq(
  $$
    select position('owner_qr_activated' in lower(pg_get_functiondef(
      'public.complete_owner_activation(jsonb)'::regprocedure
    ))) > 0
      and position('owner_activation_completed' in lower(pg_get_functiondef(
        'public.complete_owner_activation(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'activation writes redacted audit and QR status history in the same command'
);

select results_eq(
  $$
    select position('plate_lookup_hash' in lower(pg_get_functiondef(
      'public.request_owner_session_reclaim_otp(jsonb)'::regprocedure
    ))) > 0
      and position('phone_hash' in lower(pg_get_functiondef(
        'public.request_owner_session_reclaim_otp(jsonb)'::regprocedure
      ))) > 0
      and position('owner_row.status = ''active''' in lower(pg_get_functiondef(
        'public.request_owner_session_reclaim_otp(jsonb)'::regprocedure
      ))) > 0
      and position('reclaim_unavailable' in lower(pg_get_functiondef(
        'public.request_owner_session_reclaim_otp(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'reclaim OTP requires active sticker, matching plate, and matching phone'
);

select results_eq(
  $$
    select position('owner_devices' in lower(pg_get_functiondef(
      'public.verify_owner_session_reclaim_otp(jsonb)'::regprocedure
    ))) > 0
      and position('owner_sessions' in lower(pg_get_functiondef(
        'public.verify_owner_session_reclaim_otp(jsonb)'::regprocedure
      ))) > 0
      and position('owner_session_reclaimed' in lower(pg_get_functiondef(
        'public.verify_owner_session_reclaim_otp(jsonb)'::regprocedure
      ))) > 0
      and position('insert into public.qr_bindings' in lower(pg_get_functiondef(
        'public.verify_owner_session_reclaim_otp(jsonb)'::regprocedure
      ))) = 0
      and position('update public.qr_bindings' in lower(pg_get_functiondef(
        'public.verify_owner_session_reclaim_otp(jsonb)'::regprocedure
      ))) = 0
  $$,
  array[true],
  'reclaim verify creates Owner session and device without changing bindings'
);

select results_eq(
  $$
    select position('owner_session_context' in lower(pg_get_functiondef(
      'public.update_owner_sticker_state(jsonb)'::regprocedure
    ))) > 0
      and position('owner_sticker_suspended' in lower(pg_get_functiondef(
        'public.update_owner_sticker_state(jsonb)'::regprocedure
      ))) > 0
      and position('owner_sticker_resumed' in lower(pg_get_functiondef(
        'public.update_owner_sticker_state(jsonb)'::regprocedure
      ))) > 0
      and position('owner_sticker_released' in lower(pg_get_functiondef(
        'public.update_owner_sticker_state(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'Owner Settings sticker command is session-scoped and records all action reasons'
);

select results_eq(
  $$
    select position('update public.qr_bindings' in lower(pg_get_functiondef(
      'public.update_owner_sticker_state(jsonb)'::regprocedure
    ))) > 0
      and position('update public.vehicle_owners' in lower(pg_get_functiondef(
        'public.update_owner_sticker_state(jsonb)'::regprocedure
      ))) > 0
      and position('qr_asset_status_logs' in lower(pg_get_functiondef(
        'public.update_owner_sticker_state(jsonb)'::regprocedure
      ))) > 0
      and position('audit_logs' in lower(pg_get_functiondef(
        'public.update_owner_sticker_state(jsonb)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'Owner Settings release ends active relationships and writes audit plus status history'
);

select has_function(
  'public',
  'provision_owner_activation_staging_fixture',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text', 'text', 'text'],
  'bounded Owner staging fixture provisioning exists'
);
select has_function(
  'public',
  'cleanup_owner_activation_staging_fixture',
  array['uuid', 'text'],
  'bounded Owner staging fixture cleanup exists'
);
select is_definer(
  'public',
  'provision_owner_activation_staging_fixture',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text', 'text', 'text'],
  'Owner fixture provisioning stays behind service boundary'
);
select function_privs_are(
  'public',
  'provision_owner_activation_staging_fixture',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text', 'text', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot provision Owner fixture'
);
select function_privs_are(
  'public',
  'cleanup_owner_activation_staging_fixture',
  array['uuid', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot cleanup Owner fixture'
);
select function_privs_are(
  'public',
  'cleanup_owner_activation_staging_fixture',
  array['uuid', 'text'],
  'service_role',
  array['EXECUTE'],
  'staging service can cleanup exact Owner fixture'
);

select * from finish();

rollback;
