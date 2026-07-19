begin;

create or replace function public.prepare_notification_reply_staging_fixture(
  p_tenant_id uuid,
  p_owner_id uuid,
  p_phone_ciphertext text,
  p_phone_key_version integer,
  p_phone_last4 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if length(p_phone_ciphertext) not between 40 and 1000
    or p_phone_key_version <> 1
    or p_phone_last4 !~ '^[0-9]{4}$'
    or not exists (
      select 1
      from public.tenants as tenant
      join public.qr_assets as asset on asset.tenant_id = tenant.id
      join public.qr_bindings as binding
        on binding.qr_asset_id = asset.id and binding.owner_id = p_owner_id
      where tenant.id = p_tenant_id
        and tenant.slug like 'e2e-%'
        and tenant.name like 'Taptolk E2E % Tenant %'
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_NOTIFICATION_STAGING_SCOPE';
  end if;
  update public.owners
  set phone_ciphertext = p_phone_ciphertext,
      phone_key_version = p_phone_key_version,
      phone_last4 = p_phone_last4,
      updated_at = statement_timestamp(),
      version = version + 1
  where id = p_owner_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOTIFICATION_STAGING_OWNER_NOT_FOUND';
  end if;
  return jsonb_build_object('prepared', true);
end;
$$;

revoke all on function public.prepare_notification_reply_staging_fixture(
  uuid, uuid, text, integer, text
) from public, anon, authenticated;
grant execute on function public.prepare_notification_reply_staging_fixture(
  uuid, uuid, text, integer, text
) to service_role;

comment on function public.prepare_notification_reply_staging_fixture(
  uuid, uuid, text, integer, text
) is 'Bounded staging-only Owner destination preparation; no raw phone input is accepted.';

commit;
