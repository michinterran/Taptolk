begin;

create or replace function public.prepare_phase_9_cleanup_staging_fixture(
  p_tenant_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_id uuid;
  token_id uuid;
  block_id uuid;
begin
  if auth.role() <> 'service_role'
    or not exists (
      select 1 from public.contact_sessions
      where tenant_id = p_tenant_id and id = p_session_id
    )
  then
    raise exception using errcode = '42501', message = 'PHASE_9_FIXTURE_NOT_ALLOWED';
  end if;

  update public.contact_sessions
  set created_at = statement_timestamp() - interval '100 hours',
      expires_at = statement_timestamp() - interval '1 hour',
      updated_at = statement_timestamp()
  where tenant_id = p_tenant_id and id = p_session_id;

  select token.id into token_id
  from public.response_tokens as token
  join public.contact_sessions as session on session.id = token.session_id
  where session.tenant_id = p_tenant_id and token.used_at is null
  order by token.created_at desc
  limit 1;
  if token_id is not null then
    update public.response_tokens
    set created_at = statement_timestamp() - interval '2 hours',
        expires_at = statement_timestamp() - interval '1 hour',
        revoked_at = null
    where id = token_id;
  end if;

  select id into block_id from public.caller_blocks
  where tenant_id = p_tenant_id
  order by created_at desc
  limit 1;
  if block_id is not null then
    update public.caller_blocks
    set created_at = statement_timestamp() - interval '2 hours',
        expires_at = statement_timestamp() - interval '1 hour',
        revoked_at = null
    where id = block_id;
  end if;

  select id into message_id from public.messages
  where tenant_id = p_tenant_id and body <> '[REDACTED]'
  order by created_at
  limit 1;
  if message_id is not null then
    execute 'alter table public.messages disable trigger trg_messages_immutable';
    update public.messages
    set created_at = statement_timestamp() - interval '73 hours'
    where id = message_id;
    execute 'alter table public.messages enable trigger trg_messages_immutable';
  end if;

  return jsonb_build_object(
    'session_id', p_session_id,
    'message_id', message_id,
    'token_id', token_id,
    'block_id', block_id
  );
exception
  when others then
    execute 'alter table public.messages enable trigger trg_messages_immutable';
    raise;
end;
$$;

revoke all on function public.prepare_phase_9_cleanup_staging_fixture(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.prepare_phase_9_cleanup_staging_fixture(uuid, uuid)
to service_role;

comment on function public.prepare_phase_9_cleanup_staging_fixture(uuid, uuid) is
  'Service-only bounded staging helper for Phase 9 retention time travel; returns identifiers only.';

commit;
