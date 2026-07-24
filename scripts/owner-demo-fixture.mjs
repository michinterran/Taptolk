#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const defaultEnvPath = path.join(root, "apps/web/.env.local");
const linkedProjectPath = path.join(root, "supabase/.temp/project-ref");
const statePath = path.join(root, ".taptolk-demo/owner-activation-state.json");

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    baseUrl: process.env.TAPTOLK_DEMO_BASE_URL ?? "",
    envFile: process.env.TAPTOLK_DEMO_ENV_FILE ?? defaultEnvPath,
    locale: process.env.TAPTOLK_DEMO_LOCALE ?? "ko",
    open: false,
  };
  for (const argument of rest) {
    if (argument === "--") {
      continue;
    }
    if (argument.startsWith("--base-url=")) {
      options.baseUrl = argument.slice("--base-url=".length);
    } else if (argument.startsWith("--env-file=")) {
      options.envFile = argument.slice("--env-file=".length);
    } else if (argument.startsWith("--locale=")) {
      options.locale = argument.slice("--locale=".length);
    } else if (argument === "--open") {
      options.open = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { command, options };
}

function parseEnvironmentFile(source) {
  const values = {};
  for (const sourceLine of source.split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator < 1) {
      continue;
    }
    const key = line
      .slice(0, separator)
      .replace(/^export\s+/u, "")
      .trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) {
      continue;
    }
    values[key] = value;
  }
  return values;
}

async function loadEnvironment(envFile) {
  const resolvedEnvPath = path.resolve(root, envFile);
  const envFiles = [defaultEnvPath];
  if (resolvedEnvPath !== defaultEnvPath) {
    envFiles.push(resolvedEnvPath);
  }
  const [envSources, linkedProjectRef] = await Promise.all([
    Promise.all(envFiles.map((filePath) => readFile(filePath, "utf8"))),
    readFile(linkedProjectPath, "utf8"),
  ]);
  const processEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value),
  );
  const environment = {
    ...Object.assign({}, ...envSources.map((source) => parseEnvironmentFile(source))),
    ...processEnvironment,
  };
  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = environment.SUPABASE_SECRET_KEY;
  const tokenHmacKey = environment.TOKEN_HMAC_KEY;
  const appEnv = environment.APP_ENV;
  const linkedRef = linkedProjectRef.trim();
  if (appEnv !== "staging") {
    throw new Error("Owner demo fixture requires APP_ENV=staging.");
  }
  if (!supabaseUrl || !secretKey || !tokenHmacKey) {
    throw new Error(
      "Owner demo fixture requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and TOKEN_HMAC_KEY.",
    );
  }
  if (!secretKey.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SECRET_KEY must be the staging Supabase secret key.");
  }
  const hostname = new URL(supabaseUrl).hostname;
  if (!linkedRef || hostname !== `${linkedRef}.supabase.co`) {
    throw new Error("Owner demo fixture refused a Supabase project that is not linked staging.");
  }
  return {
    envFile: path.relative(root, resolvedEnvPath),
    hasLocalMockOtp: Boolean(environment.OWNER_STAGING_MOCK_OTP),
    secretKey,
    supabaseUrl,
    tokenHmacKey,
    linkedRef,
  };
}

class StagingApi {
  constructor(supabaseUrl, secretKey) {
    this.supabaseUrl = supabaseUrl;
    this.secretKey = secretKey;
  }

  headers(prefer) {
    return {
      apikey: this.secretKey,
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    };
  }

  async assertResponse(response, operation) {
    if (response.ok) {
      return;
    }
    let code = "UNKNOWN";
    try {
      code = (await response.json()).code ?? code;
    } catch {
      // Keep provider bodies and secrets out of logs.
    }
    throw new Error(`${operation} failed with HTTP ${response.status} (${code}).`);
  }

  async createUser(email, password) {
    const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users`, {
      body: JSON.stringify({
        email,
        email_confirm: true,
        password,
        user_metadata: { purpose: "taptolk-staging-site-e2e" },
      }),
      headers: this.headers(),
      method: "POST",
    });
    await this.assertResponse(response, "Create demo Auth user");
    const body = await response.json();
    if (typeof body.id !== "string") {
      throw new Error("Create demo Auth user returned no user id.");
    }
    return body.id;
  }

  async deleteUser(userId) {
    const response = await fetch(
      `${this.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}?should_soft_delete=false`,
      { headers: this.headers(), method: "DELETE" },
    );
    if (response.status !== 404) {
      await this.assertResponse(response, "Delete demo Auth user");
    }
  }

  async insert(table, rows) {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
      body: JSON.stringify(rows),
      headers: this.headers("return=minimal"),
      method: "POST",
    });
    await this.assertResponse(response, `Insert ${table} demo fixture`);
  }

  async rpc(functionName, input) {
    const response = await fetch(
      `${this.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(functionName)}`,
      {
        body: JSON.stringify(input),
        headers: this.headers(),
        method: "POST",
      },
    );
    await this.assertResponse(response, `Execute ${functionName} demo RPC`);
    return response.json();
  }
}

function ownerHmac(tokenHmacKey, value, purpose) {
  const rootKey = createHash("sha256").update(`owner-hmac-root\0${tokenHmacKey}`, "utf8").digest();
  const purposeKey = createHmac("sha256", rootKey).update(`owner-${purpose}`, "utf8").digest();
  return createHmac("sha256", purposeKey).update(value, "utf8").digest("hex");
}

function randomPassword() {
  return `Tt!${randomBytes(24).toString("base64url")}9a`;
}

async function createActor(api, runToken, role) {
  const email = `taptolk-e2e-${role.toLowerCase()}-${runToken}@example.com`;
  const id = await api.createUser(email, randomPassword());
  return { id, role };
}

function normalizeBaseUrl(value) {
  if (!value) {
    throw new Error("Pass --base-url=https://... or set TAPTOLK_DEMO_BASE_URL.");
  }
  const url = new URL(value);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function copyToClipboard(value) {
  const result = spawnSync("pbcopy", { input: value, stdio: ["pipe", "ignore", "ignore"] });
  if (result.status !== 0) {
    throw new Error("Could not copy the demo URL to the macOS clipboard.");
  }
}

function openUrl(value) {
  spawnSync("open", [value], { stdio: "ignore" });
}

async function readState() {
  return JSON.parse(await readFile(statePath, "utf8"));
}

async function writeState(state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(`${statePath}.tmp`, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await unlink(`${statePath}.tmp`).catch(() => undefined);
}

async function cleanupState(api, state) {
  let cleanupError = null;
  for (const fixture of state.ownerFixtures ?? []) {
    try {
      await api.rpc("cleanup_owner_activation_staging_fixture", {
        p_public_token_hash: fixture.publicTokenHash,
        p_tenant_id: fixture.tenantId,
      });
    } catch (error) {
      cleanupError ??= error;
    }
  }
  try {
    await api.rpc("cleanup_staging_e2e_fixture", {
      p_actor_ids: state.actorIds ?? [],
      p_tenant_ids: state.tenantIds ?? [],
    });
  } catch (error) {
    cleanupError ??= error;
  }
  await Promise.allSettled((state.actorIds ?? []).map((userId) => api.deleteUser(userId)));
  if (cleanupError) {
    throw cleanupError;
  }
}

async function prepare(options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  if (!["ko", "en"].includes(options.locale)) {
    throw new Error("--locale must be ko or en.");
  }
  const environment = await loadEnvironment(options.envFile);
  const api = new StagingApi(environment.supabaseUrl, environment.secretKey);
  const runToken = randomBytes(6).toString("hex");
  const runLabel = `Taptolk E2E ${runToken}`;
  const tenantId = randomUUID();
  const companyId = randomUUID();
  const siteId = randomUUID();
  const state = {
    actorIds: [],
    baseUrl,
    createdAt: new Date().toISOString(),
    envFile: environment.envFile,
    linkedProjectRef: environment.linkedRef,
    ownerFixtures: [],
    schemaVersion: 1,
    tenantIds: [tenantId],
  };

  try {
    await api.insert("tenants", [
      { id: tenantId, name: `${runLabel} Tenant A`, slug: `e2e-${runToken}-demo` },
    ]);
    await api.insert("management_companies", [
      { id: companyId, name: `${runLabel} Company A`, tenant_id: tenantId },
    ]);
    await api.insert("sites", [
      {
        address: `${runLabel} demo address`,
        id: siteId,
        management_company_id: companyId,
        name: `${runLabel} Demo Site`,
        tenant_id: tenantId,
      },
    ]);

    const superAdmin = await createActor(api, runToken, "SUPER_ADMIN");
    state.actorIds.push(superAdmin.id);
    const siteAdmin = await createActor(api, runToken, "SITE_ADMIN");
    state.actorIds.push(siteAdmin.id);

    await api.insert(
      "admin_profiles",
      [superAdmin, siteAdmin].map((actor) => ({
        display_name: `${runLabel} ${actor.role}`,
        status: "ACTIVE",
        user_id: actor.id,
      })),
    );
    await api.insert("admin_memberships", [
      {
        accepted_at: new Date().toISOString(),
        id: randomUUID(),
        management_company_id: null,
        role: "SUPER_ADMIN",
        scope_type: "PLATFORM",
        site_id: null,
        status: "ACTIVE",
        tenant_id: null,
        user_id: superAdmin.id,
      },
      {
        accepted_at: new Date().toISOString(),
        id: randomUUID(),
        management_company_id: companyId,
        role: "SITE_ADMIN",
        scope_type: "SITE",
        site_id: siteId,
        status: "ACTIVE",
        tenant_id: tenantId,
        user_id: siteAdmin.id,
      },
    ]);

    const publicToken = randomBytes(32).toString("base64url");
    const publicTokenHash = ownerHmac(environment.tokenHmacKey, publicToken, "public-token");
    const activationCode = `ABCD${randomBytes(4).toString("hex").toUpperCase()}`;
    await api.rpc("provision_owner_activation_staging_fixture", {
      p_activation_code_hash: ownerHmac(
        environment.tokenHmacKey,
        activationCode,
        "activation-code",
      ),
      p_approver_id: superAdmin.id,
      p_fixture_label: `OA-${randomBytes(6).toString("hex").toUpperCase()}`,
      p_management_company_id: companyId,
      p_public_token_hash: publicTokenHash,
      p_requester_id: siteAdmin.id,
      p_site_id: siteId,
      p_tenant_id: tenantId,
    });
    state.ownerFixtures.push({ publicTokenHash, tenantId });

    await writeState(state);
    const demoUrl = `${baseUrl}/${options.locale}/activate/${encodeURIComponent(publicToken)}`;
    copyToClipboard(demoUrl);
    if (options.open) {
      openUrl(demoUrl);
    }

    console.log("[owner-demo] activation URL copied to clipboard.");
    console.log("[owner-demo] the URL contains QR token material; do not paste it into chat/logs.");
    console.log("[owner-demo] state saved at .taptolk-demo/owner-activation-state.json.");
    console.log(
      `[owner-demo] local OWNER_STAGING_MOCK_OTP ${environment.hasLocalMockOtp ? "is present" : "is missing"}; the target deployment must use the same mock OTP.`,
    );
    console.log("[owner-demo] cleanup command: corepack pnpm demo:owner:cleanup");
  } catch (error) {
    if (state.tenantIds.length > 0) {
      await cleanupState(api, state).catch(() => undefined);
    }
    throw error;
  }
}

async function cleanup() {
  const state = await readState();
  const environment = await loadEnvironment(state.envFile ?? defaultEnvPath);
  const api = new StagingApi(environment.supabaseUrl, environment.secretKey);
  if (state.schemaVersion !== 1) {
    throw new Error("Unsupported owner demo fixture state.");
  }
  await cleanupState(api, state);
  await unlink(statePath).catch(() => undefined);
  console.log("[owner-demo] demo fixture cleaned up.");
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "prepare") {
    await prepare(options);
    return;
  }
  if (command === "cleanup") {
    await cleanup();
    return;
  }
  throw new Error(
    "Usage: owner-demo-fixture.mjs prepare --base-url=https://... [--env-file=.taptolk-demo/vercel-preview.env] [--open] | cleanup",
  );
}

main().catch((error) => {
  console.error(`[owner-demo] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
