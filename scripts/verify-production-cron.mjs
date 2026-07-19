import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "apps/web/vercel.json");
const routePath = path.join(root, "apps/web/app/api/internal/privacy-cleanup/route.ts");

function fail(message) {
  console.error(`[production-cron] ${message}`);
  process.exitCode = 1;
}

const [manifestText, routeSource] = await Promise.all([
  readFile(manifestPath, "utf8"),
  readFile(routePath, "utf8"),
]);

let manifest;
try {
  manifest = JSON.parse(manifestText);
} catch {
  fail("apps/web/vercel.json must be valid JSON.");
}

const matchingJobs = Array.isArray(manifest?.crons)
  ? manifest.crons.filter(
      (job) => job?.path === "/api/internal/privacy-cleanup" && job?.schedule === "0 * * * *",
    )
  : [];

if (matchingJobs.length !== 1) {
  fail("exactly one hourly privacy cleanup Cron job is required.");
}
if (!routeSource.includes("export async function GET(request: Request)")) {
  fail("the scheduled privacy cleanup route must export GET.");
}
if (!routeSource.includes("export const maxDuration = 60")) {
  fail("the scheduled privacy cleanup route must keep its bounded maxDuration.");
}
if (/authorization|bearer|cron_secret|secret/i.test(manifestText)) {
  fail("the Cron manifest must not embed credentials or authorization values.");
}

if (!process.exitCode) {
  console.log("[production-cron] hourly GET schedule and credential-free manifest verified");
}
