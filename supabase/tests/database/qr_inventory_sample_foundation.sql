begin;

select plan(66);

select enum_has_labels(
  'public',
  'sticker_design_status',
  array['DRAFT', 'APPROVED', 'ARCHIVED'],
  'Sticker Design state machine is explicit'
);

select enum_has_labels(
  'public',
  'qr_batch_sample_status',
  array['READY', 'APPROVED', 'INVALIDATED'],
  'sample approval and terminal invalidation are distinct'
);

select enum_has_labels(
  'public',
  'qr_asset_status',
  array[
    'GENERATED',
    'PRINT_READY',
    'PRINTED',
    'IN_STOCK',
    'ASSIGNED',
    'ACTIVATION_PENDING',
    'ACTIVE',
    'SUSPENDED',
    'LOST',
    'DAMAGED',
    'REPLACED',
    'REVOKED',
    'EXPIRED'
  ],
  'QR Asset inventory lifecycle is frozen'
);

select enum_has_labels(
  'public',
  'qr_batch_status',
  array[
    'DRAFT',
    'SAMPLE_RENDERING',
    'SAMPLE_READY',
    'SAMPLE_APPROVED',
    'FINAL_APPROVAL_PENDING',
    'GENERATION_APPROVED',
    'GENERATION_QUEUED',
    'GENERATING',
    'GENERATED',
    'QUALITY_CHECKED',
    'PRINT_FILE_READY',
    'SENT_TO_PRINTER',
    'PRINTED',
    'SHIPPED',
    'DELIVERED',
    'DISTRIBUTING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'PARTIALLY_COMPLETED'
  ],
  'sample and final generation approval states cannot be conflated'
);

select has_table('public', 'sticker_design_versions', 'Design Version table exists');
select has_table('public', 'qr_batches', 'QR Batch table exists');
select has_table('public', 'qr_batch_samples', 'retained sample artifact table exists');
select has_table('public', 'qr_assets', 'QR Asset inventory table exists');
select has_table('public', 'qr_asset_status_logs', 'QR Asset history table exists');

select policies_are(
  'public',
  'sticker_design_versions',
  array['sticker_design_versions_select_scoped'],
  'Design Versions expose one scoped read policy'
);

select policies_are(
  'public',
  'qr_batches',
  array['qr_batches_select_scoped'],
  'QR Batches expose one scoped read policy'
);

select policies_are(
  'public',
  'qr_batch_samples',
  array['qr_batch_samples_select_scoped'],
  'sample evidence exposes one scoped read policy'
);

select policies_are(
  'public',
  'qr_assets',
  array['qr_assets_select_scoped'],
  'QR Assets expose one scoped read policy'
);

select policies_are(
  'public',
  'qr_asset_status_logs',
  array['qr_asset_status_logs_select_scoped'],
  'QR Asset history exposes one scoped read policy'
);

select table_privs_are(
  'public',
  'sticker_design_versions',
  'authenticated',
  array[]::text[],
  'Design Version browser access is limited to safe column grants'
);

select table_privs_are(
  'public',
  'qr_batches',
  'authenticated',
  array[]::text[],
  'QR Batch browser access is limited to safe column grants'
);

select table_privs_are(
  'public',
  'qr_batch_samples',
  'authenticated',
  array[]::text[],
  'sample table access is limited to safe column grants'
);

select table_privs_are(
  'public',
  'qr_assets',
  'authenticated',
  array[]::text[],
  'QR Asset access is limited to safe column grants'
);

select table_privs_are(
  'public',
  'qr_asset_status_logs',
  'authenticated',
  array['SELECT'],
  'browser sessions cannot mutate QR Asset history'
);

select has_function(
  'public',
  'create_sticker_design_version',
  array['uuid', 'integer', 'text', 'jsonb', 'text', 'uuid'],
  'Design creation command exists'
);

select has_function(
  'public',
  'approve_sticker_design_version',
  array['uuid', 'integer', 'text', 'uuid'],
  'Design approval command exists'
);

select has_function(
  'public',
  'archive_sticker_design_version',
  array['uuid', 'integer', 'text', 'uuid'],
  'Design archive command exists'
);

select has_function(
  'public',
  'request_qr_batch',
  array['uuid', 'integer', 'uuid', 'integer', 'integer', 'text', 'text', 'uuid', 'uuid'],
  'small Batch request command exists'
);

select has_function(
  'public',
  'attach_qr_batch_sample',
  array[
    'uuid',
    'integer',
    'text',
    'text',
    'text',
    'text',
    'integer',
    'boolean',
    'boolean',
    'boolean',
    'text',
    'uuid'
  ],
  'sample attachment command exists'
);

select has_function(
  'public',
  'approve_qr_batch_sample',
  array['uuid', 'integer', 'uuid', 'integer', 'text', 'uuid'],
  'sample approval command exists'
);

select has_function(
  'public',
  'invalidate_qr_batch_sample',
  array['uuid', 'integer', 'uuid', 'integer', 'text', 'uuid'],
  'sample invalidation command exists'
);

select has_function(
  'public',
  'cancel_qr_batch',
  array['uuid', 'integer', 'text', 'uuid'],
  'Batch requester cancellation command exists'
);

select has_function(
  'public',
  'list_qr_inventory_sample_read_model',
  array[]::text[],
  'scoped actor-redacted QR inventory read model exists'
);

select is_definer(
  'public',
  'create_sticker_design_version',
  array['uuid', 'integer', 'text', 'jsonb', 'text', 'uuid'],
  'Design creation and audit are atomic'
);

select is_definer(
  'public',
  'approve_sticker_design_version',
  array['uuid', 'integer', 'text', 'uuid'],
  'Design approval and audit are atomic'
);

select is_definer(
  'public',
  'archive_sticker_design_version',
  array['uuid', 'integer', 'text', 'uuid'],
  'Design archive and audit are atomic'
);

select is_definer(
  'public',
  'request_qr_batch',
  array['uuid', 'integer', 'uuid', 'integer', 'integer', 'text', 'text', 'uuid', 'uuid'],
  'Batch request and audit are atomic'
);

select is_definer(
  'public',
  'attach_qr_batch_sample',
  array[
    'uuid',
    'integer',
    'text',
    'text',
    'text',
    'text',
    'integer',
    'boolean',
    'boolean',
    'boolean',
    'text',
    'uuid'
  ],
  'sample attach, Batch transition, and audit are atomic'
);

select is_definer(
  'public',
  'approve_qr_batch_sample',
  array['uuid', 'integer', 'uuid', 'integer', 'text', 'uuid'],
  'sample and Batch approval plus audit are atomic'
);

select is_definer(
  'public',
  'invalidate_qr_batch_sample',
  array['uuid', 'integer', 'uuid', 'integer', 'text', 'uuid'],
  'sample invalidation and Batch reset plus audit are atomic'
);

select is_definer(
  'public',
  'cancel_qr_batch',
  array['uuid', 'integer', 'text', 'uuid'],
  'Batch cancellation and audit are atomic'
);

select is_definer(
  'public',
  'list_qr_inventory_sample_read_model',
  array[]::text[],
  'QR inventory identity reduction is evaluated inside the database'
);

select function_privs_are(
  'public',
  'create_sticker_design_version',
  array['uuid', 'integer', 'text', 'jsonb', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot create Designs'
);

select function_privs_are(
  'public',
  'approve_sticker_design_version',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot approve Designs'
);

select function_privs_are(
  'public',
  'archive_sticker_design_version',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot archive Designs'
);

select function_privs_are(
  'public',
  'request_qr_batch',
  array['uuid', 'integer', 'uuid', 'integer', 'integer', 'text', 'text', 'uuid', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot request Batches'
);

select function_privs_are(
  'public',
  'attach_qr_batch_sample',
  array[
    'uuid',
    'integer',
    'text',
    'text',
    'text',
    'text',
    'integer',
    'boolean',
    'boolean',
    'boolean',
    'text',
    'uuid'
  ],
  'anon',
  array[]::text[],
  'anonymous sessions cannot attach samples'
);

select function_privs_are(
  'public',
  'approve_qr_batch_sample',
  array['uuid', 'integer', 'uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot approve samples'
);

select function_privs_are(
  'public',
  'invalidate_qr_batch_sample',
  array['uuid', 'integer', 'uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot invalidate samples'
);

select function_privs_are(
  'public',
  'cancel_qr_batch',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot cancel Batches'
);

select function_privs_are(
  'public',
  'list_qr_inventory_sample_read_model',
  array[]::text[],
  'anon',
  array[]::text[],
  'anonymous sessions cannot read QR inventory'
);

select has_index(
  'public',
  'sticker_design_versions',
  'uq_sticker_design_versions_site_draft',
  'one Design DRAFT is allowed per Site'
);

select has_index(
  'public',
  'sticker_design_versions',
  'uq_sticker_design_versions_site_approved',
  'one approved Design is active per Site'
);

select has_index(
  'public',
  'qr_batch_samples',
  'uq_qr_batch_samples_active_batch',
  'one non-invalidated sample is allowed per Batch'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.qr_assets',
    'public_token_hash',
    'SELECT'
  ),
  'browser sessions cannot read the public token hash'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.qr_assets',
    'public_token_ciphertext',
    'SELECT'
  ),
  'browser sessions cannot read token ciphertext'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.qr_assets',
    'token_key_version',
    'SELECT'
  ),
  'browser sessions cannot read token encryption key versions'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.sticker_design_versions',
    'created_by',
    'SELECT'
  ),
  'browser sessions cannot read Design creator identities'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.qr_batches',
    'requested_by',
    'SELECT'
  ),
  'browser sessions cannot read Batch requester identities'
);

select col_is_fk(
  'public',
  'sticker_design_versions',
  array['tenant_id', 'management_company_id', 'site_id']::name[],
  'Design Version is constrained to a Site'
);

select col_is_fk(
  'public',
  'qr_batches',
  array[
    'tenant_id',
    'management_company_id',
    'site_id',
    'sticker_design_version_id'
  ]::name[],
  'Batch is constrained to a same-scope Design Version'
);

select col_is_fk(
  'public',
  'qr_batch_samples',
  array['tenant_id', 'management_company_id', 'site_id', 'batch_id']::name[],
  'sample is constrained to a same-scope Batch'
);

select col_is_fk(
  'public',
  'qr_assets',
  array['tenant_id', 'management_company_id', 'site_id', 'batch_id']::name[],
  'QR Asset is constrained to a same-scope Batch'
);

select col_is_fk(
  'public',
  'qr_asset_status_logs',
  array[
    'tenant_id',
    'management_company_id',
    'site_id',
    'batch_id',
    'qr_asset_id'
  ]::name[],
  'QR Asset history is constrained to the same Asset scope'
);

select has_trigger(
  'public',
  'sticker_design_versions',
  'trg_sticker_design_versions_guard',
  'Design Version identity and transitions are guarded'
);

select has_trigger(
  'public',
  'qr_batches',
  'trg_qr_batches_guard',
  'Batch identity and sample-slice transitions are guarded'
);

select has_trigger(
  'public',
  'qr_batch_samples',
  'trg_qr_batch_samples_guard',
  'sample artifact identity and terminal history are guarded'
);

select has_trigger(
  'public',
  'qr_asset_status_logs',
  'trg_qr_asset_status_logs_immutable',
  'QR Asset lifecycle history is append-only'
);

insert into auth.users (id)
values
  ('f0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002');

insert into public.tenants (id, name, slug)
values (
  'f0000000-0000-4000-8000-000000000010',
  'Task 0 quantity contract',
  'task0-quantity-contract'
);

insert into public.management_companies (
  id,
  tenant_id,
  name,
  address,
  business_number,
  contact_name,
  contact_email
)
values (
  'f0000000-0000-4000-8000-000000000020',
  'f0000000-0000-4000-8000-000000000010',
  'Task 0 management',
  'Test address',
  '0000000002',
  'Test contact',
  'qr-inventory@example.test'
);

insert into public.sites (
  id,
  tenant_id,
  management_company_id,
  name,
  address,
  contract_vehicle_limit
)
values (
  'f0000000-0000-4000-8000-000000000030',
  'f0000000-0000-4000-8000-000000000010',
  'f0000000-0000-4000-8000-000000000020',
  'Task 0 site',
  'Test address',
  100
);

insert into public.admin_memberships (
  id,
  user_id,
  tenant_id,
  management_company_id,
  site_id,
  role,
  scope_type,
  status,
  accepted_at
)
values (
  'f0000000-0000-4000-8000-000000000040',
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000010',
  'f0000000-0000-4000-8000-000000000020',
  'f0000000-0000-4000-8000-000000000030',
  'SITE_ADMIN',
  'SITE',
  'ACTIVE',
  statement_timestamp()
);

insert into public.sticker_design_versions (
  id,
  tenant_id,
  management_company_id,
  site_id,
  template_code,
  design_config,
  status,
  created_by,
  approved_by,
  approved_at
)
values (
  'f0000000-0000-4000-8000-000000000050',
  'f0000000-0000-4000-8000-000000000010',
  'f0000000-0000-4000-8000-000000000020',
  'f0000000-0000-4000-8000-000000000030',
  'ROUND_WHITE_MINIMAL_V1',
  '{
    "schemaVersion": "1",
    "zones": {
      "customerLogo": "OPTIONAL_TOP",
      "qr": "CENTER_WHITE_PLATE",
      "taptolkLogo": "IMMUTABLE_BOTTOM"
    },
    "qrOptions": {
      "errorCorrectionLevel": "H",
      "marginModules": 4
    }
  }'::jsonb,
  'APPROVED',
  'f0000000-0000-4000-8000-000000000002',
  'f0000000-0000-4000-8000-000000000001',
  statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select throws_ok(
  $$
    select public.request_qr_batch(
      'f0000000-0000-4000-8000-000000000030',
      1,
      'f0000000-0000-4000-8000-000000000050',
      1,
      101,
      'Task 0 upper boundary rejection',
      'Task 0 quantity contract verification',
      'f0000000-0000-4000-8000-000000000061',
      'f0000000-0000-4000-8000-000000000062'
    )
  $$,
  '22023',
  'INVALID_QUANTITY',
  'request_qr_batch rejects 101 items with INVALID_QUANTITY'
);

select lives_ok(
  $$
    select public.request_qr_batch(
      'f0000000-0000-4000-8000-000000000030',
      1,
      'f0000000-0000-4000-8000-000000000050',
      1,
      100,
      'Task 0 upper boundary acceptance',
      'Task 0 quantity contract verification',
      'f0000000-0000-4000-8000-000000000063',
      'f0000000-0000-4000-8000-000000000064'
    )
  $$,
  'request_qr_batch accepts the 100-item upper boundary'
);

select throws_ok(
  $$
    insert into public.qr_batches (
      id,
      tenant_id,
      management_company_id,
      site_id,
      batch_code,
      sticker_design_version_id,
      requested_quantity,
      purpose,
      requested_by,
      idempotency_key
    )
    values (
      'f0000000-0000-4000-8000-000000000070',
      'f0000000-0000-4000-8000-000000000010',
      'f0000000-0000-4000-8000-000000000020',
      'f0000000-0000-4000-8000-000000000030',
      'TASK0_DIRECT_101',
      'f0000000-0000-4000-8000-000000000050',
      101,
      'Task 0 direct insert rejection',
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000071'
    )
  $$,
  '23514',
  null,
  'qr_batches CHECK rejects a direct 101-item insert'
);

select * from finish();

rollback;
