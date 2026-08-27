import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageModulePath = path.join(root, "packages/config/src/stage.server.ts");
const configPackagePath = path.join(root, "packages/config/package.json");
const manifestPath = path.join(root, "config/service-stage-test-surfaces.json");
const sourceRoots = [path.join(root, "apps"), path.join(root, "packages")];
const marker = "@taptolk-test-only";
const allowedKinds = new Set(["environment-capability", "fixture-command", "provider", "route"]);

function fail(message) {
  console.error(`[service-stage] ${message}`);
  process.exitCode = 1;
}

async function readJson(file, label) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    fail(`${label} must be valid JSON.`);
    return undefined;
  }
}

async function collectProductionSources(directory) {
  const sources = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ["dist", "node_modules"].includes(entry.name)) {
      continue;
    }
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...(await collectProductionSources(target)));
      continue;
    }
    if (
      entry.isFile() &&
      /\.(?:ts|tsx)$/u.test(entry.name) &&
      !/\.(?:spec|test)\.(?:ts|tsx)$/u.test(entry.name)
    ) {
      sources.push(target);
    }
  }
  return sources;
}

if (process.env.TAPTOLK_STAGE !== "SERVICE") {
  fail("the guard must run with TAPTOLK_STAGE=SERVICE.");
}

const [stageSource, configPackage, manifest] = await Promise.all([
  readFile(stageModulePath, "utf8"),
  readJson(configPackagePath, "packages/config/package.json"),
  readJson(manifestPath, "config/service-stage-test-surfaces.json"),
]);

if (!stageSource.startsWith('import "server-only";')) {
  fail("the stage policy must keep the server-only import as its first statement.");
}
if (!stageSource.includes("process.env.TAPTOLK_STAGE")) {
  fail("the stage policy must resolve from the server process environment.");
}
if (/NEXT_PUBLIC_|searchParams|document\.|window\./u.test(stageSource)) {
  fail("the stage policy must not read browser-controlled inputs.");
}
if (!configPackage?.exports?.["./stage/server"]) {
  fail("packages/config must expose only the explicit stage/server entry point.");
}
if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest?.surfaces)) {
  fail("the Service test-surface manifest must use schemaVersion 1 and a surfaces array.");
}

const registered = new Map();
for (const surface of manifest?.surfaces ?? []) {
  if (
    !surface ||
    typeof surface.path !== "string" ||
    !allowedKinds.has(surface.kind) ||
    surface.serviceBehavior !== "NOT_FOUND"
  ) {
    fail("every test-only surface must declare path, reviewed kind, and NOT_FOUND behavior.");
    continue;
  }
  const normalizedPath = surface.path.replaceAll("\\", "/");
  if (
    path.isAbsolute(normalizedPath) ||
    normalizedPath.startsWith("../") ||
    registered.has(normalizedPath)
  ) {
    fail(`invalid or duplicate test-only surface path: ${normalizedPath}`);
    continue;
  }
  registered.set(normalizedPath, surface);
}

const productionSources = (await Promise.all(sourceRoots.map(collectProductionSources))).flat();
const discovered = new Set();

for (const sourcePath of productionSources) {
  const source = await readFile(sourcePath, "utf8");
  const relativePath = path.relative(root, sourcePath).replaceAll("\\", "/");
  if (source.includes("NEXT_PUBLIC_TAPTOLK_STAGE")) {
    fail(`${relativePath} must not expose the stage through NEXT_PUBLIC_.`);
  }
  if (!source.includes(marker)) {
    continue;
  }
  discovered.add(relativePath);
  if (!registered.has(relativePath)) {
    fail(`${relativePath} is marked test-only but is missing from the Service manifest.`);
  }
}

for (const [relativePath] of registered) {
  const sourcePath = path.join(root, relativePath);
  let source;
  try {
    source = await readFile(sourcePath, "utf8");
  } catch {
    fail(`registered test-only surface does not exist: ${relativePath}`);
    continue;
  }
  if (!source.includes(marker) || !source.includes("requireDevelopmentTestStage")) {
    fail(`${relativePath} must use the test-only marker and the central stage guard.`);
  }
  if (!discovered.has(relativePath)) {
    fail(`${relativePath} is registered but was not discovered as a production source.`);
  }
}

if (!process.exitCode) {
  console.log(
    `[service-stage] SERVICE fail-closed boundary verified; ${registered.size} registered test-only surface(s)`,
  );
}
