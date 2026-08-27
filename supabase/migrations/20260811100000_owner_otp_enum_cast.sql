-- Keep OTP mismatch handling type-safe for the enum-backed challenge status.
-- This is a new migration; the original owner activation migrations remain immutable.

begin;

do $migration$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.verify_owner_activation_otp(jsonb)'::regprocedure
  );
  if position(
    'status = case when next_attempt >= 5 then ''LOCKED'' else ''PENDING'' end'
    in definition
  ) = 0 then
    raise exception using errcode = 'P0001', message = 'OWNER_OTP_VERIFY_PATCH_TARGET_MISSING';
  end if;
  execute replace(
    definition,
    'status = case when next_attempt >= 5 then ''LOCKED'' else ''PENDING'' end',
    'status = case when next_attempt >= 5 then ''LOCKED''::public.owner_otp_status else ''PENDING''::public.owner_otp_status end'
  );
end;
$migration$;

do $migration$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.verify_owner_session_reclaim_otp(jsonb)'::regprocedure
  );
  if position(
    'status = case when next_attempt >= 5 then ''LOCKED'' else ''PENDING'' end'
    in definition
  ) = 0 then
    raise exception using errcode = 'P0001', message = 'OWNER_OTP_RECLAIM_PATCH_TARGET_MISSING';
  end if;
  execute replace(
    definition,
    'status = case when next_attempt >= 5 then ''LOCKED'' else ''PENDING'' end',
    'status = case when next_attempt >= 5 then ''LOCKED''::public.owner_otp_status else ''PENDING''::public.owner_otp_status end'
  );
end;
$migration$;

comment on function public.verify_owner_activation_otp(jsonb) is
  'Verifies owner activation OTP with enum-safe mismatch state transitions.';
comment on function public.verify_owner_session_reclaim_otp(jsonb) is
  'Verifies owner reclaim OTP with enum-safe mismatch state transitions.';

commit;
