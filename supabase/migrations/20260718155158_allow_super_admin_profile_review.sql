begin;

create policy admin_profiles_select_platform_super_admin
on public.admin_profiles
for select
to authenticated
using (
  coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  and app_private.current_admin_has_scope(
    null,
    null,
    null,
    array['SUPER_ADMIN']
  )
);

comment on policy admin_profiles_select_platform_super_admin
on public.admin_profiles is
  'Allows an AAL2 platform Super Admin to review profile status while the Auth directory remains server-only.';

commit;
