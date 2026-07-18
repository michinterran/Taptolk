begin;

create schema if not exists app_private;

comment on schema app_private is
  'Server-only database objects. Browser roles must never receive schema usage.';

revoke all on schema app_private from public;
revoke all on schema app_private from anon;
revoke all on schema app_private from authenticated;

commit;
