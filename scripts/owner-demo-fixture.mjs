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
const qrSheetPath = path.join(root, ".taptolk-demo/owner-demo-qr-sheet.html");
const notificationInboxPath = path.join(root, ".taptolk-demo/owner-demo-notification-inbox.html");

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    baseUrl: process.env.TAPTOLK_DEMO_BASE_URL ?? "",
    count: Number.parseInt(process.env.TAPTOLK_DEMO_COUNT ?? "10", 10),
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
    } else if (argument.startsWith("--count=")) {
      options.count = Number.parseInt(argument.slice("--count=".length), 10);
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
    queueWorkerSecret: environment.QUEUE_WORKER_SECRET,
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

function assertDemoCount(value) {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error("--count must be an integer from 1 to 10.");
  }
}

function padDemoIndex(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function renderQrSheet({ baseUrl, createdAt, items }) {
  const qrCode = await import("../packages/qr-engine/node_modules/qrcode/lib/server.js");
  const cards = await Promise.all(
    items.map(async (item) => {
      const imageDataUrl = await qrCode.toDataURL(item.scanUrl, {
        color: {
          dark: "#111111",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
        margin: 3,
        scale: 8,
      });
      return `<article class="card">
  <img alt="${escapeHtml(item.label)} QR" src="${imageDataUrl}">
  <h2>${escapeHtml(item.label)}</h2>
  <p>${escapeHtml(item.siteName)}</p>
  <p>${escapeHtml(item.address)}</p>
</article>`;
    }),
  );
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Taptolk Owner Demo QR Sheet</title>
  <style>
    :root {
      color: #151515;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      background: #f5f5f1;
    }
    main {
      box-sizing: border-box;
      margin: 0 auto;
      max-width: 1120px;
      padding: 32px;
    }
    header {
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 8px;
    }
    .meta {
      color: #66645f;
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
    }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    }
    .card {
      background: #ffffff;
      border: 1px solid #dedbd2;
      border-radius: 8px;
      break-inside: avoid;
      padding: 16px;
    }
    img {
      aspect-ratio: 1;
      display: block;
      height: auto;
      width: 100%;
    }
    h2 {
      font-size: 15px;
      margin: 12px 0 6px;
    }
    p {
      color: #55524c;
      font-size: 12px;
      line-height: 1.45;
      margin: 0 0 4px;
    }
    @media print {
      body {
        background: #ffffff;
      }
      main {
        max-width: none;
        padding: 12mm;
      }
      .grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Taptolk Owner Demo QR Sheet</h1>
      <p class="meta">데모용 fixture입니다. QR에는 토큰 정보가 들어 있으므로 실서비스 자료로 배포하지 마세요.</p>
      <p class="meta">Base URL: ${escapeHtml(baseUrl)} · Created: ${escapeHtml(createdAt)}</p>
    </header>
    <section class="grid">
      ${cards.join("\n      ")}
    </section>
  </main>
</body>
</html>
`;
  await mkdir(path.dirname(qrSheetPath), { recursive: true });
  await writeFile(qrSheetPath, html, "utf8");
}

async function renderNotificationInbox({ baseUrl, createdAt, items, locale }) {
  const qrCode = await import("../packages/qr-engine/node_modules/qrcode/lib/server.js");
  const cards = await Promise.all(
    items.map(async (item, index) => {
      const notificationUrl = `${baseUrl}/${locale}/respond/${encodeURIComponent(
        item.responseToken,
      )}`;
      const imageDataUrl = await qrCode.toDataURL(notificationUrl, {
        color: {
          dark: "#111111",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
        margin: 3,
        scale: 8,
      });
      return `<article class="card">
  <img alt="Owner notification ${index + 1} QR" src="${imageDataUrl}">
  <h2>Owner Notification ${padDemoIndex(index + 1)}</h2>
  <a href="${escapeHtml(notificationUrl)}" rel="noreferrer">Open owner response</a>
</article>`;
    }),
  );
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Taptolk Owner Demo Notification Inbox</title>
  <style>
    :root {
      color: #151515;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      background: #f5f5f1;
    }
    main {
      box-sizing: border-box;
      margin: 0 auto;
      max-width: 960px;
      padding: 32px;
    }
    header {
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 8px;
    }
    .meta {
      color: #66645f;
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
    }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    }
    .card {
      background: #ffffff;
      border: 1px solid #dedbd2;
      border-radius: 8px;
      break-inside: avoid;
      padding: 16px;
    }
    img {
      aspect-ratio: 1;
      display: block;
      height: auto;
      width: 100%;
    }
    h2 {
      font-size: 15px;
      margin: 12px 0 8px;
    }
    a {
      color: #0f4d46;
      display: inline-block;
      font-size: 13px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Taptolk Owner Demo Notification Inbox</h1>
      <p class="meta">카카오 알림톡 대신 사용하는 데모용 알림함입니다. 링크에는 응답 토큰이 들어 있으므로 실서비스 자료로 배포하지 마세요.</p>
      <p class="meta">Base URL: ${escapeHtml(baseUrl)} · Created: ${escapeHtml(createdAt)}</p>
    </header>
    <section class="grid">
      ${cards.join("\n      ")}
    </section>
  </main>
</body>
</html>
`;
  await mkdir(path.dirname(notificationInboxPath), { recursive: true });
  await writeFile(notificationInboxPath, html, "utf8");
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
  for (const contract of state.contractFixtures ?? []) {
    try {
      await api.rpc("cleanup_public_contact_contract_staging_fixture", {
        p_contract_id: contract.contractId,
        p_tenant_id: contract.tenantId,
      });
    } catch (error) {
      cleanupError ??= error;
    }
  }
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
  await unlink(qrSheetPath).catch(() => undefined);
  await unlink(notificationInboxPath).catch(() => undefined);
  if (cleanupError) {
    throw cleanupError;
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  let body = {};
  try {
    body = await response.json();
  } catch {
    // Keep response details out of logs; caller only needs the status boundary.
  }
  if (!response.ok) {
    const code = body?.error?.code ?? "UNKNOWN";
    throw new Error(`Request failed with HTTP ${response.status} (${code}).`);
  }
  return body;
}

async function prepare(options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  assertDemoCount(options.count);
  if (!["ko", "en"].includes(options.locale)) {
    throw new Error("--locale must be ko or en.");
  }
  const environment = await loadEnvironment(options.envFile);
  const api = new StagingApi(environment.supabaseUrl, environment.secretKey);
  const runToken = randomBytes(6).toString("hex");
  const runLabel = `Taptolk E2E ${runToken}`;
  const tenantId = randomUUID();
  const companyId = randomUUID();
  const siteIds = Array.from({ length: options.count }, () => randomUUID());
  const state = {
    actorIds: [],
    baseUrl,
    createdAt: new Date().toISOString(),
    envFile: environment.envFile,
    linkedProjectRef: environment.linkedRef,
    locale: options.locale,
    contractFixtures: [],
    ownerFixtures: [],
    qrSheetPath: path.relative(root, qrSheetPath),
    schemaVersion: 2,
    tenantIds: [tenantId],
  };
  const qrSheetItems = [];

  try {
    await api.insert("tenants", [
      { id: tenantId, name: `${runLabel} Tenant A`, slug: `e2e-${runToken}-demo` },
    ]);
    await api.insert("management_companies", [
      { id: companyId, name: `${runLabel} Company A`, tenant_id: tenantId },
    ]);
    await api.insert(
      "sites",
      siteIds.map((siteId, index) => {
        const demoNumber = padDemoIndex(index + 1);
        return {
          address: `서울시 테스트구 탭톡로 ${100 + index}, 데모동 ${demoNumber}`,
          id: siteId,
          management_company_id: companyId,
          name: `${runLabel} Demo Site ${demoNumber}`,
          tenant_id: tenantId,
        };
      }),
    );
    for (const [index, siteId] of siteIds.entries()) {
      const contractId = await api.rpc("provision_public_contact_contract_staging_fixture", {
        p_fixture_label: `PC-${randomBytes(6).toString("hex").toUpperCase()}${padDemoIndex(
          index + 1,
        )}`,
        p_management_company_id: companyId,
        p_site_id: siteId,
        p_tenant_id: tenantId,
      });
      state.contractFixtures.push({ contractId, tenantId });
    }

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
      ...siteIds.map((siteId) => ({
        accepted_at: new Date().toISOString(),
        id: randomUUID(),
        management_company_id: companyId,
        role: "SITE_ADMIN",
        scope_type: "SITE",
        site_id: siteId,
        status: "ACTIVE",
        tenant_id: tenantId,
        user_id: siteAdmin.id,
      })),
    ]);

    for (const [index, siteId] of siteIds.entries()) {
      const demoNumber = padDemoIndex(index + 1);
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
      state.ownerFixtures.push({
        label: `Demo QR ${demoNumber}`,
        publicTokenHash,
        tenantId,
      });
      qrSheetItems.push({
        address: `서울시 테스트구 탭톡로 ${100 + index}, 데모동 ${demoNumber}`,
        label: `Demo QR ${demoNumber}`,
        scanUrl: `${baseUrl}/${options.locale}/q/${encodeURIComponent(publicToken)}`,
        siteName: `${runLabel} Demo Site ${demoNumber}`,
      });
    }

    await writeState(state);
    await renderQrSheet({ baseUrl, createdAt: state.createdAt, items: qrSheetItems });
    copyToClipboard(qrSheetPath);
    if (options.open) {
      openUrl(qrSheetPath);
    }

    console.log("[owner-demo] QR sheet path copied to clipboard.");
    console.log(
      "[owner-demo] QR sheet contains token material; do not commit or paste it into chat/logs.",
    );
    console.log("[owner-demo] QR count:", options.count);
    console.log("[owner-demo] QR sheet saved at .taptolk-demo/owner-demo-qr-sheet.html.");
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
  if (![1, 2].includes(state.schemaVersion)) {
    throw new Error("Unsupported owner demo fixture state.");
  }
  await cleanupState(api, state);
  await unlink(statePath).catch(() => undefined);
  console.log("[owner-demo] demo fixture cleaned up.");
}

async function dispatch(options) {
  const state = await readState();
  const environment = await loadEnvironment(options.envFile ?? state.envFile ?? defaultEnvPath);
  const baseUrl = normalizeBaseUrl(options.baseUrl || state.baseUrl);
  const locale = state.locale ?? options.locale;
  if (!["ko", "en"].includes(locale)) {
    throw new Error("Demo fixture state has an unsupported locale.");
  }
  if (!environment.queueWorkerSecret || environment.queueWorkerSecret.length < 16) {
    throw new Error("Owner demo dispatch requires QUEUE_WORKER_SECRET in the demo env file.");
  }
  const headers = {
    Authorization: `Bearer ${environment.queueWorkerSecret}`,
    "Content-Type": "application/json",
  };
  const dispatched = await requestJson(`${baseUrl}/api/internal/notification-dispatch`, {
    headers,
    method: "POST",
  });
  const inbox = await requestJson(`${baseUrl}/api/internal/notification-staging`, {
    headers,
    method: "GET",
  });
  const items = Array.isArray(inbox.data) ? inbox.data : [];
  await renderNotificationInbox({
    baseUrl,
    createdAt: new Date().toISOString(),
    items,
    locale,
  });
  copyToClipboard(notificationInboxPath);
  if (options.open) {
    openUrl(notificationInboxPath);
  }
  console.log("[owner-demo] notification dispatch requested.");
  console.log(
    "[owner-demo] dispatched result keys:",
    Object.keys(dispatched.data ?? {}).join(", "),
  );
  console.log("[owner-demo] inbox item count:", items.length);
  console.log(
    "[owner-demo] notification inbox contains response token material; do not commit or paste it into chat/logs.",
  );
  console.log("[owner-demo] inbox saved at .taptolk-demo/owner-demo-notification-inbox.html.");
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
  if (command === "dispatch") {
    await dispatch(options);
    return;
  }
  throw new Error(
    "Usage: owner-demo-fixture.mjs prepare --base-url=https://... [--count=10] [--env-file=.taptolk-demo/vercel-preview.env] [--open] | dispatch [--open] | cleanup",
  );
}

main().catch((error) => {
  console.error(`[owner-demo] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
