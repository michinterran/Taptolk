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
}

const databaseTestSources = await Promise.all(
  sqlTests.map((test) => readFile(join(testDirectory, test), "utf8")),
);
if (!databaseTestSources.some((source) => source.includes("policies_are"))) {
  throw new Error("Database tests must assert the exact RLS policy set.");
}

console.log(`[db:check] ${sqlMigrations.length} migration(s), ${sqlTests.length} database test(s)`);
