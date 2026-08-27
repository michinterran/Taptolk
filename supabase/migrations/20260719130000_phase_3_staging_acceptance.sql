begin;

create or replace function public.provision_qr_generation_staging_acceptance(
  p_tenant_id uuid,
  p_management_company_id uuid,
  p_site_id uuid,
  p_requester_id uuid,
  p_approver_id uuid,
  p_acceptance_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  design_id uuid := gen_random_uuid();
  batch_id uuid;
  job_id uuid;
  batch_ids uuid[] := array[]::uuid[];
  job_ids uuid[] := array[]::uuid[];
  batch_index integer;
  normalized_label text := upper(trim(coalesce(p_acceptance_label, '')));
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_tenant_id is null
    or p_management_company_id is null
    or p_site_id is null
    or p_requester_id is null
    or p_approver_id is null
    or p_requester_id = p_approver_id
    or normalized_label !~ '^QR1K-[A-Z0-9]{8,24}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_ACCEPTANCE_SCOPE';
  end if;

  if not exists (
    select 1
    from public.tenants as tenant
    join public.management_companies as company
      on company.tenant_id = tenant.id
      and company.id = p_management_company_id
    join public.sites as site
      on site.tenant_id = tenant.id
      and site.management_company_id = company.id
      and site.id = p_site_id
    where tenant.id = p_tenant_id
      and tenant.slug like 'e2e-%'
      and tenant.name like 'Taptolk E2E % Tenant %'
      and tenant.status = 'ACTIVE'
      and company.status = 'ACTIVE'
      and site.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'STAGING_FIXTURE_SCOPE_REQUIRED';
  end if;

  if not exists (
    select 1
    from auth.users as auth_user
    join public.admin_profiles as profile on profile.user_id = auth_user.id
    join public.admin_memberships as membership on membership.user_id = auth_user.id
    where auth_user.id = p_requester_id
      and auth_user.email like 'taptolk-e2e-%@example.com'
      and auth_user.raw_user_meta_data ->> 'purpose' = 'taptolk-staging-site-e2e'
      and profile.status = 'ACTIVE'
      and membership.status = 'ACTIVE'
      and membership.role = 'SITE_ADMIN'
      and membership.scope_type = 'SITE'
      and membership.tenant_id = p_tenant_id
      and membership.management_company_id = p_management_company_id
      and membership.site_id = p_site_id
  ) then
    raise exception using errcode = '42501', message = 'STAGING_REQUESTER_REQUIRED';
  end if;

  if not exists (
    select 1
    from auth.users as auth_user
    join public.admin_profiles as profile on profile.user_id = auth_user.id
    join public.admin_memberships as membership on membership.user_id = auth_user.id
    where auth_user.id = p_approver_id
      and auth_user.email like 'taptolk-e2e-%@example.com'
      and auth_user.raw_user_meta_data ->> 'purpose' = 'taptolk-staging-site-e2e'
      and profile.status = 'ACTIVE'
      and membership.status = 'ACTIVE'
      and membership.role = 'SUPER_ADMIN'
      and membership.scope_type = 'PLATFORM'
  ) then
    raise exception using errcode = '42501', message = 'STAGING_APPROVER_REQUIRED';
  end if;

  if exists (
    select 1
    from public.sticker_design_versions
    where site_id = p_site_id
  ) then
    raise exception using errcode = '23514', message = 'ACCEPTANCE_SITE_NOT_EMPTY';
  end if;

  insert into public.sticker_design_versions (
    id,
    tenant_id,
    management_company_id,
    site_id,
    template_code,
    design_config,
    status,
    created_by,
    approved_by,
    approved_at
  )
  values (
    design_id,
    p_tenant_id,
    p_management_company_id,
    p_site_id,
    'ROUND_WHITE_MINIMAL_V1',
    jsonb_build_object(
      'brandAssetId', null,
      'qrOptions', jsonb_build_object(
        'errorCorrectionLevel', 'H',
        'marginModules', 4
      ),
      'schemaVersion', 1,
      'zones', jsonb_build_object(
        'customerLogo', 'OPTIONAL_TOP',
        'qr', 'CENTER_WHITE_PLATE',
        'taptolkLogo', 'IMMUTABLE_BOTTOM'
      )
    ),
    'APPROVED',
    p_requester_id,
    p_approver_id,
    statement_timestamp()
  );

  for batch_index in 1..10 loop
    batch_id := gen_random_uuid();
    job_id := gen_random_uuid();

    insert into public.qr_batches (
      id,
      tenant_id,
      management_company_id,
      site_id,
      batch_code,
      sticker_design_version_id,
      requested_quantity,
      purpose,
      status,
      requested_by,
      sample_approved_by,
      sample_approved_at,
      generation_approved_by,
      generation_approved_at,
      idempotency_key,
      created_at
    )
    values (
      batch_id,
      p_tenant_id,
      p_management_company_id,
      p_site_id,
      replace(normalized_label, '-', '') || '-' || lpad(batch_index::text, 2, '0'),
      design_id,
      100,
      'Bounded 10x100 staging acceptance',
      'GENERATION_APPROVED',
      p_requester_id,
      p_approver_id,
      statement_timestamp(),
      p_approver_id,
      statement_timestamp(),
      gen_random_uuid(),
      statement_timestamp() + make_interval(secs => batch_index)
    );

    insert into public.qr_batch_samples (
      tenant_id,
      management_company_id,
      site_id,
      batch_id,
      status,
      storage_bucket,
      storage_path,
      checksum_sha256,
      mime_type,
      byte_size,
      decode_passed,
      quiet_zone_passed,
      contrast_passed,
      attached_by,
      approved_by,
      approved_at
    )
    values (
      p_tenant_id,
      p_management_company_id,
      p_site_id,
      batch_id,
      'APPROVED',
      'qr-artifacts',
      'staging-acceptance/' || normalized_label || '/samples/' || lpad(batch_index::text, 2, '0') || '.png',
      encode(sha256((normalized_label || ':sample:' || batch_index)::bytea), 'hex'),
      'image/png',
      1,
      true,
      true,
      true,
      p_approver_id,
      p_approver_id,
      statement_timestamp()
    );

    insert into public.qr_generation_jobs (
      id,
      tenant_id,
      management_company_id,
      site_id,
      qr_batch_id,
      approval_request_id,
      status,
      available_at,
      created_at
    )
    values (
      job_id,
      p_tenant_id,
      p_management_company_id,
      p_site_id,
      batch_id,
      gen_random_uuid(),
      'PENDING_DELIVERY',
      statement_timestamp(),
      statement_timestamp() + make_interval(secs => batch_index)
    );

    insert into public.audit_logs (
      tenant_id,
      site_id,
      actor_type,
      actor_id,
      action,
      resource_type,
      resource_id,
      before_data,
      after_data,
      reason,
      request_id
    )
    values (
      p_tenant_id,
      p_site_id,
      'ADMIN',
      p_approver_id,
      'QR_BATCH_GENERATION_APPROVED',
      'QR_BATCH',
      batch_id,
      jsonb_build_object('batchStatus', 'FINAL_APPROVAL_PENDING'),
      jsonb_build_object(
        'batchStatus', 'GENERATION_APPROVED',
        'generationRevision', 1,
        'jobStatus', 'PENDING_DELIVERY'
      ),
      'Bounded 10x100 staging acceptance approval',
      gen_random_uuid()
    );

    batch_ids := array_append(batch_ids, batch_id);
    job_ids := array_append(job_ids, job_id);
  end loop;

  return jsonb_build_object(
    'acceptance_label', normalized_label,
    'batch_count', cardinality(batch_ids),
    'batch_ids', to_jsonb(batch_ids),
    'design_id', design_id,
    'job_count', cardinality(job_ids),
    'job_ids', to_jsonb(job_ids),
    'quantity_per_batch', 100,
    'total_quantity', 1000
  );
end;
$$;

create or replace function public.inspect_qr_generation_staging_acceptance_queue(
  p_job_ids uuid[],
  p_acceptance_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_label text := upper(trim(coalesce(p_acceptance_label, '')));
  job_id_texts text[];
  active_total bigint;
  archived_total bigint;
  matching_active bigint;
  matching_archived bigint;
  poison_active bigint;
  poison_archived bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_job_ids is null
    or cardinality(p_job_ids) not between 0 and 20
    or array_position(p_job_ids, null) is not null
    or normalized_label !~ '^QR1K-[A-Z0-9]{8,24}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_ACCEPTANCE_SCOPE';
  end if;
  if to_regclass('pgmq."q_qr-generation"') is null
    or to_regclass('pgmq."a_qr-generation"') is null
  then
    raise exception using errcode = 'P0002', message = 'QR_GENERATION_QUEUE_NOT_PROVISIONED';
  end if;

  select coalesce(array_agg(job_id::text), array[]::text[])
  into job_id_texts
  from unnest(p_job_ids) as job_id;

  execute 'select count(*) from pgmq."q_qr-generation"'
  into active_total;
  execute 'select count(*) from pgmq."a_qr-generation"'
  into archived_total;
  execute $query$
    select count(*)
    from pgmq."q_qr-generation"
    where message ->> 'jobId' = any($1)
      or message ->> 'acceptanceTag' = $2
  $query$
  into matching_active
  using job_id_texts, normalized_label;
  execute $query$
    select count(*)
    from pgmq."a_qr-generation"
    where message ->> 'jobId' = any($1)
      or message ->> 'acceptanceTag' = $2
  $query$
  into matching_archived
  using job_id_texts, normalized_label;
  execute $query$
    select count(*)
    from pgmq."q_qr-generation"
    where message ->> 'acceptanceTag' = $1
  $query$
  into poison_active
  using normalized_label;
  execute $query$
    select count(*)
    from pgmq."a_qr-generation"
    where message ->> 'acceptanceTag' = $1
  $query$
  into poison_archived
  using normalized_label;

  return jsonb_build_object(
    'active_total', active_total,
    'archived_total', archived_total,
    'matching_active', matching_active,
    'matching_archived', matching_archived,
    'poison_active', poison_active,
    'poison_archived', poison_archived
  );
end;
$$;

create or replace function public.cleanup_qr_generation_staging_acceptance_queue(
  p_job_ids uuid[],
  p_acceptance_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_label text := upper(trim(coalesce(p_acceptance_label, '')));
  job_id_texts text[];
  deleted_active bigint;
  deleted_archived bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_job_ids is null
    or cardinality(p_job_ids) not between 1 and 20
    or array_position(p_job_ids, null) is not null
    or normalized_label !~ '^QR1K-[A-Z0-9]{8,24}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_ACCEPTANCE_SCOPE';
  end if;
  if to_regclass('pgmq."q_qr-generation"') is null
    or to_regclass('pgmq."a_qr-generation"') is null
  then
    raise exception using errcode = 'P0002', message = 'QR_GENERATION_QUEUE_NOT_PROVISIONED';
  end if;

  select array_agg(job_id::text)
  into job_id_texts
  from unnest(p_job_ids) as job_id;

  execute $query$
    delete from pgmq."q_qr-generation"
    where message ->> 'jobId' = any($1)
      or message ->> 'acceptanceTag' = $2
  $query$
  using job_id_texts, normalized_label;
  get diagnostics deleted_active = row_count;

  execute $query$
    delete from pgmq."a_qr-generation"
    where message ->> 'jobId' = any($1)
      or message ->> 'acceptanceTag' = $2
  $query$
  using job_id_texts, normalized_label;
  get diagnostics deleted_archived = row_count;

  return jsonb_build_object(
    'deleted_active', deleted_active,
    'deleted_archived', deleted_archived
  );
end;
$$;

revoke all on function public.provision_qr_generation_staging_acceptance(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated;
grant execute on function public.provision_qr_generation_staging_acceptance(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
)
to service_role;

revoke all on function public.inspect_qr_generation_staging_acceptance_queue(uuid[], text)
from public, anon, authenticated;
grant execute on function public.inspect_qr_generation_staging_acceptance_queue(uuid[], text)
to service_role;

revoke all on function public.cleanup_qr_generation_staging_acceptance_queue(uuid[], text)
from public, anon, authenticated;
grant execute on function public.cleanup_qr_generation_staging_acceptance_queue(uuid[], text)
to service_role;

comment on function public.provision_qr_generation_staging_acceptance(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
) is
  'Provisions exactly ten independently identified 100-item Batches inside a bounded ephemeral staging fixture.';
comment on function public.inspect_qr_generation_staging_acceptance_queue(uuid[], text) is
  'Returns count-only Queue acceptance evidence without returning message payloads.';
comment on function public.cleanup_qr_generation_staging_acceptance_queue(uuid[], text) is
  'Removes only acceptance-owned active and archived Queue messages after evidence capture.';

commit;
