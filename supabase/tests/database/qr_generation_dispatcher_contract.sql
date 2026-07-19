begin;

select plan(20);

select has_function(
  'public',
  'claim_pending_qr_generation_jobs',
  array['integer', 'integer'],
  'server-only bounded generation job claim exists'
);

select has_function(
  'public',
  'record_qr_generation_job_published',
  array['uuid', 'integer', 'text'],
  'server-only queue publication acknowledgement exists'
);

select has_function(
  'public',
  'record_qr_generation_delivery_failure',
  array['uuid', 'integer', 'text', 'timestamp with time zone'],
  'server-only delivery failure acknowledgement exists'
);

select is_definer(
  'public',
  'claim_pending_qr_generation_jobs',
  array['integer', 'integer'],
  'claim mutates the durable ledger inside one reviewed boundary'
);

select is_definer(
  'public',
  'record_qr_generation_job_published',
  array['uuid', 'integer', 'text'],
  'publication acknowledgement and Batch transition are atomic'
);

select is_definer(
  'public',
  'record_qr_generation_delivery_failure',
  array['uuid', 'integer', 'text', 'timestamp with time zone'],
  'delivery failure and retry scheduling are atomic'
);

select function_privs_are(
  'public',
  'claim_pending_qr_generation_jobs',
  array['integer', 'integer'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot claim generation jobs'
);

select function_privs_are(
  'public',
  'record_qr_generation_job_published',
  array['uuid', 'integer', 'text'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot acknowledge queue publication'
);

select function_privs_are(
  'public',
  'record_qr_generation_delivery_failure',
  array['uuid', 'integer', 'text', 'timestamp with time zone'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot schedule a generation retry'
);

select function_privs_are(
  'public',
  'claim_pending_qr_generation_jobs',
  array['integer', 'integer'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot claim generation jobs'
);

select function_privs_are(
  'public',
  'record_qr_generation_job_published',
  array['uuid', 'integer', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot acknowledge queue publication'
);

select function_privs_are(
  'public',
  'record_qr_generation_delivery_failure',
  array['uuid', 'integer', 'text', 'timestamp with time zone'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot schedule a generation retry'
);

select function_privs_are(
  'public',
  'claim_pending_qr_generation_jobs',
  array['integer', 'integer'],
  'service_role',
  array['EXECUTE'],
  'service role can claim generation jobs'
);

select function_privs_are(
  'public',
  'record_qr_generation_job_published',
  array['uuid', 'integer', 'text'],
  'service_role',
  array['EXECUTE'],
  'service role can acknowledge queue publication'
);

select function_privs_are(
  'public',
  'record_qr_generation_delivery_failure',
  array['uuid', 'integer', 'text', 'timestamp with time zone'],
  'service_role',
  array['EXECUTE'],
  'service role can schedule a generation retry'
);

select function_privs_are(
  'app_private',
  'guard_qr_generation_job_update',
  array[]::text[],
  'public',
  array[]::text[],
  'the generation transition guard is not public'
);

select function_privs_are(
  'app_private',
  'guard_qr_generation_job_update',
  array[]::text[],
  'anon',
  array[]::text[],
  'anonymous sessions cannot invoke the generation transition guard'
);

select function_privs_are(
  'app_private',
  'guard_qr_generation_job_update',
  array[]::text[],
  'authenticated',
  array[]::text[],
  'browser sessions cannot invoke the generation transition guard'
);

select results_eq(
  $$
    select 'lock_timeout=3s' = any(proconfig)
    from pg_proc
    where oid = 'public.approve_qr_batch_final_generation(uuid,integer,text,uuid)'::regprocedure
  $$,
  array[true],
  'final generation approval has a bounded Batch lock wait'
);

select results_eq(
  $$
    select 'lock_timeout=3s' = any(proconfig)
    from pg_proc
    where oid = 'public.cancel_qr_batch_before_generation_approval(uuid,integer,text,uuid)'::regprocedure
  $$,
  array[true],
  'pre-generation cancellation has a bounded Batch lock wait'
);

select * from finish();

rollback;
