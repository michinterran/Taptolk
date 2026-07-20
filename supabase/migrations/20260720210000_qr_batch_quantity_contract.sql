begin;

lock table public.qr_batches in access exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.qr_batches
    where requested_quantity > 100
  ) then
    raise exception using
      errcode = '23514',
      message = 'QR_BATCH_QUANTITY_CONTRACT_VIOLATION: requested_quantity exceeds 100';
  end if;
end;
$$;

alter table public.qr_batches
  drop constraint if exists chk_qr_batches_requested_quantity;

alter table public.qr_batches
  add constraint chk_qr_batches_requested_quantity
  check (requested_quantity between 1 and 100);

commit;
