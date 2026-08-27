begin;

select plan(6);

select is(
  position(
    'MFA_REQUIRED' in pg_get_functiondef(
      'public.approve_admin_account(uuid,text,public.admin_role,public.admin_scope_type,uuid,uuid,uuid,text,uuid)'::regprocedure
    )
  ),
  0,
  'admin approval no longer requires MFA during the pilot'
);

select is(
  position(
    'MFA_REQUIRED' in pg_get_functiondef(
      'public.create_tenant(text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'platform tenant creation no longer requires MFA during the pilot'
);

select is(
  position(
    'MFA_REQUIRED' in pg_get_functiondef(
      'app_private.assert_qr_inventory_actor(uuid,uuid,uuid,text[])'::regprocedure
    )
  ),
  0,
  'QR inventory actor authorization no longer requires MFA during the pilot'
);

select is(
  position(
    'aal2' in coalesce(
      (
        select policy.qual
        from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'admin_profiles'
          and policy.policyname = 'admin_profiles_select_platform_super_admin'
      ),
      ''
    )
  ),
  0,
  'Super Admin profile review policy no longer requires AAL2 during the pilot'
);

select is(
  position(
    'MFA_REQUIRED' in pg_get_functiondef(
      'public.create_management_company(text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'management company registration no longer requires MFA during the pilot'
);

select is(
  position(
    'MFA_REQUIRED' in pg_get_functiondef(
      'public.update_management_company(uuid,integer,text,text,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure
    )
  ),
  0,
  'management company update no longer requires MFA during the pilot'
);

select * from finish();

rollback;
