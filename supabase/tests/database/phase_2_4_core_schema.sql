begin;

select plan(62);

select enum_has_labels(
  'public',
  'brand_asset_type',
  array[
    'MANAGEMENT_COMPANY_LOGO',
    'SITE_LOGO',
    'TAPTOLK_LOGO',
    'BACKGROUND_TEMPLATE',
    'DECORATION'
  ],
  'brand asset purposes are explicit'
);

select has_table('public', 'brand_assets', 'tenant-scoped brand asset ledger exists');
select has_table('public', 'sticker_templates', 'immutable sticker template catalog exists');
select has_table('public', 'qr_activation_codes', 'activation credentials are separate from public tokens');
select has_table('public', 'render_jobs', 'render progress ledger exists');
select has_table('public', 'rendered_assets', 'rendered artifact quality evidence exists');
select has_table('public', 'print_exports', 'print export manifest exists');
select has_table('public', 'vehicles', 'protected vehicle registry exists');
select has_table('public', 'qr_bindings', 'QR and vehicle binding history exists');
select has_table('public', 'inventory_transactions', 'append-only inventory ledger exists');
select has_table('public', 'vehicle_imports', 'CSV validation and commit ledger exists');
select has_table('public', 'vehicle_import_rows', 'protected CSV staging rows exist');

select policies_are(
  'public',
  'brand_assets',
  array['brand_assets_select_scoped'],
  'brand assets expose only scoped reads'
);

select policies_are(
  'public',
  'sticker_templates',
  array['sticker_templates_select_authenticated'],
  'active templates are authenticated catalog data'
);

select policies_are(
  'public',
  'render_jobs',
  array['render_jobs_select_scoped'],
  'render progress is site scoped'
);

select policies_are(
  'public',
  'rendered_assets',
  array['rendered_assets_select_scoped'],
  'render artifacts are site scoped'
);

select policies_are(
  'public',
  'print_exports',
  array['print_exports_select_scoped'],
  'print exports are site scoped'
);

select policies_are(
  'public',
  'vehicles',
  array['vehicles_select_scoped'],
  'protected vehicles are site scoped'
);

select policies_are(
  'public',
  'qr_bindings',
  array['qr_bindings_select_scoped'],
  'binding history is site scoped'
);

select policies_are(
  'public',
  'inventory_transactions',
  array['inventory_transactions_select_scoped'],
  'inventory history is site scoped'
);

select policies_are(
  'public',
  'vehicle_imports',
  array['vehicle_imports_select_scoped'],
  'CSV import metadata is site scoped'
);

select table_privs_are(
  'public',
  'qr_activation_codes',
  'authenticated',
  array[]::text[],
  'activation secrets are never browser readable'
);

select table_privs_are(
  'public',
  'vehicle_import_rows',
  'authenticated',
  array[]::text[],
  'protected import rows are RPC-only'
);

select has_index(
  'public',
  'qr_bindings',
  'uq_qr_active_binding',
  'one QR has at most one active binding'
);

select has_index(
  'public',
  'qr_bindings',
  'uq_vehicle_primary_active_qr',
  'one vehicle has at most one active primary QR'
);

select has_index(
  'public',
  'sticker_templates',
  'sticker_templates_template_code_key',
  'template code is globally unique'
);

select has_index(
  'public',
  'vehicle_imports',
  'uq_vehicle_imports_idempotency',
  'CSV validation is idempotent per tenant'
);

select has_trigger(
  'public',
  'sticker_templates',
  'trg_sticker_templates_immutable',
  'template versions cannot be edited in place'
);

select has_trigger(
  'public',
  'qr_bindings',
  'trg_qr_bindings_guard',
  'active bindings can only transition to ended history'
);

select has_trigger(
  'public',
  'qr_bindings',
  'trg_qr_bindings_no_delete',
  'binding history cannot be deleted'
);

select has_trigger(
  'public',
  'inventory_transactions',
  'trg_inventory_transactions_no_update_delete',
  'inventory history is append-only'
);

select has_trigger(
  'public',
  'rendered_assets',
  'trg_rendered_assets_no_update_delete',
  'render quality evidence is append-only'
);

select has_function(
  'public',
  'receive_qr_batch',
  array['uuid', 'integer', 'text', 'uuid'],
  'Batch receipt transaction exists'
);

select has_function(
  'public',
  'assign_qr_asset',
  array['uuid', 'integer', 'text', 'text', 'integer', 'text', 'text', 'uuid'],
  'manual assignment transaction exists'
);

select has_function(
  'public',
  'save_validated_vehicle_import',
  array['uuid', 'text', 'uuid', 'jsonb', 'text', 'uuid'],
  'validated CSV metadata transaction exists'
);

select has_function(
  'public',
  'commit_vehicle_import',
  array['uuid', 'integer', 'text', 'uuid'],
  'CSV assignment commit transaction exists'
);

select has_function(
  'public',
  'replace_qr_asset',
  array['uuid', 'uuid', 'integer', 'integer', 'text', 'uuid'],
  'replacement transaction exists'
);

select has_function(
  'public',
  'revoke_qr_asset',
  array['uuid', 'integer', 'text', 'uuid'],
  'revocation transaction exists'
);

select is_definer(
  'public',
  'receive_qr_batch',
  array['uuid', 'integer', 'text', 'uuid'],
  'receipt, status history, inventory, and audit are atomic'
);

select is_definer(
  'public',
  'assign_qr_asset',
  array['uuid', 'integer', 'text', 'text', 'integer', 'text', 'text', 'uuid'],
  'manual assignment and audit are atomic'
);

select is_definer(
  'public',
  'save_validated_vehicle_import',
  array['uuid', 'text', 'uuid', 'jsonb', 'text', 'uuid'],
  'CSV validation metadata and audit are atomic'
);

select is_definer(
  'public',
  'commit_vehicle_import',
  array['uuid', 'integer', 'text', 'uuid'],
  'all CSV bindings commit or roll back together'
);

select is_definer(
  'public',
  'replace_qr_asset',
  array['uuid', 'uuid', 'integer', 'integer', 'text', 'uuid'],
  'replacement preserves and atomically transfers binding history'
);

select is_definer(
  'public',
  'revoke_qr_asset',
  array['uuid', 'integer', 'text', 'uuid'],
  'revocation ends binding and appends audit atomically'
);

select function_privs_are(
  'public',
  'receive_qr_batch',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot receive inventory'
);

select function_privs_are(
  'public',
  'assign_qr_asset',
  array['uuid', 'integer', 'text', 'text', 'integer', 'text', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot assign QR assets'
);

select function_privs_are(
  'public',
  'save_validated_vehicle_import',
  array['uuid', 'text', 'uuid', 'jsonb', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot stage imports'
);

select function_privs_are(
  'public',
  'commit_vehicle_import',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot commit imports'
);

select function_privs_are(
  'public',
  'replace_qr_asset',
  array['uuid', 'uuid', 'integer', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot replace QR assets'
);

select function_privs_are(
  'public',
  'revoke_qr_asset',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot revoke QR assets'
);

select function_privs_are(
  'public',
  'receive_qr_batch',
  array['uuid', 'integer', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated receipt is RPC-only'
);

select function_privs_are(
  'public',
  'assign_qr_asset',
  array['uuid', 'integer', 'text', 'text', 'integer', 'text', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated assignment is RPC-only'
);

select function_privs_are(
  'public',
  'save_validated_vehicle_import',
  array['uuid', 'text', 'uuid', 'jsonb', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated CSV validation is RPC-only'
);

select function_privs_are(
  'public',
  'commit_vehicle_import',
  array['uuid', 'integer', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated CSV commit is RPC-only'
);

select function_privs_are(
  'public',
  'replace_qr_asset',
  array['uuid', 'uuid', 'integer', 'integer', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated replacement is RPC-only'
);

select function_privs_are(
  'public',
  'revoke_qr_asset',
  array['uuid', 'integer', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated revocation is RPC-only'
);

select has_function(
  'app_private',
  'current_admin_has_site_scope',
  array['uuid', 'uuid', 'text[]'],
  'site scope resolves its management company server-side'
);

select function_privs_are(
  'app_private',
  'current_admin_has_site_scope',
  array['uuid', 'uuid', 'text[]'],
  'authenticated',
  array['EXECUTE'],
  'authenticated RLS can evaluate site scope without table mutation access'
);

select has_function(
  'public',
  'list_phase_4_inventory_read_model',
  array[]::text[],
  'redacted Phase 4 inventory read model exists'
);

select is_definer(
  'public',
  'list_phase_4_inventory_read_model',
  array[]::text[],
  'inventory scope and vehicle masking are database evaluated'
);

select function_privs_are(
  'public',
  'list_phase_4_inventory_read_model',
  array[]::text[],
  'anon',
  array[]::text[],
  'anonymous sessions cannot inspect inventory'
);

select function_privs_are(
  'public',
  'list_phase_4_inventory_read_model',
  array[]::text[],
  'authenticated',
  array['EXECUTE'],
  'authenticated inventory reads are RPC-only'
);

select * from finish();

rollback;
