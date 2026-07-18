begin;

-- Site mutations must pass through the server-side application service so that
-- granular request/approval permissions, field transition rules, optimistic
-- version checks, and the audit event share one transaction.
revoke insert, update on public.sites from authenticated;

drop policy if exists sites_insert_scoped on public.sites;
drop policy if exists sites_update_scoped on public.sites;

comment on table public.sites is
  'Tenant-scoped Site registry. Browser sessions are read-only; mutations use the audited application service.';

commit;
