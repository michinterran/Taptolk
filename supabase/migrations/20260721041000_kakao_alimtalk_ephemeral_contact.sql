begin;

create or replace function app_private.normalize_owner_contact_notification_channel()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.purpose = 'OWNER_CONTACT' and new.channel = 'SMS' then
    new.channel := 'KAKAO_ALIMTALK';
  end if;
  return new;
end;
$$;

create trigger trg_owner_contact_notification_channel
before insert on public.notification_deliveries
for each row execute function app_private.normalize_owner_contact_notification_channel();

do $migration$
declare
  definition text;
  legacy_filter text := 'delivery.channel = ''SMS''::public.notification_channel';
  source_filter text := 'delivery.channel = ''SMS''';
  alimtalk_filter text := 'delivery.channel = ''KAKAO_ALIMTALK''::public.notification_channel';
begin
  definition := pg_get_functiondef(
    'public.claim_notification_deliveries(text,integer,integer)'::regprocedure
  );
  if position(alimtalk_filter in definition) > 0 then
    null;
  elsif position(legacy_filter in definition) > 0 then
    execute replace(definition, legacy_filter, alimtalk_filter);
  elsif position(source_filter in definition) > 0 then
    execute replace(definition, source_filter, 'delivery.channel = ''KAKAO_ALIMTALK''');
  else
    raise exception using errcode = 'P0001', message = 'NOTIFICATION_CHANNEL_PATCH_TARGET_MISSING';
  end if;
end;
$migration$;

create or replace function app_private.guard_public_contact_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_table_name = 'messages'
    and tg_op = 'UPDATE'
    and auth.role() = 'service_role'
    and old.body <> '[REDACTED]'
    and new.body = '[REDACTED]'
    and (
      (to_jsonb(new) - 'body') = (to_jsonb(old) - 'body')
      or (
        new.body_hash = repeat('0', 64)
        and (to_jsonb(new) - 'body' - 'body_hash')
          = (to_jsonb(old) - 'body' - 'body_hash')
      )
    )
  then
    return new;
  end if;
  raise exception using errcode = '23514', message = 'PUBLIC_CONTACT_HISTORY_IMMUTABLE';
end;
$$;

create or replace function app_private.cleanup_terminal_contact_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('RESOLVED', 'EXPIRED', 'BLOCKED', 'CANCELLED')
    or new.status not in ('RESOLVED', 'EXPIRED', 'BLOCKED', 'CANCELLED')
  then
    return new;
  end if;

  update public.messages
  set body = '[REDACTED]',
      body_hash = repeat('0', 64)
  where tenant_id = new.tenant_id
    and session_id = new.id
    and body <> '[REDACTED]';

  update public.response_tokens
  set revoked_at = statement_timestamp()
  where tenant_id = new.tenant_id
    and session_id = new.id
    and revoked_at is null;

  update public.notification_deliveries
  set status = 'CANCELLED',
      lease_owner = null,
      lease_expires_at = null,
      updated_at = statement_timestamp()
  where tenant_id = new.tenant_id
    and session_id = new.id
    and status in ('QUEUED', 'PROCESSING', 'FAILED_RETRYABLE');

  update public.session_participants
  set left_at = statement_timestamp()
  where tenant_id = new.tenant_id
    and session_id = new.id
    and left_at is null;

  return new;
end;
$$;

create trigger trg_contact_session_terminal_cleanup
after update of status on public.contact_sessions
for each row execute function app_private.cleanup_terminal_contact_session();

create or replace function public.resolve_public_contact_session(
  p_session_token_hash text,
  p_anonymous_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.contact_sessions%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_session_token_hash !~ '^[0-9a-f]{64}$'
    or p_anonymous_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_SESSION_HASH';
  end if;

  select session.* into target
  from public.contact_sessions as session
  where session.session_token_hash = p_session_token_hash
    and session.caller_anonymous_hash = p_anonymous_token_hash
    and exists (
      select 1
      from public.session_participants as participant
      where participant.tenant_id = session.tenant_id
        and participant.session_id = session.id
        and participant.participant_type = 'CALLER'
        and participant.anonymous_token_hash = p_anonymous_token_hash
    )
  for update;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'CONTACT_SESSION_UNAVAILABLE';
  end if;
  if target.status = 'RESOLVED' then
    return jsonb_build_object('status', 'RESOLVED', 'replayed', true);
  end if;
  if target.status <> 'OWNER_REPLIED' then
    raise exception using errcode = 'P0001', message = 'CONTACT_SESSION_CONFLICT';
  end if;

  update public.contact_sessions
  set status = 'RESOLVED',
      resolved_at = statement_timestamp(),
      updated_at = statement_timestamp(),
      version = version + 1
  where tenant_id = target.tenant_id and id = target.id;

  insert into public.audit_logs (
    tenant_id, site_id, actor_type, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    target.tenant_id, target.site_id, 'CALLER', 'PUBLIC_CONTACT_RESOLVED',
    'CONTACT_SESSION', target.id,
    jsonb_build_object('status', 'RESOLVED'),
    'PUBLIC_CONTACT_RESOLVED', gen_random_uuid()
  );

  return jsonb_build_object('status', 'RESOLVED', 'replayed', false);
end;
$$;

revoke all on function app_private.normalize_owner_contact_notification_channel()
from public, anon, authenticated;
revoke all on function app_private.cleanup_terminal_contact_session()
from public, anon, authenticated;
revoke all on function public.resolve_public_contact_session(text, text)
from public, anon, authenticated;
grant execute on function public.resolve_public_contact_session(text, text) to service_role;

comment on function public.resolve_public_contact_session(text, text) is
  'Atomically resolves a caller-owned temporary Contact Session and revokes transient access.';
comment on function app_private.cleanup_terminal_contact_session() is
  'Redacts transient Contact Session content and revokes access on terminal state entry.';

commit;
