begin;

drop policy if exists site_lifecycle_requests_select_scoped
on public.site_lifecycle_requests;

create policy site_lifecycle_requests_select_scoped
on public.site_lifecycle_requests
for select
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN'
    ]
  )
);

comment on policy site_lifecycle_requests_select_scoped
on public.site_lifecycle_requests is
  'Only lifecycle requesters and platform reviewers may read scoped request reasons.';

commit;
