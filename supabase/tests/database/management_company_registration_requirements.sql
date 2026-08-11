begin;

select plan(6);

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

select * from finish();

rollback;
