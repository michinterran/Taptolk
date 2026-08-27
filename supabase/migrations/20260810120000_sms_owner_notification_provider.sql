-- SMS is the current owner-notification provider while Kakao approval is pending.
-- Keep the KAKAO_ALIMTALK enum for the later provider switch; do not rewrite history.

begin;

drop trigger if exists trg_owner_contact_notification_channel on public.notification_deliveries;

do $migration$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.claim_notification_deliveries(text,integer,integer)'::regprocedure
  );
  if position('delivery.channel = ''KAKAO_ALIMTALK''::public.notification_channel' in definition) > 0 then
    execute replace(
      definition,
      'delivery.channel = ''KAKAO_ALIMTALK''::public.notification_channel',
      'delivery.channel = ''SMS''::public.notification_channel'
    );
  elsif position('delivery.channel = ''KAKAO_ALIMTALK''' in definition) > 0 then
    execute replace(
      definition,
      'delivery.channel = ''KAKAO_ALIMTALK''',
      'delivery.channel = ''SMS'''
    );
  elsif position('delivery.channel = ''SMS''' in definition) = 0 then
    raise exception using errcode = 'P0001', message = 'SMS_NOTIFICATION_CHANNEL_PATCH_TARGET_MISSING';
  end if;
end;
$migration$;

comment on type public.notification_channel is
  'SMS is the current owner-contact channel; KAKAO_ALIMTALK remains available for the approved provider migration.';

commit;
