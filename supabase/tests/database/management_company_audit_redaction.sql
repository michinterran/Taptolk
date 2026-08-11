begin;

select plan(8);

select is(
  app_private.audit_payload_is_safe(
    jsonb_build_object('representativePhonePresent', true)
  ),
  false,
  'audit payload safety rejects phone-related keys'
);

select is(
  app_private.audit_payload_is_safe(
    jsonb_build_object(
      'representativeContactConfigured', true,
      'primaryContactNamePresent', true,
      'primaryContactChannelConfigured', true,
      'primaryContactEmailPresent', true,
      'operationsManagerNamePresent', true,
      'operationsManagerContactConfigured', true,
      'operationsManagerEmailPresent', true
    )
  ),
  true,
  'redacted management-company audit metadata is policy-safe'
);

select is(
  position(
    '''representativePhonePresent''' in pg_get_functiondef(
      'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'management-company create omits unsafe phone-related audit keys'
);

select is(
  position(
    '''representativePhonePresent''' in pg_get_functiondef(
      'public.update_management_company(uuid,integer,text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'management-company update omits unsafe phone-related audit keys'
);

select ok(
  pg_get_functiondef(
    'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
  ) !~ '''(contactName|contactEmail|operationsManagerName|operationsManagerEmail)''',
  'management-company create omits raw contact identity fields from audit data'
);

select ok(
  pg_get_functiondef(
    'public.update_management_company(uuid,integer,text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
  ) !~ '''(contactName|contactEmail|operationsManagerName|operationsManagerEmail)''',
  'management-company update omits raw contact identity fields from audit data'
);

select ok(
  position(
    '''primaryContactEmailPresent''' in pg_get_functiondef(
      'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ) > 0
    and position(
      'contact_email is not null' in pg_get_functiondef(
        'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
      )
    ) > 0,
  'management-company create retains redacted contact-presence metadata'
);

select ok(
  position(
    '''primaryContactEmailPresent''' in pg_get_functiondef(
      'public.update_management_company(uuid,integer,text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ) > 0
    and position(
      'contact_email is not null' in pg_get_functiondef(
        'public.update_management_company(uuid,integer,text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
      )
    ) > 0,
  'management-company update retains redacted contact-presence metadata'
);

select * from finish();

rollback;
