begin;

-- Taptolk operates some managed locations directly, without a third-party
-- management company in between.
--
-- sites.management_company_id is NOT NULL and carries a composite foreign key to
-- (tenant_id, management_company_id), so a directly operated location still needs a
-- company row to hang from. This flag marks the rows that are Taptolk itself rather
-- than a customer's management company, so authorization, badges and filtering never
-- have to match on the company name.
alter table public.management_companies
  add column if not exists is_platform_direct boolean not null default false;

comment on column public.management_companies.is_platform_direct is
  'True when Taptolk operates this company''s sites directly. Never infer this from the company name.';

-- A tenant has at most one platform-direct company; more than one would make
-- "which company owns an unaffiliated site" ambiguous.
create unique index if not exists uq_management_companies_platform_direct
  on public.management_companies (tenant_id)
  where is_platform_direct and deleted_at is null;

-- Taptolk's own tenant. Directly operated locations live here, isolated from every
-- customer tenant by the same tenant_id boundary that separates customers from each
-- other. Fixed identifiers keep this migration reproducible across environments.
insert into public.tenants (id, name, slug, status)
select
  '7a9704b1-0000-4000-8000-000000000001'::uuid,
  'Taptolk',
  'taptolk',
  'ACTIVE'
where not exists (
  select 1
  from public.tenants
  where lower(slug) = 'taptolk'
    and deleted_at is null
);

insert into public.management_companies (id, tenant_id, name, status, is_platform_direct)
select
  '7a9704b1-0000-4000-8000-000000000002'::uuid,
  '7a9704b1-0000-4000-8000-000000000001'::uuid,
  'Taptolk 직영',
  'ACTIVE',
  true
where exists (
  select 1
  from public.tenants
  where id = '7a9704b1-0000-4000-8000-000000000001'::uuid
)
and not exists (
  select 1
  from public.management_companies
  where tenant_id = '7a9704b1-0000-4000-8000-000000000001'::uuid
    and is_platform_direct
    and deleted_at is null
);

commit;
