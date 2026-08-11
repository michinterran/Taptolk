begin;

select plan(7);

select has_table(
  'public',
  'qr_batch_receipts',
  'partial QR receipt history is stored separately from the batch identity'
);
select has_column(
  'public',
  'qr_batch_receipts',
  'received_quantity',
  'receipt quantity is explicit'
);
select has_column(
  'public',
  'qr_batch_receipts',
  'reason',
  'receipt reason is retained for audit'
);
select has_index(
  'public',
  'qr_batch_receipts',
  'uq_qr_batch_receipts_request',
  'receipt requests are idempotent per tenant'
);
select policies_are(
  'public',
  'qr_batch_receipts',
  array['qr_batch_receipts_select_scoped'],
  'receipt history has one scoped select policy'
);
select has_function(
  'public',
  'receive_qr_batch_quantity',
  array['uuid', 'integer', 'integer', 'text', 'uuid'],
  'partial receipt command exists'
);
select function_privs_are(
  'public',
  'receive_qr_batch_quantity',
  array['uuid', 'integer', 'integer', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated operators may call the receipt command'
);
select pg_get_functiondef(
  'public.receive_qr_batch_quantity(uuid,integer,integer,text,uuid)'::regprocedure
) like '%current_admin_has_scope%';
select pg_get_functiondef(
  'public.receive_qr_batch_quantity(uuid,integer,integer,text,uuid)'::regprocedure
) like '%QR_BATCH_PARTIAL_RECEIVED%';
select pg_get_functiondef(
  'public.receive_qr_batch_quantity(uuid,integer,integer,text,uuid)'::regprocedure
) not like '%phone%';

select * from finish();
rollback;
