begin;

select plan(10);

select has_function(
  'public',
  'advance_qr_batch_delivery_as_admin',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'authenticated Super Admin delivery command exists'
);

select is_definer(
  'public',
  'advance_qr_batch_delivery_as_admin',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'delivery status, asset status history, and audit stay atomic'
);

select function_privs_are(
  'public',
  'advance_qr_batch_delivery_as_admin',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'public',
  array[]::text[],
  'public cannot advance delivery'
);

select function_privs_are(
  'public',
  'advance_qr_batch_delivery_as_admin',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot advance delivery'
);

select function_privs_are(
  'public',
  'advance_qr_batch_delivery_as_admin',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated operators may call the guarded delivery command'
);

select has_index(
  'public',
  'audit_logs',
  'uq_audit_logs_qr_batch_delivery_admin_request',
  'delivery requests are idempotent per tenant'
);

select ok(
  pg_get_functiondef(
    'public.advance_qr_batch_delivery_as_admin(uuid,integer,text,text,uuid)'::regprocedure
  ) like '%auth.uid()%',
  'delivery audit uses the authenticated actor'
);

select ok(
  pg_get_functiondef(
    'public.advance_qr_batch_delivery_as_admin(uuid,integer,text,text,uuid)'::regprocedure
  ) like '%current_admin_has_scope%',
  'delivery command checks the central admin scope'
);

select ok(
  pg_get_functiondef(
    'public.advance_qr_batch_delivery_as_admin(uuid,integer,text,text,uuid)'::regprocedure
  ) like '%QR_BATCH_DELIVERY_ADVANCED_BY_ADMIN%',
  'delivery command writes a redacted audit event'
);

select ok(
  pg_get_functiondef(
    'public.advance_qr_batch_delivery_as_admin(uuid,integer,text,text,uuid)'::regprocedure
  ) not like '%phone%',
  'delivery command does not reference phone data'
);

select * from finish();
rollback;
