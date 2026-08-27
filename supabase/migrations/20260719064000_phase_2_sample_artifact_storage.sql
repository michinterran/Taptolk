begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'qr-artifacts',
  'qr-artifacts',
  false,
  20000000,
  array['image/png', 'image/svg+xml', 'application/pdf', 'application/zip', 'text/csv', 'application/json']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
