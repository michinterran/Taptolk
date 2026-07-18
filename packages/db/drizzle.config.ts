import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required for Drizzle commands.");
}

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
  },
  dialect: "postgresql",
  out: "../../supabase/migrations",
  schema: "./src/schema/index.ts",
  strict: true,
  verbose: true,
});
