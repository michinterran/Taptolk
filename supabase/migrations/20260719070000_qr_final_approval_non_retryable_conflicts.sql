begin;

do $$
declare
  target_function regprocedure;
  function_definition text;
begin
  foreach target_function in array array[
    'public.approve_qr_batch_final_generation(uuid,integer,text,uuid)'::regprocedure,
    'public.cancel_qr_batch_before_generation_approval(uuid,integer,text,uuid)'::regprocedure
  ]
  loop
    select pg_get_functiondef(target_function::oid)
    into function_definition;

    execute replace(function_definition, '''40001''', '''P0001''');
  end loop;
end;
$$;

comment on function public.approve_qr_batch_final_generation(uuid, integer, text, uuid)
is 'Approves final QR generation with bounded locking and non-retryable business conflicts.';

comment on function public.cancel_qr_batch_before_generation_approval(uuid, integer, text, uuid)
is 'Cancels before QR generation approval with bounded locking and non-retryable business conflicts.';

commit;
