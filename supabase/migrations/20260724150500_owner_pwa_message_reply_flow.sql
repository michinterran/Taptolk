begin;

create or replace function public.read_public_contact_session(
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
  owner_messages jsonb;
  caller_message text;
  plate_last4 text;
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
  join public.session_participants as participant
    on participant.tenant_id = session.tenant_id
    and participant.session_id = session.id
    and participant.participant_type = 'CALLER'
    and participant.left_at is null
  where session.session_token_hash = p_session_token_hash
    and session.caller_anonymous_hash = p_anonymous_token_hash
    and participant.anonymous_token_hash = p_anonymous_token_hash;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'CONTACT_SESSION_UNAVAILABLE';
  end if;

  select message.body into caller_message
  from public.messages as message
  where message.session_id = target.id
    and message.sender_type = 'CALLER'
    and message.moderation_status = 'ACCEPTED'
  order by message.created_at
  limit 1;

  select vehicle.plate_last4 into plate_last4
  from public.vehicles as vehicle
  where vehicle.tenant_id = target.tenant_id and vehicle.id = target.vehicle_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'reply_code', message.reply_code,
        'body', message.body,
        'created_at', message.created_at
      )
      order by message.created_at
    ),
    '[]'::jsonb
  )
  into owner_messages
  from public.messages as message
  where message.session_id = target.id
    and message.sender_type = 'OWNER'
    and message.moderation_status = 'ACCEPTED';

  return jsonb_build_object(
    'status', target.status,
    'reason_code', target.reason_code,
    'caller_message', caller_message,
    'caller_message_count', target.caller_message_count,
    'owner_messages', owner_messages,
    'vehicle_plate_last4', plate_last4,
    'expires_at', target.expires_at,
    'created_at', target.created_at,
    'version', target.version
  );
end;
$$;

create or replace function public.list_owner_contact_messages(
  p_session_hash text,
  p_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
begin
  select * into ctx from app_private.owner_session_context(p_session_hash, p_device_hash);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'session_id', session.id,
      'status', session.status,
      'reason_code', session.reason_code,
      'caller_message', caller_message.body,
      'created_at', session.created_at,
      'reply_available', session.status in ('NOTIFICATION_QUEUED', 'OWNER_NOTIFIED', 'OWNER_VIEWED'),
      'vehicle_plate_last4', vehicle.plate_last4
    ) order by session.created_at), '[]'::jsonb)
    from public.contact_sessions as session
    join public.session_participants as participant
      on participant.tenant_id = session.tenant_id
      and participant.session_id = session.id
      and participant.participant_type = 'OWNER'
      and participant.owner_id = ctx.owner_id
      and participant.left_at is null
    join public.vehicles as vehicle
      on vehicle.tenant_id = session.tenant_id
      and vehicle.id = session.vehicle_id
    join lateral (
      select message.body
      from public.messages as message
      where message.tenant_id = session.tenant_id
        and message.session_id = session.id
        and message.sender_type = 'CALLER'
        and message.moderation_status = 'ACCEPTED'
      order by message.created_at
      limit 1
    ) as caller_message on true
    where session.status in ('NOTIFICATION_QUEUED', 'OWNER_NOTIFIED', 'OWNER_VIEWED')
      and session.expires_at > clock_timestamp()
  );
end;
$$;

create or replace function public.read_owner_contact_message(
  p_session_hash text,
  p_device_hash text,
  p_contact_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
  result jsonb;
begin
  select * into ctx from app_private.owner_session_context(p_session_hash, p_device_hash);
  select jsonb_build_object(
    'session_id', session.id,
    'status', session.status,
    'reason_code', session.reason_code,
    'caller_message', caller_message.body,
    'created_at', session.created_at,
    'reply_available', session.status in ('NOTIFICATION_QUEUED', 'OWNER_NOTIFIED', 'OWNER_VIEWED'),
    'vehicle_plate_last4', vehicle.plate_last4
  )
  into result
  from public.contact_sessions as session
  join public.session_participants as participant
    on participant.tenant_id = session.tenant_id
    and participant.session_id = session.id
    and participant.participant_type = 'OWNER'
    and participant.owner_id = ctx.owner_id
    and participant.left_at is null
  join public.vehicles as vehicle
    on vehicle.tenant_id = session.tenant_id
    and vehicle.id = session.vehicle_id
  join lateral (
    select message.body
    from public.messages as message
    where message.tenant_id = session.tenant_id
      and message.session_id = session.id
      and message.sender_type = 'CALLER'
      and message.moderation_status = 'ACCEPTED'
    order by message.created_at
    limit 1
  ) as caller_message on true
  where session.id = p_contact_session_id
    and session.status in ('NOTIFICATION_QUEUED', 'OWNER_NOTIFIED', 'OWNER_VIEWED')
    and session.expires_at > clock_timestamp();

  if result is null then
    raise exception using errcode = 'P0002', message = 'OWNER_MESSAGE_UNAVAILABLE';
  end if;
  return result;
end;
$$;

create or replace function public.submit_owner_contact_message_reply(
  p_session_hash text,
  p_device_hash text,
  p_contact_session_id uuid,
  p_reply_code text,
  p_body text,
  p_body_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
  target public.contact_sessions%rowtype;
  stored_body text;
begin
  if p_body_hash !~ '^[0-9a-f]{64}$'
    or p_reply_code not in (
      'MOVING_NOW', 'MOVE_IN_3_MINUTES', 'MOVE_IN_5_MINUTES', 'MOVE_IN_10_MINUTES',
      'CANNOT_MOVE_NOW', 'CONTACT_SITE_OFFICE', 'CUSTOM'
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_OWNER_REPLY';
  end if;
  stored_body := case p_reply_code
    when 'MOVING_NOW' then '지금 이동하겠습니다.'
    when 'MOVE_IN_3_MINUTES' then '3분 이내 이동하겠습니다.'
    when 'MOVE_IN_5_MINUTES' then '5분 이내 이동하겠습니다.'
    when 'MOVE_IN_10_MINUTES' then '10분 이내 이동하겠습니다.'
    when 'CANNOT_MOVE_NOW' then '지금은 이동하기 어렵습니다.'
    when 'CONTACT_SITE_OFFICE' then '관리사무소에 문의해 주세요.'
    else trim(p_body)
  end;
  if length(stored_body) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_OWNER_REPLY';
  end if;

  select * into ctx from app_private.owner_session_context(p_session_hash, p_device_hash);
  select session.* into target
  from public.contact_sessions as session
  join public.session_participants as participant
    on participant.tenant_id = session.tenant_id
    and participant.session_id = session.id
    and participant.participant_type = 'OWNER'
    and participant.owner_id = ctx.owner_id
    and participant.left_at is null
  where session.id = p_contact_session_id
  for update;

  if target.id is null
    or target.status not in ('NOTIFICATION_QUEUED', 'OWNER_NOTIFIED', 'OWNER_VIEWED')
    or target.owner_message_count >= 3
    or target.expires_at <= statement_timestamp()
  then
    raise exception using errcode = 'P0002', message = 'OWNER_MESSAGE_UNAVAILABLE';
  end if;

  insert into public.messages (
    tenant_id, session_id, sender_type, sender_owner_id, message_type,
    body, body_hash, reply_code
  )
  values (
    target.tenant_id, target.id, 'OWNER', ctx.owner_id, 'TEMPLATE',
    stored_body, p_body_hash, p_reply_code
  );
  update public.contact_sessions
  set status = 'OWNER_REPLIED', owner_message_count = owner_message_count + 1,
      owner_replied_at = statement_timestamp(), updated_at = statement_timestamp(),
      version = version + 1
  where tenant_id = target.tenant_id and id = target.id;
  update public.response_tokens
  set revoked_at = statement_timestamp()
  where tenant_id = target.tenant_id
    and session_id = target.id
    and scope = 'CONTACT_REPLY'
    and revoked_at is null
    and used_at is null;
  insert into public.audit_logs (
    tenant_id, site_id, actor_type, actor_id, action, resource_type, resource_id,
    after_data, reason, request_id
  )
  values (
    target.tenant_id, target.site_id, 'OWNER', ctx.owner_id, 'OWNER_CONTACT_REPLIED',
    'CONTACT_SESSION', target.id,
    jsonb_build_object('status', 'OWNER_REPLIED', 'replyCode', p_reply_code),
    'OWNER_CONTACT_REPLIED', gen_random_uuid()
  );
  return jsonb_build_object('status', 'OWNER_REPLIED');
end;
$$;

revoke all on function public.read_public_contact_session(text, text)
from public, anon, authenticated;
revoke all on function public.list_owner_contact_messages(text, text)
from public, anon, authenticated;
revoke all on function public.read_owner_contact_message(text, text, uuid)
from public, anon, authenticated;
revoke all on function public.submit_owner_contact_message_reply(text, text, uuid, text, text, text)
from public, anon, authenticated;

grant execute on function public.read_public_contact_session(text, text) to service_role;
grant execute on function public.list_owner_contact_messages(text, text) to service_role;
grant execute on function public.read_owner_contact_message(text, text, uuid) to service_role;
grant execute on function public.submit_owner_contact_message_reply(text, text, uuid, text, text, text)
to service_role;

comment on function public.submit_owner_contact_message_reply(text, text, uuid, text, text, text) is
'Lets an authenticated Owner PWA session reply to a live contact session without exposing a response token to the browser.';

commit;
