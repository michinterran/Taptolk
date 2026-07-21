begin;

select plan(6);

select has_function(
  'public', 'request_qr_batch_series',
  array['uuid', 'integer', 'uuid', 'integer', 'integer', 'text', 'text', 'uuid', 'uuid'],
  'atomic QR Batch series request command exists'
);

select function_privs_are(
  'public', 'request_qr_batch_series',
  array['uuid', 'integer', 'uuid', 'integer', 'integer', 'text', 'text', 'uuid', 'uuid'],
  'authenticated', array['EXECUTE'],
  'authenticated administrators can execute the series command'
);

select function_privs_are(
  'public', 'request_qr_batch_series',
  array['uuid', 'integer', 'uuid', 'integer', 'integer', 'text', 'text', 'uuid', 'uuid'],
  'anon', array[]::text[],
  'anonymous users cannot execute the series command'
);

select col_has_check('public', 'qr_batches', 'requested_quantity', 'per-Batch quantity remains protected by a CHECK constraint');

select ok(
  pg_get_functiondef('public.request_qr_batch_series(uuid,integer,uuid,integer,integer,text,text,uuid,uuid)'::regprocedure) like '%least(100,%',
  'series splits total quantity into batches of at most 100'
);

select ok(
  pg_get_functiondef('public.request_qr_batch_series(uuid,integer,uuid,integer,integer,text,text,uuid,uuid)'::regprocedure) like '%not between 1 and 10000%',
  'series total is bounded by the existing 10000 item engine contract'
);

select * from finish();
rollback;
