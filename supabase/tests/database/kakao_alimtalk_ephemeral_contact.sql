begin;

select plan(13);

select enum_has_labels(
  'public',
  'notification_channel',
  array['SMS', 'WEB_PUSH', 'KAKAO_ALIMTALK'],
  'notification history remains compatible and new AlimTalk intent is explicit'
);

select has_function(
  'public', 'resolve_public_contact_session', array['text', 'text'],
  'caller session resolution transaction exists'
);
select is_definer(
  'public', 'resolve_public_contact_session', array['text', 'text'],
  'caller session resolution stays behind the server boundary'
);
select function_privs_are(
  'public', 'resolve_public_contact_session', array['text', 'text'],
  'anon', array[]::text[], 'anonymous browsers cannot call the resolution RPC directly'
);
select function_privs_are(
  'public', 'resolve_public_contact_session', array['text', 'text'],
  'authenticated', array[]::text[], 'authenticated browsers cannot bypass the caller route'
);
select function_privs_are(
  'public', 'resolve_public_contact_session', array['text', 'text'],
  'service_role', array['EXECUTE'], 'server route can resolve a matching caller session'
);

select results_eq(
  $$
    select position('KAKAO_ALIMTALK' in pg_get_functiondef(
      'public.claim_notification_deliveries(text,integer,integer)'::regprocedure
    )) > 0
  $$,
  array[false],
  'notification workers can switch back to the SMS compatibility channel'
);
select results_eq(
  $$
    select position('OWNER_REPLIED' in pg_get_functiondef(
      'public.resolve_public_contact_session(text,text)'::regprocedure
    )) > 0
      and position('CONTACT_SESSION_CONFLICT' in pg_get_functiondef(
        'public.resolve_public_contact_session(text,text)'::regprocedure
      )) > 0
  $$,
  array[true],
  'only a replied or already-resolved caller session can complete'
);
select results_eq(
  $$
    select position('PUBLIC_CONTACT_RESOLVED' in pg_get_functiondef(
      'public.resolve_public_contact_session(text,text)'::regprocedure
    )) > 0
  $$,
  array[true],
  'resolution appends a redacted audit in the same transaction'
);
select results_eq(
  $$
    select position('set body = ''[REDACTED]''' in pg_get_functiondef(
      'app_private.cleanup_terminal_contact_session()'::regprocedure
    )) > 0
      and position('body_hash = repeat(''0'', 64)' in pg_get_functiondef(
        'app_private.cleanup_terminal_contact_session()'::regprocedure
      )) > 0
  $$,
  array[true],
  'terminal cleanup removes message content and its content-derived hash'
);
select results_eq(
  $$
    select position('update public.response_tokens' in lower(pg_get_functiondef(
      'app_private.cleanup_terminal_contact_session()'::regprocedure
    ))) > 0
      and position('update public.session_participants' in lower(pg_get_functiondef(
        'app_private.cleanup_terminal_contact_session()'::regprocedure
      ))) > 0
  $$,
  array[true],
  'terminal cleanup revokes both response and participant authority'
);
select results_eq(
  $$
    select position('status in (''QUEUED'', ''PROCESSING'', ''FAILED_RETRYABLE'')' in pg_get_functiondef(
      'app_private.cleanup_terminal_contact_session()'::regprocedure
    )) > 0
  $$,
  array[true],
  'terminal cleanup cancels every undelivered owner notification state'
);
select results_eq(
  $$
    select position('delete from public.contact_sessions' in lower(pg_get_functiondef(
      'app_private.cleanup_terminal_contact_session()'::regprocedure
    ))) = 0
      and position('delete from public.qr_assets' in lower(pg_get_functiondef(
        'app_private.cleanup_terminal_contact_session()'::regprocedure
      ))) = 0
  $$,
  array[true],
  'terminal cleanup preserves redacted session and QR history'
);

select * from finish();

rollback;
