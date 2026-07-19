import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

type AdminRole = "MANAGEMENT_ADMIN" | "SITE_ADMIN" | "SUPER_ADMIN";

export interface StagingActor {
  email: string;
  id: string;
  password: string;
  role: AdminRole;
}

export interface StagingSite {
  address: string;
  id: string;
  managementCompanyId: string;
  name: string;
  tenantId: string;
}

export interface StagingFixture {
  actors: {
    managementAdmin: StagingActor;
    siteAdmin: StagingActor;
    superAdmin: StagingActor;
  };
  api: StagingServiceApi;
  cleanup(): Promise<void>;
  companyAId: string;
  companyBId: string;
  createdSiteIds: Set<string>;
  lifecycleSiteName: string;
  runLabel: string;
  sites: {
    companyAFirst: StagingSite;
    companyASecond: StagingSite;
    tenantB: StagingSite;
  };
  tenantAId: string;
  tenantBId: string;
}

interface Environment {
  secretKey: string;
  supabaseUrl: string;
}

interface PostgrestError {
  code?: string;
}

interface SiteRow {
  address: string | null;
  contract_vehicle_limit: number;
  id: string;
  name: string;
  status: "ACTIVE" | "CLOSED" | "SUSPENDED";
  version: number;
}

const ENV_FILE = path.join(process.cwd(), "apps/web/.env.local");
const LINKED_PROJECT_FILE = path.join(process.cwd(), "supabase/.temp/project-ref");
const SENSITIVE_AUDIT_KEY =
  /authorization|cookie|phone|message|otp|token|secret|password|api.?key/iu;

function parseEnvironmentFile(source: string): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
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

export function loadStagingEnvironment(): Environment {
  const fileValues = parseEnvironmentFile(readFileSync(ENV_FILE, "utf8"));
  for (const [key, value] of Object.entries(fileValues)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  const appEnvironment = process.env.APP_ENV;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (appEnvironment !== "staging" || !supabaseUrl || !secretKey) {
    throw new Error("Staging Site E2E requires the server-only staging environment.");
  }

  const linkedProjectRef = readFileSync(LINKED_PROJECT_FILE, "utf8").trim();
  const hostname = new URL(supabaseUrl).hostname;
  if (!linkedProjectRef || hostname !== `${linkedProjectRef}.supabase.co`) {
    throw new Error(
      "Staging Site E2E refused a Supabase project that is not the linked staging project.",
    );
  }

  return { secretKey, supabaseUrl };
}

function randomPassword(): string {
  return `Tt!${randomBytes(24).toString("base64url")}9a`;
}

function base32Decode(secret: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = secret.toUpperCase().replaceAll(/[^A-Z2-7]/gu, "");
  let bits = "";
  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value < 0) {
      throw new Error("The MFA enrollment returned an invalid TOTP secret.");
    }
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export async function currentTotp(secret: string): Promise<string> {
  const currentSeconds = Math.floor(Date.now() / 1_000);
  const remainingSeconds = 30 - (currentSeconds % 30);
  if (remainingSeconds < 3) {
    await new Promise((resolve) => setTimeout(resolve, (remainingSeconds + 1) * 1_000));
  }

  const counter = Math.floor(Date.now() / 1_000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function postgrestFilter(column: string, values: readonly string[]): string {
  return `${column}=in.(${values.join(",")})`;
}

export class StagingServiceApi {
  constructor(
    private readonly supabaseUrl: string,
    private readonly secretKey: string,
  ) {}

  private headers(prefer?: string): HeadersInit {
    return {
      apikey: this.secretKey,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    };
  }

  private async assertResponse(response: Response, operation: string): Promise<void> {
    if (response.ok) {
      return;
    }
    let code = "UNKNOWN";
    try {
      code = ((await response.json()) as PostgrestError).code ?? code;
    } catch {
      // The status is sufficient and avoids echoing an upstream response body.
    }
    throw new Error(`${operation} failed with HTTP ${response.status} (${code}).`);
  }

  async createUser(email: string, password: string): Promise<string> {
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
    await this.assertResponse(response, "Create ephemeral Auth user");
    const body = (await response.json()) as { id?: unknown };
    if (typeof body.id !== "string") {
      throw new Error("Create ephemeral Auth user returned no user id.");
    }
    return body.id;
  }

  async deleteUser(userId: string): Promise<void> {
    const response = await fetch(
      `${this.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}?should_soft_delete=false`,
      {
        headers: this.headers(),
        method: "DELETE",
      },
    );
    if (response.status !== 404) {
      await this.assertResponse(response, "Delete ephemeral Auth user");
    }
  }

  async authUserExists(userId: string): Promise<boolean> {
    const response = await fetch(
      `${this.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        headers: this.headers(),
        method: "GET",
      },
    );
    if (response.status === 404) {
      return false;
    }
    await this.assertResponse(response, "Read ephemeral Auth user cleanup evidence");
    return true;
  }

  async insert(table: string, rows: readonly Record<string, unknown>[]): Promise<void> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
      body: JSON.stringify(rows),
      headers: this.headers("return=minimal"),
      method: "POST",
    });
    await this.assertResponse(response, `Insert ${table} fixture`);
  }

  async deleteWhere(table: string, filter: string): Promise<void> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}?${filter}`, {
      headers: this.headers("return=minimal"),
      method: "DELETE",
    });
    await this.assertResponse(response, `Delete ${table} fixture`);
  }

  async select<T>(table: string, query: string): Promise<T[]> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}?${query}`, {
      headers: this.headers(),
      method: "GET",
    });
    await this.assertResponse(response, `Select ${table} fixture evidence`);
    return (await response.json()) as T[];
  }

  async site(siteId: string): Promise<SiteRow> {
    const rows = await this.select<SiteRow>(
      "sites",
      `id=eq.${encodeURIComponent(siteId)}&select=id,name,address,contract_vehicle_limit,status,version`,
    );
    if (rows.length !== 1) {
      throw new Error("Expected one staging Site evidence row.");
    }
    return rows[0];
  }
}

async function createActor(
  api: StagingServiceApi,
  runToken: string,
  role: AdminRole,
): Promise<StagingActor> {
  const email = `taptolk-e2e-${role.toLowerCase()}-${runToken}@example.com`;
  const password = randomPassword();
  const id = await api.createUser(email, password);
  return { email, id, password, role };
}

export async function createStagingFixture(): Promise<StagingFixture> {
  const environment = loadStagingEnvironment();
  const api = new StagingServiceApi(environment.supabaseUrl, environment.secretKey);
  const runToken = randomBytes(6).toString("hex");
  const runLabel = `Taptolk E2E ${runToken}`;
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const companyAId = randomUUID();
  const companyBId = randomUUID();
  const companyAFirst: StagingSite = {
    address: `${runLabel} first address`,
    id: randomUUID(),
    managementCompanyId: companyAId,
    name: `${runLabel} Site A1`,
    tenantId: tenantAId,
  };
  const companyASecond: StagingSite = {
    address: `${runLabel} second address`,
    id: randomUUID(),
    managementCompanyId: companyAId,
    name: `${runLabel} Site A2`,
    tenantId: tenantAId,
  };
  const tenantB: StagingSite = {
    address: `${runLabel} foreign address`,
    id: randomUUID(),
    managementCompanyId: companyBId,
    name: `${runLabel} Site B1`,
    tenantId: tenantBId,
  };
  const createdSiteIds = new Set<string>();
  const createdActors: StagingActor[] = [];

  const cleanup = async () => {
    const allSiteIds = [companyAFirst.id, companyASecond.id, tenantB.id, ...createdSiteIds];
    const actorIds = createdActors.map(({ id }) => id);

    if (allSiteIds.length > 0) {
      await api.deleteWhere("qr_generation_jobs", postgrestFilter("site_id", allSiteIds));
      await api.deleteWhere("audit_logs", postgrestFilter("site_id", allSiteIds));
      await api.deleteWhere("qr_batch_samples", postgrestFilter("site_id", allSiteIds));
      await api.deleteWhere("qr_batches", postgrestFilter("site_id", allSiteIds));
      await api.deleteWhere("sticker_design_versions", postgrestFilter("site_id", allSiteIds));
      await api.deleteWhere("site_lifecycle_requests", postgrestFilter("site_id", allSiteIds));
    }
    if (actorIds.length > 0) {
      await api.deleteWhere("admin_memberships", postgrestFilter("user_id", actorIds));
    }
    if (allSiteIds.length > 0) {
      await api.deleteWhere("sites", postgrestFilter("id", allSiteIds));
    }
    await api.deleteWhere("management_companies", postgrestFilter("id", [companyAId, companyBId]));
    await api.deleteWhere("tenants", postgrestFilter("id", [tenantAId, tenantBId]));
    await Promise.allSettled(actorIds.map((userId) => api.deleteUser(userId)));
  };

  try {
    await api.insert("tenants", [
      { id: tenantAId, name: `${runLabel} Tenant A`, slug: `e2e-${runToken}-a` },
      { id: tenantBId, name: `${runLabel} Tenant B`, slug: `e2e-${runToken}-b` },
    ]);
    await api.insert("management_companies", [
      { id: companyAId, name: `${runLabel} Company A`, tenant_id: tenantAId },
      { id: companyBId, name: `${runLabel} Company B`, tenant_id: tenantBId },
    ]);
    await api.insert("sites", [
      {
        address: companyAFirst.address,
        id: companyAFirst.id,
        management_company_id: companyAId,
        name: companyAFirst.name,
        tenant_id: tenantAId,
      },
      {
        address: companyASecond.address,
        id: companyASecond.id,
        management_company_id: companyAId,
        name: companyASecond.name,
        tenant_id: tenantAId,
      },
      {
        address: tenantB.address,
        id: tenantB.id,
        management_company_id: companyBId,
        name: tenantB.name,
        tenant_id: tenantBId,
      },
    ]);

    const superAdmin = await createActor(api, runToken, "SUPER_ADMIN");
    createdActors.push(superAdmin);
    const managementAdmin = await createActor(api, runToken, "MANAGEMENT_ADMIN");
    createdActors.push(managementAdmin);
    const siteAdmin = await createActor(api, runToken, "SITE_ADMIN");
    createdActors.push(siteAdmin);

    await api.insert(
      "admin_profiles",
      createdActors.map((actor) => ({
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
        management_company_id: companyAId,
        role: "MANAGEMENT_ADMIN",
        scope_type: "MANAGEMENT_COMPANY",
        site_id: null,
        status: "ACTIVE",
        tenant_id: tenantAId,
        user_id: managementAdmin.id,
      },
      {
        accepted_at: new Date().toISOString(),
        id: randomUUID(),
        management_company_id: companyAId,
        role: "SITE_ADMIN",
        scope_type: "SITE",
        site_id: companyAFirst.id,
        status: "ACTIVE",
        tenant_id: tenantAId,
        user_id: siteAdmin.id,
      },
    ]);

    return {
      actors: { managementAdmin, siteAdmin, superAdmin },
      api,
      cleanup,
      companyAId,
      companyBId,
      createdSiteIds,
      lifecycleSiteName: `${runLabel} Lifecycle`,
      runLabel,
      sites: { companyAFirst, companyASecond, tenantB },
      tenantAId,
      tenantBId,
    };
  } catch (error) {
    await cleanup().catch(() => undefined);
    throw error;
  }
}

export function auditPayloadIsSafe(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every(auditPayloadIsSafe);
  }
  if (!value || typeof value !== "object") {
    return true;
  }
  return Object.entries(value).every(
    ([key, nestedValue]) => !SENSITIVE_AUDIT_KEY.test(key) && auditPayloadIsSafe(nestedValue),
  );
}
