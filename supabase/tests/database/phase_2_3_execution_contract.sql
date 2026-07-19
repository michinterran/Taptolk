begin;

select plan(30);

select has_table(
  'public',
  'qr_generation_items',
  'generation ordinals are persisted for resumable execution'
);

select table_privs_are(
  'public',
  'qr_generation_items',
  'authenticated',
  array[]::text[],
  'browser sessions cannot read generation credentials or ordinal rows'
);

select has_function(
  'public',
  'start_qr_generation_execution',
  array['uuid', 'integer'],
  'generation execution has an idempotent start command'
);

select function_privs_are(
  'public',
  'start_qr_generation_execution',
  array['uuid', 'integer'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot start generation execution'
);

select function_privs_are(
  'public',
  'start_qr_generation_execution',
  array['uuid', 'integer'],
  'service_role',
  array['EXECUTE'],
  'worker service can start generation execution'
);

select has_function(
  'public',
  'commit_qr_generation_chunk',
  array['uuid', 'integer', 'jsonb'],
  'generation chunks commit through one transaction command'
);

select function_privs_are(
  'public',
  'commit_qr_generation_chunk',
  array['uuid', 'integer', 'jsonb'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot commit generated secrets'
);

select function_privs_are(
  'public',
  'commit_qr_generation_chunk',
  array['uuid', 'integer', 'jsonb'],
  'service_role',
  array['EXECUTE'],
  'worker service can commit generation chunks'
);

select has_function(
  'public',
  'complete_qr_generation_execution',
  array['uuid', 'integer'],
  'generation completion validates the full requested quantity'
);

select function_privs_are(
  'public',
  'complete_qr_generation_execution',
  array['uuid', 'integer'],
  'service_role',
  array['EXECUTE'],
  'worker service can complete generation'
);

select has_function(
  'public',
  'record_qr_generation_execution_failure',
  array['uuid', 'integer', 'text'],
  'generation failures preserve progress and enforce bounded retries'
);

select function_privs_are(
  'public',
  'record_qr_generation_execution_failure',
  array['uuid', 'integer', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot mutate worker retry state'
);

select function_privs_are(
  'public',
  'record_qr_generation_execution_failure',
  array['uuid', 'integer', 'text'],
  'service_role',
  array['EXECUTE'],
  'worker service can record allowlisted generation failures'
);

select has_function(
  'public',
  'record_qr_print_export_failure',
  array['uuid', 'text'],
  'print export failures have a terminal worker command'
);

select function_privs_are(
  'public',
  'record_qr_print_export_failure',
  array['uuid', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot mark print export failed'
);

select function_privs_are(
  'public',
  'record_qr_print_export_failure',
  array['uuid', 'text'],
  'service_role',
  array['EXECUTE'],
  'worker service can terminate exhausted print retries'
);

select has_function(
  'public',
  'get_qr_print_export_context',
  array['uuid'],
  'print export reads only quality-checked generation context'
);

select function_privs_are(
  'public',
  'get_qr_print_export_context',
  array['uuid'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot read print source credentials'
);

select function_privs_are(
  'public',
  'get_qr_print_export_context',
  array['uuid'],
  'service_role',
  array['EXECUTE'],
  'worker service can read print export context'
);

select has_function(
  'public',
  'commit_qr_print_exports',
  array['uuid', 'integer', 'jsonb'],
  'print artifacts commit with checksums and batch transition'
);

select function_privs_are(
  'public',
  'commit_qr_print_exports',
  array['uuid', 'integer', 'jsonb'],
  'service_role',
  array['EXECUTE'],
  'worker service can commit print exports'
);

select has_function(
  'public',
  'list_qr_batch_progress_read_model',
  array[]::text[],
  'scoped generation and export progress read model exists'
);

select function_privs_are(
  'public',
  'list_qr_batch_progress_read_model',
  array[]::text[],
  'anon',
  array[]::text[],
  'anonymous sessions cannot inspect batch progress'
);

select function_privs_are(
  'public',
  'list_qr_batch_progress_read_model',
  array[]::text[],
  'authenticated',
  array['EXECUTE'],
  'authenticated operators can inspect scoped batch progress'
);

select has_function(
  'public',
  'register_brand_asset',
  array[
    'uuid',
    'uuid',
    'uuid',
    'text',
    'text',
    'text',
    'text',
    'text',
    'integer',
    'integer',
    'integer',
    'text',
    'text',
    'uuid'
  ],
  'brand asset metadata registers through an audited command'
);

select has_function(
  'public',
  'get_qr_sample_render_context',
  array['uuid'],
  'sample rendering resolves the approved design on the server'
);

select function_privs_are(
  'public',
  'get_qr_sample_render_context',
  array['uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot read render context'
);

select function_privs_are(
  'public',
  'get_qr_sample_render_context',
  array['uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated scoped operators can render samples'
);

select has_trigger(
  'public',
  'sticker_design_versions',
  'trg_sticker_design_config_guard',
  'design structure and customer logo scope are database guarded'
);

select has_function(
  'app_private',
  'validate_sticker_design_config',
  array[]::text[],
  'private design validator enforces canonical sticker zones'
);

select * from finish();

rollback;
