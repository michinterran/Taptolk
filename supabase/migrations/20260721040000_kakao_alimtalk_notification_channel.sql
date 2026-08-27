begin;

alter type public.notification_channel add value if not exists 'KAKAO_ALIMTALK';

commit;
