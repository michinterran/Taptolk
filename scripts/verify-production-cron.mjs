import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activeManifestPath = path.join(root, "apps/web/vercel.json");
const templateManifestPath = path.join(root, "apps/web/vercel.production-cron.template.json");
const routePath = path.join(root, "apps/web/app/api/internal/privacy-cleanup/route.ts");
const requiredState = process.argv[2] ?? "either";

function fail(message) {
  console.error(`[production-cron] ${message}`);
  process.exitCode = 1;
}

if (!["either", "--require-active", "--require-deferred"].includes(requiredState)) {
  fail("usage: verify-production-cron.mjs [--require-active|--require-deferred]");
}

const [activeManifestText, templateManifestText, routeSource] = await Promise.all([
  readFile(activeManifestPath, "utf8"),
  readFile(templateManifestPath, "utf8"),
  readFile(routePath, "utf8"),
]);

function parseManifest(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    fail(`${label} must be valid JSON.`);
    return undefined;
  }
}

function matchingJobs(manifest) {
  return Array.isArray(manifest?.crons)
    ? manifest.crons.filter(
        (job) => job?.path === "/api/internal/privacy-cleanup" && job?.schedule === "0 * * * *",
      )
    : [];
}

const activeManifest = parseManifest(activeManifestText, "apps/web/vercel.json");
const templateManifest = parseManifest(
  templateManifestText,
  "apps/web/vercel.production-cron.template.json",
);
const activeJobs = Array.isArray(activeManifest?.crons) ? activeManifest.crons : [];
const templateJobs = Array.isArray(templateManifest?.crons) ? templateManifest.crons : [];
const activeMatchingJobs = matchingJobs(activeManifest);
const templateMatchingJobs = matchingJobs(templateManifest);

let activeState;
try {
  activeState =
    activeJobs.length === 0
      ? "deferred"
      : activeJobs.length === 1 && activeMatchingJobs.length === 1
        ? "active"
        : "invalid";
} catch {
  activeState = "invalid";
}

if (templateJobs.length !== 1 || templateMatchingJobs.length !== 1) {
  fail("the Production template must contain exactly one hourly privacy cleanup Cron job.");
}
if (activeState === "invalid") {
  fail("the active manifest must be deferred or contain exactly one approved hourly Cron job.");
}
if (requiredState === "--require-active" && activeState !== "active") {
  fail("the active manifest must enable the approved hourly Cron job for Production release.");
}
if (requiredState === "--require-deferred" && activeState !== "deferred") {
  fail("the active manifest must keep Cron registration deferred for the current Hobby release.");
}
if (!routeSource.includes("export async function GET(request: Request)")) {
  fail("the scheduled privacy cleanup route must export GET.");
}
if (!routeSource.includes("export const maxDuration = 60")) {
  fail("the scheduled privacy cleanup route must keep its bounded maxDuration.");
}
if (/authorization|bearer|cron_secret|secret/i.test(activeManifestText + templateManifestText)) {
  fail("Cron manifests must not embed credentials or authorization values.");
}

if (!process.exitCode) {
  console.log(
    `[production-cron] ${activeState} active manifest and credential-free hourly Production template verified`,
  );
}
