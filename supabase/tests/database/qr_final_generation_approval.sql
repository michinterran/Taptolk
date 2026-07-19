begin;

select plan(30);

select enum_has_labels(
  'public',
  'qr_generation_job_status',
  array[
    'PENDING_DELIVERY',
    'DELIVERY_LEASED',
    'QUEUED',
    'PROCESSING',
    'RETRY_WAIT',
    'COMPLETED',
    'FAILED',
    'ABORTED',
    'PARTIALLY_COMPLETED'
  ],
  'generation delivery and execution states are explicit'
);

select has_table('public', 'qr_generation_jobs', 'durable generation job ledger exists');

select policies_are(
  'public',
  'qr_generation_jobs',
  array['qr_generation_jobs_select_scoped'],
  'generation jobs expose one platform-scoped read policy'
);

select table_privs_are(
  'public',
  'qr_generation_jobs',
  'authenticated',
  array[]::text[],
  'browser sessions have no direct generation job table privilege'
);

select table_privs_are(
  'public',
  'qr_generation_jobs',
  'service_role',
  array['DELETE', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE'],
  'service role can inspect and clean durable jobs without INSERT or UPDATE'
);

select has_function(
  'public',
  'request_qr_batch_final_approval',
  array['uuid', 'integer', 'text', 'uuid'],
  'requester final approval command exists'
);

select has_function(
  'public',
  'approve_qr_batch_final_generation',
  array['uuid', 'integer', 'text', 'uuid'],
  'Super Admin generation approval command exists'
);

select has_function(
  'public',
  'cancel_qr_batch_before_generation_approval',
  array['uuid', 'integer', 'text', 'uuid'],
  'requester pre-generation cancellation command exists'
);

select has_function(
  'public',
  'get_qr_final_generation_approval_batch',
  array['uuid'],
  'authoritative command snapshot exists'
);

select has_function(
  'public',
  'list_qr_final_generation_approval_read_model',
  array[]::text[],
  'redacted final approval queue read model exists'
);

select is_definer(
  'public',
  'request_qr_batch_final_approval',
  array['uuid', 'integer', 'text', 'uuid'],
  'request transition and audit are atomic'
);

select is_definer(
  'public',
  'approve_qr_batch_final_generation',
  array['uuid', 'integer', 'text', 'uuid'],
  'approval, durable job intent, and audit are atomic'
);

select is_definer(
  'public',
  'cancel_qr_batch_before_generation_approval',
  array['uuid', 'integer', 'text', 'uuid'],
  'pre-generation cancellation and audit are atomic'
);

select is_definer(
  'public',
  'get_qr_final_generation_approval_batch',
  array['uuid'],
  'command snapshot reduces actor identity in the database'
);

select is_definer(
  'public',
  'list_qr_final_generation_approval_read_model',
  array[]::text[],
  'approval queue scope and actor booleans are database evaluated'
);

select function_privs_are(
  'public',
  'request_qr_batch_final_approval',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot request final approval'
);

select function_privs_are(
  'public',
  'approve_qr_batch_final_generation',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot approve generation'
);

select function_privs_are(
  'public',
  'cancel_qr_batch_before_generation_approval',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot cancel before generation'
);

select function_privs_are(
  'public',
  'get_qr_final_generation_approval_batch',
  array['uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot load command snapshots'
);

select function_privs_are(
  'public',
  'list_qr_final_generation_approval_read_model',
  array[]::text[],
  'anon',
  array[]::text[],
  'anonymous sessions cannot read final approval queues'
);

select function_privs_are(
  'public',
  'request_qr_batch_final_approval',
  array['uuid', 'integer', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated requester command is RPC-only'
);

select function_privs_are(
  'public',
  'approve_qr_batch_final_generation',
  array['uuid', 'integer', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated final approval remains server-reviewed'
);

select function_privs_are(
  'public',
  'cancel_qr_batch_before_generation_approval',
  array['uuid', 'integer', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated cancellation remains server-reviewed'
);

select has_index(
  'public',
  'qr_generation_jobs',
  'uq_qr_generation_jobs_approval_request',
  'one approval request creates one durable generation job'
);

select has_index(
  'public',
  'qr_generation_jobs',
  'uq_qr_generation_jobs_revision',
  'one generation job exists per Batch revision and type'
);

select col_is_fk(
  'public',
  'qr_generation_jobs',
  'qr_batch_id',
  'generation job is constrained to the same-scope Batch'
);

select has_trigger(
  'public',
  'qr_generation_jobs',
  'trg_qr_generation_jobs_guard',
  'generation job identity and transitions are guarded'
);

select has_trigger(
  'public',
  'qr_generation_jobs',
  'trg_qr_generation_jobs_touch',
  'generation job updates increment optimistic version'
);

select has_function(
  'app_private',
  'guard_qr_generation_job_update',
  array[]::text[],
  'private generation job transition guard exists'
);

select function_privs_are(
  'app_private',
  'guard_qr_generation_job_update',
  array[]::text[],
  'authenticated',
  array[]::text[],
  'browser sessions cannot execute private job guards'
);

select * from finish();

rollback;
