import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activeManifestPath = path.join(root, "apps/web/vercel.json");
const templateManifestPath = path.join(root, "apps/web/vercel.production-cron.template.json");
const privacyRoutePath = path.join(root, "apps/web/app/api/internal/privacy-cleanup/route.ts");
const dispatchRoutePath = path.join(
  root,
  "apps/web/app/api/internal/notification-dispatch/route.ts",
);
const solapiHealthRoutePath = path.join(root, "apps/web/app/api/internal/solapi-health/route.ts");
const requiredState = process.argv[2] ?? "either";

function fail(message) {
  console.error(`[production-cron] ${message}`);
  process.exitCode = 1;
}

if (!["either", "--require-active", "--require-deferred"].includes(requiredState)) {
  fail("usage: verify-production-cron.mjs [--require-active|--require-deferred]");
}

const [
  activeManifestText,
  templateManifestText,
  privacyRouteSource,
  dispatchRouteSource,
  solapiHealthRouteSource,
] = await Promise.all([
  readFile(activeManifestPath, "utf8"),
  readFile(templateManifestPath, "utf8"),
  readFile(privacyRoutePath, "utf8"),
  readFile(dispatchRoutePath, "utf8"),
  readFile(solapiHealthRoutePath, "utf8"),
]);

function parseManifest(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    fail(`${label} must be valid JSON.`);
    return undefined;
  }
}

const approvedJobs = [
  { path: "/api/internal/notification-dispatch", schedule: "* * * * *" },
  { path: "/api/internal/privacy-cleanup", schedule: "0 * * * *" },
  { path: "/api/internal/solapi-health", schedule: "0 0 * * *" },
];

function hasExactlyApprovedJobs(manifest) {
  if (!Array.isArray(manifest?.crons) || manifest.crons.length !== approvedJobs.length) {
    return false;
  }
  return approvedJobs.every((approved) =>
    manifest.crons.some(
      (job) => job?.path === approved.path && job?.schedule === approved.schedule,
    ),
  );
}

const activeManifest = parseManifest(activeManifestText, "apps/web/vercel.json");
const templateManifest = parseManifest(
  templateManifestText,
  "apps/web/vercel.production-cron.template.json",
);
const activeJobs = Array.isArray(activeManifest?.crons) ? activeManifest.crons : [];

let activeState;
try {
  activeState =
    activeJobs.length === 0
      ? "deferred"
      : hasExactlyApprovedJobs(activeManifest)
        ? "active"
        : "invalid";
} catch {
  activeState = "invalid";
}

if (!hasExactlyApprovedJobs(templateManifest)) {
  fail(
    "the Production template must contain only the approved cleanup, dispatch, and SOLAPI health Cron jobs.",
  );
}
if (activeState === "invalid") {
  fail("the active manifest must be deferred or contain exactly the approved Cron jobs.");
}
if (requiredState === "--require-active" && activeState !== "active") {
  fail("the active manifest must enable the approved Cron jobs for Production release.");
}
if (requiredState === "--require-deferred" && activeState !== "deferred") {
  fail("the active manifest must keep Cron registration deferred for the current Hobby release.");
}
if (!privacyRouteSource.includes("export async function GET(request: Request)")) {
  fail("the scheduled privacy cleanup route must export GET.");
}
if (!privacyRouteSource.includes("export const maxDuration = 60")) {
  fail("the scheduled privacy cleanup route must keep its bounded maxDuration.");
}
if (!dispatchRouteSource.includes("export async function GET(request: Request)")) {
  fail("the scheduled notification dispatch route must export GET.");
}
if (!dispatchRouteSource.includes("export const maxDuration = 60")) {
  fail("the scheduled notification dispatch route must keep its bounded maxDuration.");
}
if (!solapiHealthRouteSource.includes("export async function GET(request: Request)")) {
  fail("the scheduled SOLAPI account health route must export GET.");
}
if (!solapiHealthRouteSource.includes("export const maxDuration = 30")) {
  fail("the scheduled SOLAPI account health route must keep its bounded maxDuration.");
}
if (/authorization|bearer|cron_secret|secret/i.test(activeManifestText + templateManifestText)) {
  fail("Cron manifests must not embed credentials or authorization values.");
}

if (!process.exitCode) {
  console.log(
    `[production-cron] ${activeState} active manifest and credential-free Production template verified`,
  );
}
