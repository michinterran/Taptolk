begin;

create table public.qr_batch_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  management_company_id uuid not null,
  site_id uuid not null,
  batch_id uuid not null,
  received_quantity integer not null,
  reason text not null,
  request_id uuid not null,
  received_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint fk_qr_batch_receipts_batch
    foreign key (tenant_id, management_company_id, site_id, batch_id)
    references public.qr_batches (tenant_id, management_company_id, site_id, id)
    on delete restrict,
  constraint uq_qr_batch_receipts_request unique (tenant_id, request_id),
  constraint chk_qr_batch_receipts_quantity check (received_quantity > 0),
  constraint chk_qr_batch_receipts_reason check (length(trim(reason)) between 3 and 500)
);

create index idx_qr_batch_receipts_batch_created
on public.qr_batch_receipts (tenant_id, site_id, batch_id, created_at desc);

alter table public.qr_batch_receipts enable row level security;
grant select on table public.qr_batch_receipts to authenticated;
grant select, delete on table public.qr_batch_receipts to service_role;

create policy qr_batch_receipts_select_scoped
on public.qr_batch_receipts
for select
to authenticated
using (
  app_private.current_admin_has_scope(
    tenant_id,
    management_company_id,
    site_id,
    array[
      'SUPER_ADMIN',
      'PLATFORM_OPERATOR',
      'MANAGEMENT_ADMIN',
      'SITE_ADMIN',
      'SITE_OPERATOR',
      'READ_ONLY'
    ]
  )
);

create or replace function public.receive_qr_batch_quantity(
  p_batch_id uuid,
  p_expected_version integer,
  p_received_quantity integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target public.qr_batches%rowtype;
  already_received integer := 0;
  pending_count integer := 0;
  next_status public.qr_batch_status;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_batch_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ID';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'INVALID_VERSION';
  end if;
  if p_received_quantity is null or p_received_quantity < 1 or p_received_quantity > 100 then
    raise exception using errcode = '22023', message = 'INVALID_QUANTITY';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'INVALID_REASON';
  end if;

  select * into target
  from public.qr_batches
  where id = p_batch_id
  for update;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'BATCH_NOT_FOUND';
  end if;
  if not app_private.current_admin_has_scope(
    target.tenant_id,
    target.management_company_id,
    target.site_id,
    array['SUPER_ADMIN', 'PLATFORM_OPERATOR', 'MANAGEMENT_ADMIN', 'SITE_ADMIN', 'SITE_OPERATOR']
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if target.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;
  if target.status <> 'DELIVERED' then
    raise exception using errcode = '23514', message = 'BATCH_NOT_RECEIVABLE';
  end if;

  select receipt.received_quantity
  into already_received
  from public.qr_batch_receipts as receipt
  where receipt.tenant_id = target.tenant_id
    and receipt.request_id = p_request_id;
  if already_received is not null then
    return jsonb_build_object(
      'resource_id', target.id,
      'version', target.version,
      'affected_count', already_received
    );
  end if;

  select count(*)::integer into pending_count
  from public.qr_assets
  where batch_id = target.id
    and tenant_id = target.tenant_id
    and site_id = target.site_id
    and status = 'PRINTED';
  if p_received_quantity > pending_count then
    raise exception using errcode = '23514', message = 'RECEIPT_EXCEEDS_PENDING';
  end if;

  with selected as (
    select id
    from public.qr_assets
    where batch_id = target.id
      and tenant_id = target.tenant_id
      and site_id = target.site_id
      and status = 'PRINTED'
    order by created_at, id
    limit p_received_quantity
  ), transitioned as (
    update public.qr_assets as asset
    set status = 'IN_STOCK'
    from selected
    where asset.id = selected.id
    returning asset.*
  )
  insert into public.qr_asset_status_logs (
    tenant_id,
    management_company_id,
    site_id,
    batch_id,
    qr_asset_id,
    from_status,
    to_status,
    reason_code,
    reason_text,
    actor_type,
    actor_id
  )
  select
    asset.tenant_id,
    asset.management_company_id,
    asset.site_id,
    asset.batch_id,
    asset.id,
    'PRINTED',
    'IN_STOCK',
    'BATCH_PARTIAL_RECEIPT',
    trim(p_reason),
    'ADMIN',
    actor_user_id
  from transitioned as asset;

  select count(*)::integer into pending_count
  from public.qr_assets
  where batch_id = target.id
    and tenant_id = target.tenant_id
    and site_id = target.site_id
    and status = 'PRINTED';
  next_status := 'DISTRIBUTING';

  insert into public.qr_batch_receipts (
    tenant_id,
    management_company_id,
    site_id,
    batch_id,
    received_quantity,
    reason,
    request_id,
    received_by
  )
  values (
    target.tenant_id,
    target.management_company_id,
    target.site_id,
    target.id,
    p_received_quantity,
    trim(p_reason),
    p_request_id,
    actor_user_id
  );

  if pending_count = 0 then
    update public.qr_batches
    set status = next_status
    where id = target.id;
  end if;

  insert into public.inventory_transactions (
    tenant_id,
    site_id,
    qr_batch_id,
    transaction_type,
    quantity,
    reference_type,
    reference_id,
    created_by
  )
  values (
    target.tenant_id,
    target.site_id,
    target.id,
    'RECEIVE',
    p_received_quantity,
    'QR_BATCH_RECEIPT',
    p_batch_id,
    actor_user_id
  );

  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data,
    reason,
    request_id
  )
  values (
    target.tenant_id,
    target.site_id,
    'ADMIN',
    actor_user_id,
    'QR_BATCH_PARTIAL_RECEIVED',
    'QR_BATCH',
    target.id,
    jsonb_build_object(
      'status', case when pending_count = 0 then next_status else target.status end,
      'receivedCount', p_received_quantity,
      'pendingCount', pending_count
    ),
    trim(p_reason),
    p_request_id
  );

  return jsonb_build_object(
    'resource_id', target.id,
    'version', case when pending_count = 0 then target.version + 1 else target.version end,
    'affected_count', p_received_quantity
  );
end;
$$;

create unique index uq_audit_logs_qr_batch_partial_receipt_request
on public.audit_logs (tenant_id, request_id, action)
where action = 'QR_BATCH_PARTIAL_RECEIVED';

grant execute on function public.receive_qr_batch_quantity(uuid, integer, integer, text, uuid)
to authenticated;

commit;
