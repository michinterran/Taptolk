begin;

alter table public.notification_deliveries
  drop constraint if exists chk_notification_deliveries_hashes;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notification_deliveries'::regclass
      and conname = 'chk_notification_deliveries_destination_hash'
  ) then
    alter table public.notification_deliveries
      add constraint chk_notification_deliveries_destination_hash
        check (destination_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notification_deliveries'::regclass
      and conname = 'chk_notification_deliveries_idempotency_key'
  ) then
    alter table public.notification_deliveries
      add constraint chk_notification_deliveries_idempotency_key
        check (idempotency_key ~ '^[0-9a-f]{64}$');
  end if;
end
$$;

commit;
