begin;

alter table public.notification_deliveries
  drop constraint chk_notification_deliveries_hashes,
  add constraint chk_notification_deliveries_destination_hash
    check (destination_hash ~ '^[0-9a-f]{64}$'),
  add constraint chk_notification_deliveries_idempotency_key
    check (idempotency_key ~ '^[0-9a-f]{64}$');

commit;
