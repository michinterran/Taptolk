begin;

select plan(20);

select has_function(
  'public',
  'provision_qr_generation_staging_acceptance',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text'],
  'bounded 10x100 staging acceptance provisioning exists'
);

select is_definer(
  'public',
  'provision_qr_generation_staging_acceptance',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text'],
  'acceptance provisioning verifies its ephemeral fixture boundary'
);

select function_privs_are(
  'public',
  'provision_qr_generation_staging_acceptance',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot provision acceptance Batches'
);

select function_privs_are(
  'public',
  'provision_qr_generation_staging_acceptance',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot provision acceptance Batches'
);

select function_privs_are(
  'public',
  'provision_qr_generation_staging_acceptance',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'text'],
  'service_role',
  array['EXECUTE'],
  'only the staging service runtime can provision acceptance Batches'
);

select has_function(
  'public',
  'inspect_qr_generation_staging_acceptance_queue',
  array['uuid[]', 'text'],
  'count-only acceptance Queue inspection exists'
);

select is_definer(
  'public',
  'inspect_qr_generation_staging_acceptance_queue',
  array['uuid[]', 'text'],
  'Queue inspection stays behind the server trust boundary'
);

select function_privs_are(
  'public',
  'inspect_qr_generation_staging_acceptance_queue',
  array['uuid[]', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot inspect Queue acceptance evidence'
);

select function_privs_are(
  'public',
  'inspect_qr_generation_staging_acceptance_queue',
  array['uuid[]', 'text'],
  'service_role',
  array['EXECUTE'],
  'staging service can inspect count-only Queue evidence'
);

select has_function(
  'public',
  'cleanup_qr_generation_staging_acceptance_queue',
  array['uuid[]', 'text'],
  'bounded Queue residue cleanup exists'
);

select is_definer(
  'public',
  'cleanup_qr_generation_staging_acceptance_queue',
  array['uuid[]', 'text'],
  'Queue cleanup verifies acceptance identities before deleting'
);

select function_privs_are(
  'public',
  'cleanup_qr_generation_staging_acceptance_queue',
  array['uuid[]', 'text'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot clean Queue history'
);

select function_privs_are(
  'public',
  'cleanup_qr_generation_staging_acceptance_queue',
  array['uuid[]', 'text'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot clean Queue history'
);

select function_privs_are(
  'public',
  'cleanup_qr_generation_staging_acceptance_queue',
  array['uuid[]', 'text'],
  'service_role',
  array['EXECUTE'],
  'only the staging service runtime can clean acceptance Queue history'
);

select col_is_unique(
  'public',
  'qr_generation_items',
  array['generation_job_id', 'ordinal'],
  'job ordinal identity remains unique during resume'
);

select col_is_unique(
  'public',
  'qr_generation_items',
  array['generation_job_id', 'qr_asset_id'],
  'job QR Asset identity remains unique during resume'
);

select results_eq(
  $$
    select pg_get_constraintdef(oid) like '%requested_quantity >= 1%requested_quantity <= 100%'
    from pg_constraint
    where conrelid = 'public.qr_batches'::regclass
      and conname = 'chk_qr_batches_requested_quantity'
  $$,
  array[true],
  'per-Batch quantity policy remains 1 through 100'
);

select results_eq(
  $$
    select position(
      'for batch_index in 1..10 loop'
      in lower(pg_get_functiondef(
        'public.provision_qr_generation_staging_acceptance(uuid,uuid,uuid,uuid,uuid,text)'::regprocedure
      ))
    ) > 0
      and position(
        'requested_quantity'
        in lower(pg_get_functiondef(
          'public.provision_qr_generation_staging_acceptance(uuid,uuid,uuid,uuid,uuid,text)'::regprocedure
        ))
      ) > 0
  $$,
  array[true],
  'acceptance composes ten normal Batches instead of widening one Batch'
);

select results_eq(
  $$
    select position(
      'selected_generation_revision'
      in pg_get_functiondef('public.get_qr_print_export_context(uuid)'::regprocedure)
    ) > 0
      and position(
        'job.generation_revision = generation_revision'
        in pg_get_functiondef('public.get_qr_print_export_context(uuid)'::regprocedure)
      ) = 0
  $$,
  array[true],
  'print export context keeps its PL/pgSQL revision variable unambiguous'
);

select results_eq(
  $$
    select file_size_limit
    from storage.buckets
    where id = 'qr-artifacts'
  $$,
  array[50000000::bigint],
  'private QR artifact storage accepts one 100-item print bundle'
);

select * from finish();

rollback;
