begin;

select plan(32);

select has_table('public', 'abuse_events', 'abuse evidence table exists');
select has_table('public', 'contact_reports', 'contact report table exists');
select has_table('public', 'caller_blocks', 'caller block table exists');

select has_function('public', 'record_public_abuse_event', array['jsonb'],
  'independent abuse event command exists');
select has_function('public', 'is_public_contact_blocked', array['text', 'text', 'text'],
  'pre-create block check exists');
select has_function('public', 'read_contact_escalation_state', array['text', 'text'],
  'caller escalation read exists');
select has_function('public', 'request_contact_office_alert', array['text', 'text'],
  'office alert command exists');
select has_function('public', 'report_contact_session', array['text', 'text', 'text'],
  'caller report command exists');
select has_function(
  'public', 'process_contact_report',
  array['uuid', 'contact_report_status', 'text', 'integer'],
  'scoped Admin report process command exists'
);

select is_definer('public', 'record_public_abuse_event', array['jsonb'],
  'abuse evidence stays behind service boundary');
select is_definer('public', 'is_public_contact_blocked', array['text', 'text', 'text'],
  'block check stays behind service boundary');
select is_definer('public', 'read_contact_escalation_state', array['text', 'text'],
  'escalation read stays behind server route');
select is_definer('public', 'request_contact_office_alert', array['text', 'text'],
  'office alert stays behind server route');
select is_definer('public', 'report_contact_session', array['text', 'text', 'text'],
  'caller report stays behind server route');
select is_definer(
  'public', 'process_contact_report',
  array['uuid', 'contact_report_status', 'text', 'integer'],
  'report processing enforces central Admin scope'
);

select function_privs_are(
  'public', 'record_public_abuse_event', array['jsonb'],
  'anon', array[]::text[], 'anonymous browser cannot create abuse evidence directly'
);
select function_privs_are(
  'public', 'is_public_contact_blocked', array['text', 'text', 'text'],
  'authenticated', array[]::text[], 'browser cannot enumerate caller blocks'
);
select function_privs_are(
  'public', 'request_contact_office_alert', array['text', 'text'],
  'anon', array[]::text[], 'browser cannot bypass dual-hash office policy'
);
select function_privs_are(
  'public', 'process_contact_report',
  array['uuid', 'contact_report_status', 'text', 'integer'],
  'anon', array[]::text[], 'anonymous browser cannot process reports'
);

select table_privs_are(
  'public', 'abuse_events', 'anon', array[]::text[],
  'anonymous role has no abuse evidence privileges'
);
select table_privs_are(
  'public', 'contact_reports', 'anon', array[]::text[],
  'anonymous role has no report table privileges'
);
select table_privs_are(
  'public', 'caller_blocks', 'anon', array[]::text[],
  'anonymous role has no caller block privileges'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.abuse_events'::regclass),
  true, 'abuse evidence has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.contact_reports'::regclass),
  true, 'contact reports force RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.caller_blocks'::regclass),
  true, 'caller blocks force RLS'
);

select results_eq(
  $$
    select count(*)::integer from information_schema.columns
    where table_schema = 'public'
      and table_name in ('abuse_events', 'caller_blocks')
      and column_name in (
        'ip', 'phone', 'message', 'raw_token', 'token', 'user_agent'
      )
  $$,
  array[0],
  'abuse persistence contains no raw identifiers, messages, or tokens'
);
select results_eq(
  $$
    select position('participant.anonymous_token_hash = p_anonymous_token_hash' in
      pg_get_functiondef('public.report_contact_session(text,text,text)'::regprocedure)) > 0
      and position('participant.anonymous_token_hash = p_anonymous_token_hash' in
      pg_get_functiondef('public.request_contact_office_alert(text,text)'::regprocedure)) > 0
  $$,
  array[true],
  'caller report and office alert both require participant dual hash'
);
select results_eq(
  $$
    select position('interval ''180 seconds''' in
      pg_get_functiondef('public.request_contact_office_alert(text,text)'::regprocedure)) > 0
  $$,
  array[true],
  'office alert cannot be requested before the approved 180-second threshold'
);
select results_eq(
  $$
    select position('on conflict (idempotency_key) do nothing' in lower(
      pg_get_functiondef('public.request_contact_office_alert(text,text)'::regprocedure))) > 0
  $$,
  array[true],
  'office alert notification intent is idempotent'
);
select results_eq(
  $$
    select position('site_office_alert_requested' in lower(
      pg_get_functiondef('public.request_contact_office_alert(text,text)'::regprocedure))) > 0
      and position('contact_report_processed' in lower(
      pg_get_functiondef(
        'public.process_contact_report(uuid,contact_report_status,text,integer)'::regprocedure
      ))) > 0
  $$,
  array[true],
  'security-relevant escalation and disposition write redacted audits'
);
select results_eq(
  $$
    select count(*)::integer from pg_indexes
    where schemaname = 'public' and tablename = 'caller_blocks'
      and indexname = 'uq_caller_blocks_active'
  $$,
  array[1],
  'one active caller block per anonymous identity is enforced'
);
select results_eq(
  $$
    select position('last_network_hash' in lower(pg_get_functiondef(
      'public.process_contact_report(uuid,contact_report_status,text,integer)'::regprocedure
    ))) > 0
  $$,
  array[true],
  'Admin block uses independently observed network evidence'
);

select * from finish();

rollback;
