begin;

select plan(3);

select has_schema(
  'app_private',
  'app_private schema should exist'
);

select schema_privs_are(
  'anon',
  'app_private',
  array[]::text[],
  'anon should have no app_private privileges'
);

select schema_privs_are(
  'authenticated',
  'app_private',
  array[]::text[],
  'authenticated should have no app_private privileges'
);

select * from finish();

rollback;
