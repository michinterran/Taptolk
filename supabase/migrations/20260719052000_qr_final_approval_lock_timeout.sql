begin;

alter function public.approve_qr_batch_final_generation(uuid, integer, text, uuid)
set lock_timeout = '3s';

alter function public.cancel_qr_batch_before_generation_approval(uuid, integer, text, uuid)
set lock_timeout = '3s';

comment on function public.approve_qr_batch_final_generation(uuid, integer, text, uuid)
is 'Approves final QR generation with a bounded Batch lock wait and atomic durable job intent.';

comment on function public.cancel_qr_batch_before_generation_approval(uuid, integer, text, uuid)
is 'Cancels before QR generation approval with a bounded Batch lock wait and preserved history.';

commit;
