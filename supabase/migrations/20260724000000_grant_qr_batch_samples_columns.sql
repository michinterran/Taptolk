-- Migration: Grant column-level SELECT to authenticated role on qr_batch_samples
--
-- Problem:
--   The /api/admin/qr-samples/[id] route always returned 404 because the
--   authenticated role lacked SELECT privilege on the storage metadata columns
--   of public.qr_batch_samples.  Row-level security was in place but column
--   grants were missing, so the query returned zero rows instead of the sample.
--
-- Fix:
--   Grant SELECT on the three storage-metadata columns that the sample-preview
--   route reads.  The grant is intentionally column-scoped (not table-wide) to
--   follow the principle of least privilege; sensitive audit columns remain
--   inaccessible to client sessions.

begin;

grant select (storage_bucket, storage_path, checksum_sha256)
  on public.qr_batch_samples
  to authenticated;

commit;
