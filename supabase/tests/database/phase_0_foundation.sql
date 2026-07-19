begin;

select plan(3);

select has_schema(
  'app_private',
  'app_private schema should exist'
);

select schema_privs_are(
  'app_private',
  'anon',
  array[]::text[],
  'anon should have no app_private privileges'
);

select schema_privs_are(
  'app_private',
  'authenticated',
  array[]::text[],
  'authenticated should have no app_private privileges'
);

select * from finish();

rollback;
