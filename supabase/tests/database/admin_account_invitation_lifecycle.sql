begin;

select plan(18);

select has_column(
  'public',
  'admin_memberships',
  'invitation_expires_at',
  'administrator invitations have an explicit expiry'
);

select has_function(
  'public',
  'create_admin_account_invitation',
  array['uuid', 'text', 'public.admin_role', 'public.admin_scope_type', 'uuid', 'uuid', 'uuid', 'text', 'uuid'],
  'Super Admin invitation command exists'
);

select has_function(
  'public',
  'accept_admin_account_invitation',
  array['uuid'],
  'invited administrator acceptance command exists'
);

select has_function(
  'public',
  'update_admin_membership_assignment',
  array['uuid', 'integer', 'public.admin_role', 'public.admin_scope_type', 'uuid', 'uuid', 'uuid', 'public.admin_membership_status', 'text', 'uuid'],
  'administrator assignment command exists'
);

select is_definer(
  'public',
  'create_admin_account_invitation',
  array['uuid', 'text', 'public.admin_role', 'public.admin_scope_type', 'uuid', 'uuid', 'uuid', 'text', 'uuid'],
  'invitation command stays behind a server authorization boundary'
);

select is_definer(
  'public',
  'accept_admin_account_invitation',
  array['uuid'],
  'acceptance command stays behind an authenticated boundary'
);

select function_privs_are(
  'public',
  'create_admin_account_invitation',
  array['uuid', 'text', 'public.admin_role', 'public.admin_scope_type', 'uuid', 'uuid', 'uuid', 'text', 'uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot create administrator invitations'
);

select function_privs_are(
  'public',
  'create_admin_account_invitation',
  array['uuid', 'text', 'public.admin_role', 'public.admin_scope_type', 'uuid', 'uuid', 'uuid', 'text', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated sessions reach the server-authorized invitation command'
);

select function_privs_are(
  'public',
  'accept_admin_account_invitation',
  array['uuid'],
  'anon',
  array[]::text[],
  'anonymous sessions cannot accept administrator invitations'
);

select function_privs_are(
  'public',
  'accept_admin_account_invitation',
  array['uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated invitees reach the acceptance command'
);

select ok(
  position('role = ''SUPER_ADMIN''' in pg_get_functiondef(
    'public.create_admin_account_invitation(uuid,text,public.admin_role,public.admin_scope_type,uuid,uuid,uuid,text,uuid)'::regprocedure
  )) > 0,
  'only platform Super Admin memberships can issue invitations'
);

select ok(
  position('invitation_expires_at' in pg_get_functiondef(
    'public.create_admin_account_invitation(uuid,text,public.admin_role,public.admin_scope_type,uuid,uuid,uuid,text,uuid)'::regprocedure
  )) > 0,
  'issued invitations receive an expiry boundary'
);

select ok(
  position('invitation_status <> ''INVITED''' in pg_get_functiondef(
    'public.accept_admin_account_invitation(uuid)'::regprocedure
  )) > 0,
  'acceptance only transitions invited memberships'
);

select ok(
  position('invitation_user_id <> actor_user_id' in pg_get_functiondef(
    'public.accept_admin_account_invitation(uuid)'::regprocedure
  )) > 0,
  'invite acceptance is bound to the authenticated invitee'
);

select ok(
  position('ADMIN_ACCOUNT_INVITED' in pg_get_functiondef(
    'public.create_admin_account_invitation(uuid,text,public.admin_role,public.admin_scope_type,uuid,uuid,uuid,text,uuid)'::regprocedure
  )) > 0,
  'invitation issuance is audited'
);

select ok(
  position('ADMIN_ACCOUNT_INVITATION_ACCEPTED' in pg_get_functiondef(
    'public.accept_admin_account_invitation(uuid)'::regprocedure
  )) > 0,
  'invitation acceptance is audited'
);

select ok(
  position('target.status = ''INVITED'' and p_status <> ''REVOKED''' in pg_get_functiondef(
    'public.update_admin_membership_assignment(uuid,integer,public.admin_role,public.admin_scope_type,uuid,uuid,uuid,public.admin_membership_status,text,uuid)'::regprocedure
  )) > 0,
  'invited memberships can only be cancelled through the assignment command'
);

select ok(
  position('p_status = ''INVITED''' in pg_get_functiondef(
    'public.update_admin_membership_assignment(uuid,integer,public.admin_role,public.admin_scope_type,uuid,uuid,uuid,public.admin_membership_status,text,uuid)'::regprocedure
  )) > 0,
  'assignment updates cannot recreate invitation state'
);

select * from finish();
rollback;
