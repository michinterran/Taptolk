begin;

select plan(12);

select has_extension(
  'pgmq',
  'pgmq extension is installed'
);

select has_schema(
  'pgmq_public',
  'Queue API wrapper schema exists'
);

select has_table(
  'pgmq',
  'q_qr-generation',
  'durable QR generation Queue exists'
);

select has_table(
  'pgmq',
  'a_qr-generation',
  'durable QR generation archive exists'
);

select has_function(
  'pgmq_public',
  'send',
  array['text', 'jsonb', 'integer'],
  'server Queue publisher exists'
);

select has_function(
  'pgmq_public',
  'read',
  array['text', 'integer', 'integer'],
  'server Queue reader exists'
);

select has_function(
  'pgmq_public',
  'archive',
  array['text', 'bigint'],
  'server Queue archive operation exists'
);

select has_function(
  'pgmq_public',
  'delete',
  array['text', 'bigint'],
  'server Queue delete operation exists'
);

select ok(
  not has_schema_privilege('anon', 'pgmq_public', 'USAGE')
    and not has_schema_privilege('authenticated', 'pgmq_public', 'USAGE'),
  'browser roles cannot use the Queue wrapper schema'
);

select ok(
  not has_function_privilege(
    'anon',
    'pgmq_public.send(text,jsonb,integer)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated',
      'pgmq_public.send(text,jsonb,integer)',
      'EXECUTE'
    ),
  'browser roles cannot publish Queue messages'
);

select ok(
  has_schema_privilege('service_role', 'pgmq_public', 'USAGE')
    and has_function_privilege(
      'service_role',
      'pgmq_public.send(text,jsonb,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'pgmq_public.read(text,integer,integer)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'pgmq_public.archive(text,bigint)',
      'EXECUTE'
    ),
  'service role can publish, lease, and archive Queue messages'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'pgmq."q_qr-generation"'::regclass
  ),
  'active Queue table has RLS enabled'
);

select * from finish();

rollback;
