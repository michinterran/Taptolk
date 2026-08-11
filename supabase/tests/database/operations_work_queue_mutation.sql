begin;

select plan(11);

insert into auth.users (id)
values
  ('f1000000-0000-4000-8000-000000000001'),
  ('f1000000-0000-4000-8000-000000000002');

insert into public.tenants (id, name, slug)
values (
  'f1000000-0000-4000-8000-000000000010',
  'Operations command test tenant',
  'operations-command-test-tenant'
);

insert into public.management_companies (id, tenant_id, name)
values (
  'f1000000-0000-4000-8000-000000000020',
  'f1000000-0000-4000-8000-000000000010',
  'Operations command test company'
);

insert into public.sites (id, tenant_id, management_company_id, name)
values (
  'f1000000-0000-4000-8000-000000000030',
  'f1000000-0000-4000-8000-000000000010',
  'f1000000-0000-4000-8000-000000000020',
  'Operations command test site'
);

insert into public.admin_profiles (user_id, display_name, status)
values
  ('f1000000-0000-4000-8000-000000000001', 'Operations Tester', 'ACTIVE'),
  ('f1000000-0000-4000-8000-000000000002', 'Read Only Tester', 'ACTIVE');

insert into public.admin_memberships (
  id, user_id, tenant_id, management_company_id, site_id,
  role, scope_type, status, accepted_at
)
values
  (
    'f1000000-0000-4000-8000-000000000040',
    'f1000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000010',
    'f1000000-0000-4000-8000-000000000020',
    'f1000000-0000-4000-8000-000000000030',
    'SITE_ADMIN', 'SITE', 'ACTIVE', statement_timestamp()
  ),
  (
    'f1000000-0000-4000-8000-000000000041',
    'f1000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000010',
    'f1000000-0000-4000-8000-000000000020',
    'f1000000-0000-4000-8000-000000000030',
    'READ_ONLY', 'SITE', 'ACTIVE', statement_timestamp()
  );

insert into public.notification_deliveries (
  id, tenant_id, site_id, channel, purpose, destination_hash,
  provider, idempotency_key, status, failed_at
)
values (
  'f1000000-0000-4000-8000-000000000050',
  'f1000000-0000-4000-8000-000000000010',
  'f1000000-0000-4000-8000-000000000030',
  'SMS', 'ADMIN_ALERT',
  repeat('a', 64), 'STAGING', repeat('b', 64), 'FAILED_RETRYABLE', statement_timestamp()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (
    public.read_operations_work_queue_with_state(
      'f1000000-0000-4000-8000-000000000020',
      'f1000000-0000-4000-8000-000000000030',
      10,
      null
    ) -> 'items' -> 0 ->> 'queue_state'
  ),
  'WAITING',
  'source-backed item starts in the waiting operator state'
);

select is(
  (
    public.read_operations_work_queue_with_state(
      'f1000000-0000-4000-8000-000000000020',
      'f1000000-0000-4000-8000-000000000030',
      10,
      null
    ) -> 'items' -> 0 ->> 'version'
  ),
  '1',
  'source-backed item starts at overlay version one'
);

select lives_ok(
  $$
    select public.mutate_operations_work_queue(
      md5('NOTIFICATION_FAILURE:NOTIFICATION_DELIVERIES:f1000000-0000-4000-8000-000000000050')::uuid,
      'NOTIFICATION_FAILURE', 'ASSIGN', 1, null,
      '담당 운영자에게 배정', 'f1000000-0000-4000-8000-000000000060'
    )
  $$,
  'scoped operator can assign a queue item to self'
);

select is(
  (
    public.read_operations_work_queue_with_state(null, null, 10, null)
      -> 'items' -> 0 ->> 'queue_state'
  ),
  'ASSIGNED',
  'assignment persists in the operator overlay'
);

select is(
  (
    public.read_operations_work_queue_with_state(null, null, 10, null)
      -> 'items' -> 0 ->> 'assignee_display_name'
  ),
  'Operations Tester',
  'assignment resolves to a display name without exposing membership id'
);

select is(
  (
    public.read_operations_work_queue_with_state(null, null, 10, null)
      -> 'items' -> 0 ->> 'version'
  ),
  '2',
  'assignment increments the optimistic version'
);

select lives_ok(
  $$
    select public.mutate_operations_work_queue(
      md5('NOTIFICATION_FAILURE:NOTIFICATION_DELIVERIES:f1000000-0000-4000-8000-000000000050')::uuid,
      'NOTIFICATION_FAILURE', 'START', 2, null,
      '처리를 시작했습니다', 'f1000000-0000-4000-8000-000000000061'
    )
  $$,
  'scoped operator can start an assigned queue item'
);

select throws_ok(
  $$
    select public.mutate_operations_work_queue(
      md5('NOTIFICATION_FAILURE:NOTIFICATION_DELIVERIES:f1000000-0000-4000-8000-000000000050')::uuid,
      'NOTIFICATION_FAILURE', 'RESOLVE', 2, null,
      '오래된 버전으로 해결 시도', 'f1000000-0000-4000-8000-000000000062'
    )
  $$,
  '40001',
  'OPERATIONS_WORK_QUEUE_VERSION_CONFLICT',
  'stale queue mutation is rejected'
);

select is(
  (
    select count(*)::text
    from public.audit_logs
    where action = 'OPERATIONS_WORK_ITEM_UPDATED'
      and resource_type = 'OPERATIONS_WORK_ITEM'
  ),
  '2',
  'each accepted queue mutation writes a redacted audit row'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);

select throws_ok(
  $$
    select public.mutate_operations_work_queue(
      md5('NOTIFICATION_FAILURE:NOTIFICATION_DELIVERIES:f1000000-0000-4000-8000-000000000050')::uuid,
      'NOTIFICATION_FAILURE', 'RESOLVE', 3, null,
      '읽기 전용 계정 변경 시도', 'f1000000-0000-4000-8000-000000000063'
    )
  $$,
  '42501',
  'OPERATIONS_WORK_QUEUE_ITEM_NOT_ALLOWED',
  'read-only membership cannot mutate a queue item'
);

select ok(
  not exists (
    select 1
    from public.operations_work_queue_overrides
    where item_id = md5('NOTIFICATION_FAILURE:NOTIFICATION_DELIVERIES:f1000000-0000-4000-8000-000000000050')::uuid
      and priority is not null
  ),
  'priority remains unset until an approved policy writes it'
);

select * from finish();

rollback;
