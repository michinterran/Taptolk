begin;

select plan(9);

select has_table('public', 'revenue_pricing_policies', 'versioned revenue pricing table exists');
select col_is_pk('public', 'revenue_pricing_policies', 'id', 'pricing policies use immutable ids');
select col_has_check('public', 'revenue_pricing_policies', 'monthly_unit_price_krw', 'unit price is bounded');
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_catalog.pg_class
   where oid = 'public.revenue_pricing_policies'::regclass),
  'pricing policies have forced RLS'
);
select has_function('public', 'read_revenue_command_center', array[]::text[], 'revenue read model exists');
select has_function(
  'public',
  'set_management_company_monthly_unit_price',
  array['uuid', 'uuid', 'integer', 'date', 'text', 'uuid'],
  'audited pricing command exists'
);
select function_privs_are(
  'public',
  'read_revenue_command_center',
  array[]::text[],
  'anon',
  array[]::text[],
  'anon cannot read revenue'
);
select function_privs_are(
  'public',
  'set_management_company_monthly_unit_price',
  array['uuid', 'uuid', 'integer', 'date', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated role reaches the command which performs server authorization'
);
select ok(
  position(
    'company.is_test_fixture = false' in pg_get_functiondef(
      'public.read_revenue_command_center()'::regprocedure
    )
  ) > 0,
  'revenue read model excludes fixture companies before aggregation'
);

select * from finish();

rollback;
