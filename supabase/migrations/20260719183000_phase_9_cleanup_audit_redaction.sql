begin;

do $migration$
declare
  definition text;
  unsafe_audit text := $unsafe$jsonb_build_object(
      'status', 'SUCCESS',
      'expired_session_count', expired_sessions,
      'revoked_token_count', revoked_tokens,
      'revoked_block_count', revoked_blocks,
      'redacted_message_count', redacted_messages
    )$unsafe$;
  safe_audit text := $safe$jsonb_build_object(
      'status', 'SUCCESS',
      'expired_count', expired_sessions,
      'revoked_recovery_count', revoked_tokens,
      'revoked_block_count', revoked_blocks,
      'redacted_content_count', redacted_messages
    )$safe$;
begin
  definition := pg_get_functiondef(
    'public.run_privacy_cleanup(uuid,integer,integer,integer,uuid)'::regprocedure
  );
  if position(safe_audit in definition) > 0 then
    null;
  elsif position(unsafe_audit in definition) > 0 then
    execute replace(definition, unsafe_audit, safe_audit);
  else
    raise exception using errcode = 'P0001', message = 'CLEANUP_AUDIT_PATCH_TARGET_MISSING';
  end if;
end;
$migration$;

commit;
