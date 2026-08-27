begin;

select plan(20);

select has_type(
  'public',
  'site_lifecycle_action',
  'Site lifecycle action enum exists'
);

select enum_has_labels(
  'public',
  'site_lifecycle_action',
  array['SUSPEND', 'REACTIVATE', 'CLOSE'],
  'Site lifecycle actions are explicit'
);

select enum_has_labels(
  'public',
  'site_lifecycle_request_status',
  array['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  'request states include one pending and three terminal states'
);

select has_table(
  'public',
  'site_lifecycle_requests',
  'tenant-owned Site lifecycle request table exists'
);

select policies_are(
  'public',
  'site_lifecycle_requests',
  array['site_lifecycle_requests_select_scoped'],
  'request history exposes one scoped read policy'
);

select table_privs_are(
  'public',
  'site_lifecycle_requests',
  'authenticated',
  array['SELECT'],
  'browser sessions cannot directly mutate lifecycle requests'
);

select has_index(
  'public',
  'site_lifecycle_requests',
  'uq_site_lifecycle_requests_pending_site',
  'only one pending lifecycle request is allowed per Site'
);

select has_function(
  'public',
  'request_site_lifecycle',
  array['uuid', 'integer', 'site_lifecycle_action', 'text', 'uuid'],
  'request command exists'
);

select has_function(
  'public',
  'approve_site_lifecycle_request',
  array['uuid', 'integer', 'text', 'uuid'],
  'approval command exists'
);

select has_function(
  'public',
  'reject_site_lifecycle_request',
  array['uuid', 'integer', 'text', 'uuid'],
  'rejection command exists'
);

select has_function(
  'public',
  'cancel_site_lifecycle_request',
  array['uuid', 'integer', 'text', 'uuid'],
  'requester cancellation command exists'
);

select is_definer(
  'public',
  'request_site_lifecycle',
  array['uuid', 'integer', 'site_lifecycle_action', 'text', 'uuid'],
  'request and audit are atomic'
);

select is_definer(
  'public',
  'approve_site_lifecycle_request',
  array['uuid', 'integer', 'text', 'uuid'],
  'Site, request, and audit approval are atomic'
);

select is_definer(
  'public',
  'reject_site_lifecycle_request',
  array['uuid', 'integer', 'text', 'uuid'],
  'rejection and audit are atomic'
);

select is_definer(
  'public',
  'cancel_site_lifecycle_request',
  array['uuid', 'integer', 'text', 'uuid'],
  'cancellation and audit are atomic'
);

select function_privs_are(
  'public',
  'request_site_lifecycle',
  array['uuid', 'integer', 'site_lifecycle_action', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot request lifecycle changes'
);

select function_privs_are(
  'public',
  'approve_site_lifecycle_request',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot approve lifecycle requests'
);

select function_privs_are(
  'public',
  'reject_site_lifecycle_request',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot reject lifecycle requests'
);

select function_privs_are(
  'public',
  'cancel_site_lifecycle_request',
  array['uuid', 'integer', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot cancel lifecycle requests'
);

select col_is_fk(
  'public',
  'site_lifecycle_requests',
  'requested_by',
  'request maker is constrained to an Auth identity'
);

select * from finish();

rollback;
