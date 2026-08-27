begin;

select plan(9);

select isnt(
  position(
    'normalized_address is null' in pg_get_functiondef(
      'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'management company registration requires an address'
);

select isnt(
  position(
    'normalized_business_number is null' in pg_get_functiondef(
      'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'management company registration requires a business number'
);

select isnt(
  position(
    'normalized_contact_name is null' in pg_get_functiondef(
      'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'management company registration requires a primary contact name'
);

select isnt(
  position(
    'INVALID_CONTACT_CHANNEL' in pg_get_functiondef(
      'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'management company registration requires a primary contact channel'
);

select isnt(
  position(
    'INVALID_OPERATIONS_MANAGER_CHANNEL' in pg_get_functiondef(
      'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'an entered operations manager requires a contact channel'
);

select is(
  position(
    'INVALID_CONTACT_CHANNEL' in pg_get_functiondef(
      'public.update_management_company(uuid,integer,text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'existing incomplete management company records remain correctable'
);

select isnt(
  position(
    'address' in pg_get_constraintdef(
      (
        select constraint_row.oid
        from pg_constraint as constraint_row
        where constraint_row.conrelid = 'public.management_companies'::regclass
          and constraint_row.conname = 'chk_management_companies_required_identity_v2'
      )
    )
  ),
  0,
  'the database enforces the required external company identity on new writes'
);

select isnt(
  position(
    'contact_phone_encrypted' in pg_get_constraintdef(
      (
        select constraint_row.oid
        from pg_constraint as constraint_row
        where constraint_row.conrelid = 'public.management_companies'::regclass
          and constraint_row.conname = 'chk_management_companies_primary_contact_v2'
      )
    )
  ),
  0,
  'the database enforces a primary contact name and contact method on new writes'
);

select isnt(
  position(
    'operations_manager_name' in pg_get_constraintdef(
      (
        select constraint_row.oid
        from pg_constraint as constraint_row
        where constraint_row.conrelid = 'public.management_companies'::regclass
          and constraint_row.conname = 'chk_management_companies_operations_manager_completeness_v2'
      )
    )
  ),
  0,
  'the database keeps operations manager details optional but complete when present'
);

select * from finish();

rollback;
