/**
 * Synthetic console demo seed (S10).
 *
 * The approval queue and the production tracking board cannot be designed against
 * an empty console, and the Taptolk E2E fixtures are ephemeral and must stay
 * untouched. This seed owns a fixed synthetic id range under the Taptolk tenant so
 * it can be re-run without duplicating anything and without colliding with the
 * fixtures, which live in their own `e2e-*` tenants.
 *
 * Channels this script uses and why:
 * - SQL through the Supabase CLI, because `service_role` holds no INSERT grant on
 *   `qr_batches`, `qr_batch_samples` or `sticker_design_versions` (they are written
 *   through security-definer RPCs that require an authenticated actor).
 * - the GoTrue admin API for the three demo actors, so Auth stays the owner of its
 *   own schema instead of this script writing `auth.users` by hand.
 * - the Storage API for the sample artefacts, because the sample route verifies the
 *   stored bytes against the recorded checksum and byte size before rendering.
 *
 * Nothing synthetic here is derived from real data: no phone number, no vehicle
 * plate, no QR token, no activation code. The sample artefacts are rendered by the
 * real sticker renderer from a synthetic demo URL, so the recorded QA evidence is
 * measured rather than asserted.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const environmentFile = path.join(root, "apps/web/.env.local");
const linkedProjectFile = path.join(root, "supabase/.temp/project-ref");
const logoFile = path.join(root, "design_concept/taptolk로고.png");
const renderModule = path.join(root, "packages/qr-engine/dist/render.js");
const sampleBucket = "qr-artifacts";

/** Fixed synthetic id range. Every row this script owns starts with this prefix. */
const DEMO_ID_PREFIX = "7a9704b1-0d00-4000-8000-";
const demoId = (suffix) => `${DEMO_ID_PREFIX}${suffix.padStart(12, "0")}`;

const DEMO_ACTORS = [
  { email: "demo-requester@demo.taptolk.example", key: "requester" },
  { email: "demo-sample-approver@demo.taptolk.example", key: "sampleApprover" },
  { email: "demo-generation-approver@demo.taptolk.example", key: "generationApprover" },
];

const DEMO_SITES = [
  {
    address: "서울특별시 데모구 데모대로 11",
    id: demoId("101"),
    name: "[데모] 한빛마을 1단지",
    template: "ROUND_PURPLE_GRADIENT_V1",
    type: "APARTMENT",
    vehicleLimit: 320,
  },
  {
    address: "서울특별시 데모구 데모대로 22",
    id: demoId("102"),
    name: "[데모] 라온오피스텔",
    template: "ROUND_WHITE_MINIMAL_V1",
    type: "OFFICETEL",
    vehicleLimit: 180,
  },
  {
    address: "서울특별시 데모구 데모대로 33",
    id: demoId("103"),
    name: "[데모] 세종빌딩",
    template: "SQUARE_DARK_PREMIUM_V1",
    type: "BUILDING",
    vehicleLimit: 90,
  },
  {
    address: "서울특별시 데모구 데모대로 44",
    id: demoId("104"),
    name: "[데모] 도담근린생활시설",
    template: "ROUND_BLUE_HOLOGRAM_V1",
    type: "OTHER",
    vehicleLimit: 40,
  },
];

/**
 * One batch per status the console has to show. Counters stay inside the schema
 * contract (`generated <= requested`, `passed + failed <= requested`) and inside the
 * QR `1..100` per-batch contract.
 */
const DEMO_BATCHES = [
  {
    ageDays: 2,
    code: "DEMO0000SMPL",
    counters: { failed: 0, generated: 0, passed: 0, rendered: 0 },
    id: demoId("201"),
    purpose: "데모 · 신규 입주 세대 1차 배포",
    quantity: 100,
    sample: "READY",
    siteIndex: 0,
    status: "SAMPLE_READY",
  },
  {
    ageDays: 4,
    code: "DEMO0000FINL",
    counters: { failed: 0, generated: 0, passed: 0, rendered: 0 },
    id: demoId("202"),
    purpose: "데모 · 방문 차량 대응 추가 발주",
    quantity: 100,
    sample: "APPROVED",
    siteIndex: 0,
    status: "FINAL_APPROVAL_PENDING",
  },
  {
    ageDays: 6,
    code: "DEMO0000GENR",
    counters: { failed: 0, generated: 34, passed: 0, rendered: 34 },
    id: demoId("203"),
    purpose: "데모 · 상가 입주사 차량 등록분",
    quantity: 80,
    sample: "APPROVED",
    siteIndex: 1,
    status: "GENERATING",
  },
  {
    ageDays: 9,
    code: "DEMO0000PART",
    counters: { failed: 6, generated: 60, passed: 54, rendered: 60 },
    id: demoId("204"),
    purpose: "데모 · 지하 2층 정기 주차 재발급",
    quantity: 60,
    sample: "APPROVED",
    siteIndex: 1,
    status: "PARTIALLY_COMPLETED",
  },
  {
    ageDays: 12,
    code: "DEMO0000PRNT",
    counters: { failed: 0, generated: 100, passed: 100, rendered: 100 },
    id: demoId("205"),
    purpose: "데모 · 임차인 교체분 인쇄 의뢰",
    quantity: 100,
    sample: "APPROVED",
    siteIndex: 2,
    status: "SENT_TO_PRINTER",
  },
  {
    ageDays: 16,
    code: "DEMO0000SHIP",
    counters: { failed: 0, generated: 100, passed: 100, rendered: 100 },
    id: demoId("206"),
    purpose: "데모 · 사무동 전 세대 교체분",
    quantity: 100,
    sample: "APPROVED",
    siteIndex: 2,
    status: "SHIPPED",
  },
  {
    ageDays: 21,
    code: "DEMO0000DELV",
    counters: { failed: 0, generated: 40, passed: 40, rendered: 40 },
    id: demoId("207"),
    purpose: "데모 · 근린생활시설 초도 물량",
    quantity: 40,
    sample: "APPROVED",
    siteIndex: 3,
    status: "DELIVERED",
  },
  {
    ageDays: 27,
    code: "DEMO0000DIST",
    counters: { failed: 0, generated: 100, passed: 100, rendered: 100 },
    id: demoId("208"),
    purpose: "데모 · 관리사무소 현장 배부 진행분",
    quantity: 100,
    sample: "APPROVED",
    siteIndex: 3,
    status: "DISTRIBUTING",
  },
];

/** Statuses whose check constraint requires a recorded sample approval. */
const SAMPLE_APPROVED_STATUSES = new Set([
  "SAMPLE_APPROVED",
  "FINAL_APPROVAL_PENDING",
  "GENERATION_APPROVED",
  "GENERATION_QUEUED",
  "GENERATING",
  "GENERATED",
  "QUALITY_CHECKED",
  "PRINT_FILE_READY",
  "SENT_TO_PRINTER",
  "PRINTED",
  "SHIPPED",
  "DELIVERED",
  "DISTRIBUTING",
  "COMPLETED",
  "FAILED",
  "PARTIALLY_COMPLETED",
]);

/** Statuses whose check constraint requires a recorded generation approval. */
const GENERATION_APPROVED_STATUSES = new Set([
  "GENERATION_APPROVED",
  "GENERATION_QUEUED",
  "GENERATING",
  "GENERATED",
  "QUALITY_CHECKED",
  "PRINT_FILE_READY",
  "SENT_TO_PRINTER",
  "PRINTED",
  "SHIPPED",
  "DELIVERED",
  "DISTRIBUTING",
  "COMPLETED",
  "FAILED",
  "PARTIALLY_COMPLETED",
]);

function fail(message) {
  throw new Error(message);
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
    values[key] = value;
  }
  return values;
}

/**
 * The stage policy is the same fail-closed contract the server uses: only an
 * explicit DEVELOPMENT_TEST stage may seed. SERVICE, an unknown value and a missing
 * value all refuse.
 */
function requireDevelopmentTestStage() {
  const stage = process.env.TAPTOLK_STAGE?.trim();
  if (stage === "DEVELOPMENT_TEST") {
    return;
  }
  if (stage === "SERVICE") {
    fail("the demo seed is unavailable in the SERVICE stage.");
  }
  fail(
    "the demo seed requires an explicit TAPTOLK_STAGE=DEVELOPMENT_TEST; it fails closed otherwise.",
  );
}

function loadEnvironment() {
  let fileValues = {};
  try {
    fileValues = parseEnvironmentFile(readFileSync(environmentFile, "utf8"));
  } catch {
    // The environment may be supplied by the caller instead of the local file.
  }
  for (const [key, value] of Object.entries(fileValues)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    fail("the demo seed requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
  if (process.env.APP_ENV === "production") {
    fail("the demo seed refuses a production application environment.");
  }

  const linkedProjectRef = readFileSync(linkedProjectFile, "utf8").trim();
  const hostname = new URL(supabaseUrl).hostname;
  if (!linkedProjectRef || hostname !== `${linkedProjectRef}.supabase.co`) {
    fail("the demo seed refuses a Supabase project that is not the linked project.");
  }
  return { linkedProjectRef, secretKey, supabaseUrl };
}

function runSql(source, label) {
  const temporaryFile = path.join(temporaryDirectory, `${label}.sql`);
  writeFileSync(temporaryFile, source, "utf8");
  const execution = spawnSync(
    "corepack",
    ["pnpm", "exec", "supabase", "db", "query", "--linked", "--file", temporaryFile],
    { cwd: root, encoding: "utf8", env: process.env, maxBuffer: 20 * 1024 * 1024 },
  );
  if (execution.status !== 0) {
    fail(`${label} failed.\n${execution.stderr || execution.stdout}`);
  }
  const output = execution.stdout;
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) {
    fail(`${label} returned no result.`);
  }
  const parsed = JSON.parse(output.slice(start, end + 1));
  return Array.isArray(parsed.rows) ? parsed.rows : [];
}

function quote(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

class AuthAdminApi {
  constructor(supabaseUrl, secretKey) {
    this.supabaseUrl = supabaseUrl;
    this.secretKey = secretKey;
  }

  headers() {
    return {
      apikey: this.secretKey,
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
    };
  }

  async createUser(email) {
    const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users`, {
      body: JSON.stringify({
        email,
        // Never printed, never stored: the demo actors exist to satisfy the batch
        // actor foreign keys, not to be signed in to.
        password: `Tt!${randomBytes(24).toString("base64url")}9a`,
        user_metadata: { purpose: "taptolk-console-demo-seed" },
      }),
      headers: this.headers(),
      method: "POST",
    });
    if (!response.ok) {
      fail(`Create demo Auth actor failed with HTTP ${response.status}.`);
    }
    const body = await response.json();
    if (typeof body.id !== "string") {
      fail("Create demo Auth actor returned no user id.");
    }
    return body.id;
  }

  async upload(bucket, objectPath, bytes, contentType) {
    const response = await fetch(`${this.supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
      body: bytes,
      headers: {
        apikey: this.secretKey,
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      method: "POST",
    });
    if (!response.ok) {
      fail(`Upload demo sample artefact failed with HTTP ${response.status}.`);
    }
  }
}

let environment;
let api;
let temporaryDirectory = "";

try {
  requireDevelopmentTestStage();
  environment = loadEnvironment();
  api = new AuthAdminApi(environment.supabaseUrl, environment.secretKey);
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "taptolk-seed-demo-"));

  const scopeRows = runSql(
    `select
       (select id::text from public.tenants where slug = 'taptolk' and deleted_at is null) as tenant_id,
       (select company.id::text
          from public.management_companies as company
          join public.tenants as tenant on tenant.id = company.tenant_id
         where tenant.slug = 'taptolk' and company.is_platform_direct and company.deleted_at is null
       ) as management_company_id;`,
    "scope",
  );
  const tenantId = scopeRows[0]?.tenant_id;
  const managementCompanyId = scopeRows[0]?.management_company_id;
  if (!tenantId || !managementCompanyId) {
    fail(
      "the Taptolk tenant and its platform-direct management company are missing; apply 20260723120000_taptolk_platform_direct_management.sql first.",
    );
  }

  const actorRows = runSql(
    `select email, id::text as id from auth.users
      where email in (${DEMO_ACTORS.map((actor) => quote(actor.email)).join(", ")});`,
    "actors",
  );
  const actorIdByEmail = new Map(actorRows.map((row) => [row.email, row.id]));
  const actors = {};
  let createdActors = 0;
  for (const actor of DEMO_ACTORS) {
    let userId = actorIdByEmail.get(actor.email);
    if (!userId) {
      userId = await api.createUser(actor.email);
      createdActors += 1;
    }
    actors[actor.key] = userId;
  }

  const { renderSticker, decodeQrFromImage } = await import(renderModule);
  const taptolkLogoDataUri = `data:image/png;base64,${(await readFile(logoFile)).toString("base64")}`;

  const samples = [];
  const renderFailures = [];
  for (const [batchIndex, batch] of DEMO_BATCHES.entries()) {
    const site = DEMO_SITES[batch.siteIndex];
    const publicUrl = `https://demo.taptolk.example/s/${batch.code}`;
    let rendered;
    try {
      rendered = await renderSticker({
        publicUrl,
        taptolkLogoDataUri,
        templateCode: site.template,
      });
    } catch (error) {
      // The renderer verifies its own output and refuses a sticker it cannot read
      // back. A batch that cannot produce a verified sample is left without one
      // rather than being given an invented artefact.
      renderFailures.push({
        code: batch.code,
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    const decoded = await decodeQrFromImage(rendered.png);
    const bytes = Buffer.from(rendered.png);
    const storagePath = `demo/${batch.code}/sample.png`;
    await api.upload(sampleBucket, storagePath, bytes, "image/png");
    samples.push({
      batch,
      batchIndex,
      byteSize: bytes.byteLength,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      decodePassed: decoded === publicUrl,
      storagePath,
    });
  }

  const designStatements = DEMO_SITES.map((site, index) => {
    const designId = demoId(String(300 + index + 1));
    return `insert into public.sticker_design_versions (
  id, tenant_id, management_company_id, site_id, template_code, design_config, status,
  created_by, approved_by, approved_at, created_at, updated_at
)
select ${quote(designId)}::uuid, ${quote(tenantId)}::uuid, ${quote(managementCompanyId)}::uuid,
       ${quote(site.id)}::uuid, ${quote(site.template)},
       '{"zones": {"qr": "CENTER_WHITE_PLATE", "taptolkLogo": "IMMUTABLE_BOTTOM", "customerLogo": "OPTIONAL_TOP"}, "qrOptions": {"marginModules": 4, "errorCorrectionLevel": "H"}, "brandAssetId": null, "schemaVersion": 1}'::jsonb,
       'APPROVED', ${quote(actors.requester)}::uuid, ${quote(actors.sampleApprover)}::uuid,
       now() - interval '40 days', now() - interval '40 days', now() - interval '40 days'
where not exists (select 1 from public.sticker_design_versions where id = ${quote(designId)}::uuid);`;
  });

  const batchStatements = DEMO_BATCHES.map((batch, index) => {
    const site = DEMO_SITES[batch.siteIndex];
    const designId = demoId(String(300 + batch.siteIndex + 1));
    const sampleApproved = SAMPLE_APPROVED_STATUSES.has(batch.status);
    const generationApproved = GENERATION_APPROVED_STATUSES.has(batch.status);
    const sampleApprovedAt = sampleApproved
      ? `now() - interval '${batch.ageDays - 1} days'`
      : "null";
    const generationApprovedAt = generationApproved
      ? `now() - interval '${Math.max(batch.ageDays - 2, 1)} days'`
      : "null";
    return `insert into public.qr_batches (
  id, tenant_id, management_company_id, site_id, batch_code, sticker_design_version_id,
  requested_quantity, generated_quantity, rendered_quantity, passed_quantity, failed_quantity,
  purpose, status, requested_by, sample_approved_by, sample_approved_at,
  generation_approved_by, generation_approved_at, idempotency_key, created_at, updated_at
)
select ${quote(batch.id)}::uuid, ${quote(tenantId)}::uuid, ${quote(managementCompanyId)}::uuid,
       ${quote(site.id)}::uuid, ${quote(batch.code)}, ${quote(designId)}::uuid,
       ${batch.quantity}, ${batch.counters.generated}, ${batch.counters.rendered},
       ${batch.counters.passed}, ${batch.counters.failed},
       ${quote(batch.purpose)}, ${quote(batch.status)}, ${quote(actors.requester)}::uuid,
       ${sampleApproved ? `${quote(actors.sampleApprover)}::uuid` : "null"}, ${sampleApprovedAt},
       ${generationApproved ? `${quote(actors.generationApprover)}::uuid` : "null"}, ${generationApprovedAt},
       ${quote(demoId(String(400 + index + 1)))}::uuid,
       now() - interval '${batch.ageDays} days', now() - interval '${batch.ageDays} days'
where not exists (select 1 from public.qr_batches where id = ${quote(batch.id)}::uuid);`;
  });

  const sampleStatements = samples.map((sample) => {
    const batch = sample.batch;
    const site = DEMO_SITES[batch.siteIndex];
    // Derived from the batch position, not the sample position, so a batch whose
    // render was refused does not shift the ids of the samples that follow it.
    const sampleId = demoId(String(500 + sample.batchIndex + 1));
    const approved = batch.sample === "APPROVED";
    return `insert into public.qr_batch_samples (
  id, tenant_id, management_company_id, site_id, batch_id, status,
  storage_bucket, storage_path, checksum_sha256, mime_type, byte_size,
  decode_passed, quiet_zone_passed, contrast_passed, attached_by,
  approved_by, approved_at, created_at, updated_at
)
select ${quote(sampleId)}::uuid, ${quote(tenantId)}::uuid, ${quote(managementCompanyId)}::uuid,
       ${quote(site.id)}::uuid, ${quote(batch.id)}::uuid, ${approved ? "'APPROVED'" : "'READY'"},
       ${quote(sampleBucket)}, ${quote(sample.storagePath)}, ${quote(sample.checksum)},
       'image/png', ${sample.byteSize},
       ${sample.decodePassed}, true, true, ${quote(actors.requester)}::uuid,
       ${approved ? `${quote(actors.sampleApprover)}::uuid` : "null"},
       ${approved ? `now() - interval '${batch.ageDays - 1} days'` : "null"},
       now() - interval '${batch.ageDays} days', now() - interval '${batch.ageDays} days'
where not exists (select 1 from public.qr_batch_samples where id = ${quote(sampleId)}::uuid)
  and exists (select 1 from public.qr_batches where id = ${quote(batch.id)}::uuid);`;
  });

  const siteStatements = DEMO_SITES.map(
    (site) => `insert into public.sites (
  id, tenant_id, management_company_id, name, site_type, address, timezone,
  contract_vehicle_limit, status, settings
)
select ${quote(site.id)}::uuid, ${quote(tenantId)}::uuid, ${quote(managementCompanyId)}::uuid,
       ${quote(site.name)}, ${quote(site.type)}, ${quote(site.address)}, 'Asia/Seoul',
       ${site.vehicleLimit}, 'ACTIVE', '{"demoSeed": true}'::jsonb
where not exists (select 1 from public.sites where id = ${quote(site.id)}::uuid);`,
  );

  runSql(
    [
      "begin;",
      ...siteStatements,
      ...designStatements,
      ...batchStatements,
      ...sampleStatements,
      "commit;",
      `select status::text as status, count(*)::int as total
         from public.qr_batches
        where id::text like ${quote(`${DEMO_ID_PREFIX}%`)}
        group by status
        order by status;`,
    ].join("\n\n"),
    "seed",
  );

  const summary = runSql(
    `select 'sites' as entity, count(*)::int as total from public.sites where id::text like ${quote(`${DEMO_ID_PREFIX}%`)}
     union all
     select 'designs', count(*)::int from public.sticker_design_versions where id::text like ${quote(`${DEMO_ID_PREFIX}%`)}
     union all
     select 'batches', count(*)::int from public.qr_batches where id::text like ${quote(`${DEMO_ID_PREFIX}%`)}
     union all
     select 'samples', count(*)::int from public.qr_batch_samples where id::text like ${quote(`${DEMO_ID_PREFIX}%`)}
     order by entity;`,
    "summary",
  );

  const statuses = runSql(
    `select status::text as status, count(*)::int as total
       from public.qr_batches
      where id::text like ${quote(`${DEMO_ID_PREFIX}%`)}
      group by status
      order by status;`,
    "statuses",
  );

  console.log(`[seed-demo] project ${environment.linkedProjectRef}`);
  console.log(`[seed-demo] demo Auth actors created this run: ${createdActors}`);
  for (const row of summary) {
    console.log(`[seed-demo] ${row.entity}: ${row.total}`);
  }
  for (const row of statuses) {
    console.log(`[seed-demo] batch ${row.status}: ${row.total}`);
  }
  const undecodedSamples = samples.filter((sample) => !sample.decodePassed).length;
  if (undecodedSamples > 0) {
    console.log(
      `[seed-demo] ${undecodedSamples} sample(s) recorded decode_passed=false from the measured decode.`,
    );
  }
  for (const failure of renderFailures) {
    console.log(
      `[seed-demo] batch ${failure.code} has no sample: render refused (${failure.reason}).`,
    );
  }
} catch (error) {
  console.error(`[seed-demo] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}
