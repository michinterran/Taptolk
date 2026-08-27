begin;

-- QR generation must enter through the durable requester -> independent
-- Super Admin approval flow. The legacy direct RPC remains for historical
-- deployments, but authenticated browser sessions may no longer execute it.
revoke execute on function public.request_admin_direct_qr_generation(
  uuid,
  integer,
  integer,
  text,
  uuid
) from public, anon, authenticated;

comment on function public.request_admin_direct_qr_generation(
  uuid,
  integer,
  integer,
  text,
  uuid
) is
  'Retained for historical compatibility only. QR issuance must use the requester and independent Super Admin approval flow.';

commit;
