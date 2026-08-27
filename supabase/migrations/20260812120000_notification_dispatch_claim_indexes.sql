begin;

-- The dispatch claim RPCs filter by channel, purpose, status, and due time.
-- Keep the existing index for compatibility and add channel-aware partial
-- indexes so empty-queue claims do not repeatedly scan unrelated deliveries.
create index if not exists idx_notification_deliveries_claim_channel_due
on public.notification_deliveries (channel, purpose, scheduled_at, created_at)
where status in ('QUEUED', 'FAILED_RETRYABLE');

create index if not exists idx_notification_deliveries_claim_channel_lease
on public.notification_deliveries (channel, purpose, lease_expires_at)
where status = 'PROCESSING';

commit;
