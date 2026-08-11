begin;

select plan(4);

select has_function(
  'public',
  'read_admin_account_directory',
  array[]::text[],
  'account directory read model remains available after fixture boundary update'
);

select ok(
  position('coalesce(tenant.is_test_fixture, false) = false' in pg_get_functiondef(
    'public.read_admin_account_directory()'::regprocedure
  )) > 0,
  'account directory excludes fixture tenants'
);

select ok(
  position('coalesce(company.is_test_fixture, false) = false' in pg_get_functiondef(
    'public.read_admin_account_directory()'::regprocedure
  )) > 0,
  'account directory excludes fixture management companies'
);

select ok(
  position('coalesce(site.is_test_fixture, false) = false' in pg_get_functiondef(
    'public.read_admin_account_directory()'::regprocedure
  )) > 0,
  'account directory excludes fixture sites'
);

select * from finish();

rollback;
