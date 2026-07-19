begin;

select plan(14);

select has_function(
  'public',
  'advance_qr_batch_delivery',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'service delivery transition transaction exists'
);

select is_definer(
  'public',
  'advance_qr_batch_delivery',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'delivery status, printed assets, history, and audit are atomic'
);

select function_privs_are(
  'public',
  'advance_qr_batch_delivery',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot advance delivery'
);

select function_privs_are(
  'public',
  'advance_qr_batch_delivery',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot advance delivery'
);

select function_privs_are(
  'public',
  'advance_qr_batch_delivery',
  array['uuid', 'integer', 'text', 'text', 'uuid'],
  'service_role',
  array['EXECUTE'],
  'only the service runtime advances delivery'
);

select has_function(
  'public',
  'cleanup_staging_e2e_fixture',
  array['uuid[]', 'uuid[]'],
  'bounded staging cleanup transaction exists'
);

select is_definer(
  'public',
  'cleanup_staging_e2e_fixture',
  array['uuid[]', 'uuid[]'],
  'fixture cleanup can remove only verified ephemeral hierarchy data'
);

select function_privs_are(
  'public',
  'cleanup_staging_e2e_fixture',
  array['uuid[]', 'uuid[]'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot clean fixtures'
);

select function_privs_are(
  'public',
  'cleanup_staging_e2e_fixture',
  array['uuid[]', 'uuid[]'],
  'authenticated',
  array[]::text[],
  'browser sessions cannot clean fixtures'
);

select function_privs_are(
  'public',
  'cleanup_staging_e2e_fixture',
  array['uuid[]', 'uuid[]'],
  'service_role',
  array['EXECUTE'],
  'only the server fixture runtime can clean ephemeral data'
);

select has_trigger(
  'public',
  'qr_bindings',
  'trg_qr_bindings_no_delete',
  'binding history remains immutable outside bounded cleanup'
);

select has_trigger(
  'public',
  'inventory_transactions',
  'trg_inventory_transactions_no_update_delete',
  'inventory history remains immutable outside bounded cleanup'
);

select has_trigger(
  'public',
  'rendered_assets',
  'trg_rendered_assets_no_update_delete',
  'render evidence remains immutable outside bounded cleanup'
);

select has_trigger(
  'public',
  'qr_asset_status_logs',
  'trg_qr_asset_status_logs_immutable',
  'status history remains immutable outside bounded cleanup'
);

select * from finish();

rollback;
