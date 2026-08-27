begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if not exists (
    select 1
    from pg_extension
    where extname = 'pgmq'
  ) then
    create extension pgmq;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pgmq.meta
    where queue_name = 'qr-generation'
  ) then
    perform pgmq.create('qr-generation');
  end if;
end
$$;

do $$
begin
  if not (
    select relrowsecurity
    from pg_class
    where oid = 'pgmq."q_qr-generation"'::regclass
  ) then
    alter table pgmq."q_qr-generation" enable row level security;
  end if;
end
$$;

create schema if not exists pgmq_public;

create or replace function pgmq_public.send(
  queue_name text,
  message jsonb,
  sleep_seconds integer default 0
)
returns setof bigint
language sql
set search_path = ''
as $$
  select *
  from pgmq.send(
    queue_name := queue_name,
    msg := message,
    delay := sleep_seconds
  );
$$;

create or replace function pgmq_public.read(
  queue_name text,
  sleep_seconds integer,
  n integer
)
returns setof pgmq.message_record
language sql
set search_path = ''
as $$
  select *
  from pgmq.read(
    queue_name := queue_name,
    vt := sleep_seconds,
    qty := n,
    conditional := '{}'::jsonb
  );
$$;

create or replace function pgmq_public.archive(
  queue_name text,
  message_id bigint
)
returns boolean
language sql
set search_path = ''
as $$
  select pgmq.archive(
    queue_name := queue_name,
    msg_id := message_id
  );
$$;

create or replace function pgmq_public.delete(
  queue_name text,
  message_id bigint
)
returns boolean
language sql
set search_path = ''
as $$
  select pgmq.delete(
    queue_name := queue_name,
    msg_id := message_id
  );
$$;

revoke all on schema pgmq from public, anon, authenticated;
revoke all on all tables in schema pgmq from public, anon, authenticated;
revoke all on all sequences in schema pgmq from public, anon, authenticated;
revoke all on all functions in schema pgmq from public, anon, authenticated;

grant usage on schema pgmq to postgres, service_role;
grant all on all tables in schema pgmq to postgres, service_role;
grant all on all sequences in schema pgmq to postgres, service_role;
grant execute on all functions in schema pgmq to postgres, service_role;

alter default privileges in schema pgmq
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema pgmq
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema pgmq
  revoke all on functions from public, anon, authenticated;
alter default privileges in schema pgmq
  grant all on tables to postgres, service_role;
alter default privileges in schema pgmq
  grant all on sequences to postgres, service_role;
alter default privileges in schema pgmq
  grant execute on functions to postgres, service_role;

revoke all on schema pgmq_public from public, anon, authenticated;
grant usage on schema pgmq_public to postgres, service_role;

revoke all on function pgmq_public.send(text, jsonb, integer)
  from public, anon, authenticated;
revoke all on function pgmq_public.read(text, integer, integer)
  from public, anon, authenticated;
revoke all on function pgmq_public.archive(text, bigint)
  from public, anon, authenticated;
revoke all on function pgmq_public.delete(text, bigint)
  from public, anon, authenticated;

grant execute on function pgmq_public.send(text, jsonb, integer)
  to postgres, service_role;
grant execute on function pgmq_public.read(text, integer, integer)
  to postgres, service_role;
grant execute on function pgmq_public.archive(text, bigint)
  to postgres, service_role;
grant execute on function pgmq_public.delete(text, bigint)
  to postgres, service_role;

commit;
