import { access, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = process.cwd();
const configPath = resolve(root, "supabase/config.toml");
const seedPath = resolve(root, "supabase/seed.sql");
const migrationDirectory = resolve(root, "supabase/migrations");
const testDirectory = resolve(root, "supabase/tests/database");

await Promise.all([
  access(configPath),
  access(seedPath),
  access(migrationDirectory),
  access(testDirectory),
]);

const [migrations, tests] = await Promise.all([
  readdir(migrationDirectory),
  readdir(testDirectory),
]);

const sqlMigrations = migrations.filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(file));
const sqlTests = tests.filter((file) => file.endsWith(".sql"));
const requiredMigrationContracts = new Map([
  [
    "20260719060000_phase_2_4_core_schema.sql",
    [
      "alter table public.brand_assets force row level security",
      "alter table public.qr_activation_codes force row level security",
      "alter table public.vehicle_import_rows force row level security",
      "revoke all on table public.qr_activation_codes from public, anon, authenticated",
      "revoke all on table public.vehicle_import_rows from public, anon, authenticated",
      "uq_qr_active_binding",
      "uq_vehicle_primary_active_qr",
      "trg_qr_bindings_no_delete",
      "trg_inventory_transactions_no_update_delete",
    ],
  ],
  [
    "20260719061000_phase_4_inventory_assignment_transactions.sql",
    [
      "actor_user_id uuid := auth.uid()",
      "public.receive_qr_batch",
      "public.assign_qr_asset",
      "public.save_validated_vehicle_import",
      "public.commit_vehicle_import",
      "public.replace_qr_asset",
      "public.revoke_qr_asset",
      "from public, anon",
      "to authenticated",
    ],
  ],
  [
    "20260719063000_phase_2_brand_asset_registration.sql",
    [
      "actor_user_id uuid := auth.uid()",
      "public.register_brand_asset",
      "from public, anon",
      "to authenticated",
    ],
  ],
  [
    "20260719065000_phase_3_qr_generation_execution.sql",
    [
      "public.start_qr_generation_execution",
      "public.commit_qr_generation_chunk",
      "public.complete_qr_generation_execution",
      "from public, anon, authenticated",
      "to service_role",
    ],
  ],
  [
    "20260719066000_phase_3_print_export_execution.sql",
    [
      "public.get_qr_print_export_context",
      "public.commit_qr_print_exports",
      "from public, anon, authenticated",
      "to service_role",
    ],
  ],
  [
    "20260719069000_phase_3_generation_failure_retry.sql",
    [
      "public.record_qr_generation_execution_failure",
      "public.record_qr_print_export_failure",
      "from public, anon, authenticated",
      "to service_role",
    ],
  ],
  [
    "20260719071000_phase_3_delivery_and_staging_fixture.sql",
    [
      "public.advance_qr_batch_delivery",
      "public.cleanup_staging_e2e_fixture",
      "SERVICE_ROLE_REQUIRED",
      "FIXTURE_TENANT_REQUIRED",
      "from public, anon, authenticated",
      "to service_role",
    ],
  ],
]);

if (sqlMigrations.length === 0) {
  throw new Error("No timestamped Supabase migration was found.");
}

if (sqlTests.length === 0) {
  throw new Error("No database policy test was found.");
}

for (const migration of sqlMigrations) {
  const source = await readFile(join(migrationDirectory, migration), "utf8");
  if (!source.includes("begin;") || !source.includes("commit;")) {
    throw new Error(`${migration} must define an explicit transaction boundary.`);
  }

  if (migration.includes("phase_1_tenant_admin")) {
    const requiredMarkers = [
      "enable row level security",
      "force row level security",
      "current_admin_has_scope",
      "fk_sites_tenant_management_company",
      "audit_payload_is_safe",
    ];
    for (const marker of requiredMarkers) {
      if (!source.includes(marker)) {
        throw new Error(`${migration} is missing Phase 1 security marker: ${marker}`);
      }
    }
  }

  const requiredMarkers = requiredMigrationContracts.get(migration);
  if (requiredMarkers) {
    for (const marker of requiredMarkers) {
      if (!source.includes(marker)) {
        throw new Error(`${migration} is missing required database contract marker: ${marker}`);
      }
    }
  }
}

for (const migration of requiredMigrationContracts.keys()) {
  if (!sqlMigrations.includes(migration)) {
    throw new Error(`Required Phase 2-4 migration is missing: ${migration}`);
  }
}

const databaseTestEntries = await Promise.all(
  sqlTests.map(async (test) => ({
    source: await readFile(join(testDirectory, test), "utf8"),
    test,
  })),
);
const databaseTestSources = databaseTestEntries.map(({ source }) => source);
if (!databaseTestSources.some((source) => source.includes("policies_are"))) {
  throw new Error("Database tests must assert the exact RLS policy set.");
}

for (const requiredTest of [
  "phase_2_3_execution_contract.sql",
  "phase_2_4_core_schema.sql",
  "phase_4_delivery_staging_fixture.sql",
]) {
  const entry = databaseTestEntries.find(({ test }) => test === requiredTest);
  if (!entry) {
    throw new Error(`Required Phase 2-4 database test is missing: ${requiredTest}`);
  }
  if (!entry.source.includes("function_privs_are") || !entry.source.includes("has_trigger")) {
    throw new Error(
      `${requiredTest} must assert RPC privileges and history/immutability triggers.`,
    );
  }
}

console.log(`[db:check] ${sqlMigrations.length} migration(s), ${sqlTests.length} database test(s)`);
