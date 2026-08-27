import { createHash } from "node:crypto";
import { type AdminAuthorizationContext, authorizeAdminAction } from "@taptolk/domain";
import { assertAdminAuthorized } from "./authorization-error.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HUMAN_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/u;
const PLATE_PATTERN =
  /^(?=.{5,12}$)[0-9]{2,3}[가-힣][0-9]{4}$|^[가-힣]{2}[0-9]{2}[가-힣][0-9]{4}$/u;

export interface QrInventoryAssignmentActor {
  authorization: AdminAuthorizationContext;
  userId: string;
}

export interface ProtectedVehiclePlate {
  ciphertext: string;
  keyVersion: number;
  last4: string;
  lookupHash: string;
}

export interface VehiclePlateProtector {
  protect(normalizedPlate: string): Promise<ProtectedVehiclePlate>;
}

export interface ValidatedVehicleImportRow {
  plate: ProtectedVehiclePlate;
  qrHumanCode: string;
  rowNumber: number;
}

export interface VehicleImportValidation {
  invalidRows: readonly {
    code: "DUPLICATE_PLATE" | "DUPLICATE_QR" | "INVALID_PLATE" | "INVALID_QR_CODE";
    rowNumber: number;
  }[];
  sourceChecksumSha256: string;
  validRows: readonly ValidatedVehicleImportRow[];
}

export interface QrInventoryAssignmentCommandResult {
  affectedCount: number;
  resourceId: string;
  version: number;
}

export type QrBatchDeliveryStatus = "DELIVERED" | "PRINTED" | "SENT_TO_PRINTER" | "SHIPPED";

export interface QrInventoryAssignmentBatchItem {
  batchCode: string;
  id: string;
  managementCompanyId: string;
  requestedQuantity: number;
  siteId: string;
  siteName: string;
  status: "DELIVERED" | "PARTIALLY_RECEIVED" | "DISTRIBUTING" | "COMPLETED";
  tenantId: string;
  version: number;
}

export interface QrInventoryAssignmentAssetItem {
  batchId: string;
  currentBindingId: string | null;
  currentVehicleLast4: string | null;
  humanCode: string;
  id: string;
  managementCompanyId: string;
  siteId: string;
  status:
    | "GENERATED"
    | "PRINT_READY"
    | "PRINTED"
    | "ACTIVATION_PENDING"
    | "ACTIVE"
    | "ASSIGNED"
    | "DAMAGED"
    | "IN_STOCK"
    | "LOST"
    | "REPLACED"
    | "REVOKED"
    | "SUSPENDED"
    | "EXPIRED";
  tenantId: string;
  version: number;
}

export interface VehicleImportItem {
  committedAt: string | null;
  createdAt: string;
  id: string;
  managementCompanyId: string;
  originalDeletedAt: string;
  rowCount: number;
  siteId: string;
  status: "COMMITTED" | "EXPIRED" | "REJECTED" | "VALIDATED";
  tenantId: string;
  version: number;
}

export interface QrInventoryAssignmentReadModel {
  assets: readonly QrInventoryAssignmentAssetItem[];
  batches: readonly QrInventoryAssignmentBatchItem[];
  imports: readonly VehicleImportItem[];
}

export interface QrInventoryAssignmentRepository {
  advanceBatchDelivery(input: {
    auditRequestId: string;
    batchId: string;
    expectedBatchVersion: number;
    reason: string;
    targetStatus: QrBatchDeliveryStatus;
  }): Promise<QrInventoryAssignmentCommandResult>;
  assign(input: {
    auditRequestId: string;
    expectedAssetVersion: number;
    plate: ProtectedVehiclePlate;
    qrAssetId: string;
    reason: string;
  }): Promise<QrInventoryAssignmentCommandResult>;
  commitImport(input: {
    auditRequestId: string;
    expectedImportVersion: number;
    importId: string;
    reason: string;
  }): Promise<QrInventoryAssignmentCommandResult>;
  list(): Promise<QrInventoryAssignmentReadModel>;
  receiveBatch(input: {
    auditRequestId: string;
    batchId: string;
    expectedBatchVersion: number;
    reason: string;
  }): Promise<QrInventoryAssignmentCommandResult>;
  receiveBatchQuantity(input: {
    auditRequestId: string;
    batchId: string;
    expectedBatchVersion: number;
    receivedQuantity: number;
    reason: string;
  }): Promise<QrInventoryAssignmentCommandResult>;
  replace(input: {
    auditRequestId: string;
    expectedReplacementVersion: number;
    expectedSourceVersion: number;
    reason: string;
    replacementQrAssetId: string;
    sourceQrAssetId: string;
  }): Promise<QrInventoryAssignmentCommandResult>;
  revoke(input: {
    auditRequestId: string;
    expectedAssetVersion: number;
    qrAssetId: string;
    reason: string;
  }): Promise<QrInventoryAssignmentCommandResult>;
  saveValidatedImport(input: {
    auditRequestId: string;
    idempotencyKey: string;
    reason: string;
    siteId: string;
    sourceChecksumSha256: string;
    validRows: readonly ValidatedVehicleImportRow[];
  }): Promise<QrInventoryAssignmentCommandResult>;
}

export class QrInventoryAssignmentError extends Error {
  constructor(
    readonly code:
      | "EMPTY_CSV"
      | "INVALID_CSV_HEADER"
      | "INVALID_DELIVERY_STATUS"
      | "INVALID_ID"
      | "INVALID_QUANTITY"
      | "INVALID_REASON"
      | "INVALID_VERSION"
      | "NO_VALID_ROWS"
      | "TOO_MANY_ROWS",
  ) {
    super(`QR inventory assignment rejected: ${code}`);
    this.name = "QrInventoryAssignmentError";
  }
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new QrInventoryAssignmentError("INVALID_ID");
  }
}

function assertVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new QrInventoryAssignmentError("INVALID_VERSION");
  }
}

function assertQuantity(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new QrInventoryAssignmentError("INVALID_QUANTITY");
  }
}

function assertDeliveryStatus(value: string): asserts value is QrBatchDeliveryStatus {
  if (
    !(["DELIVERED", "PRINTED", "SENT_TO_PRINTER", "SHIPPED"] as const).includes(
      value as QrBatchDeliveryStatus,
    )
  ) {
    throw new QrInventoryAssignmentError("INVALID_DELIVERY_STATUS");
  }
}

function normalizeReason(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 500) {
    throw new QrInventoryAssignmentError("INVALID_REASON");
  }
  return normalized;
}

function normalizePlate(value: string): string {
  return value.normalize("NFKC").replace(/[\s-]/gu, "").toUpperCase();
}

function parseCsv(source: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field.replace(/\r$/u, ""));
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }
  return rows;
}

function authorize(
  actor: QrInventoryAssignmentActor,
  permission: "qr-asset:assign" | "qr-asset:revoke",
  scope: { managementCompanyId: string; siteId: string; tenantId: string },
): void {
  assertUuid(actor.userId);
  assertAdminAuthorized(authorizeAdminAction(actor.authorization, permission, scope));
}

export class QrInventoryAssignmentService {
  constructor(
    private readonly repository: QrInventoryAssignmentRepository,
    private readonly plateProtector: VehiclePlateProtector,
  ) {}

  async advanceBatchDelivery(input: {
    actor: QrInventoryAssignmentActor;
    auditRequestId: string;
    batchId: string;
    expectedBatchVersion: number;
    managementCompanyId: string;
    reason: string;
    siteId: string;
    targetStatus: string;
    tenantId: string;
  }): Promise<QrInventoryAssignmentCommandResult> {
    assertUuid(input.actor.userId);
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "qr-batch:delivery-advance", input),
    );
    assertUuid(input.auditRequestId);
    assertUuid(input.batchId);
    assertVersion(input.expectedBatchVersion);
    assertDeliveryStatus(input.targetStatus);
    return this.repository.advanceBatchDelivery({
      auditRequestId: input.auditRequestId,
      batchId: input.batchId,
      expectedBatchVersion: input.expectedBatchVersion,
      reason: normalizeReason(input.reason),
      targetStatus: input.targetStatus,
    });
  }

  async list(input: {
    actor: QrInventoryAssignmentActor;
  }): Promise<QrInventoryAssignmentReadModel> {
    assertUuid(input.actor.userId);
    const scope = input.actor.authorization.scope;
    assertAdminAuthorized(
      authorizeAdminAction(input.actor.authorization, "qr-asset:read", {
        ...(scope.managementCompanyId ? { managementCompanyId: scope.managementCompanyId } : {}),
        ...(scope.siteId ? { siteId: scope.siteId } : {}),
        tenantId: scope.tenantId ?? "platform-inventory",
      }),
    );
    return this.repository.list();
  }

  async validateVehicleCsv(input: { csvBytes: Uint8Array }): Promise<VehicleImportValidation> {
    if (input.csvBytes.byteLength === 0) {
      throw new QrInventoryAssignmentError("EMPTY_CSV");
    }
    const source = new TextDecoder("utf-8", { fatal: true })
      .decode(input.csvBytes)
      .replace(/^\uFEFF/u, "");
    const rows = parseCsv(source);
    if (rows.length < 2) {
      throw new QrInventoryAssignmentError("EMPTY_CSV");
    }
    if (rows.length > 10_001) {
      throw new QrInventoryAssignmentError("TOO_MANY_ROWS");
    }
    const header = rows[0]?.map((value) => value.trim().toLowerCase());
    if (header?.length !== 2 || header[0] !== "vehicle_plate" || header[1] !== "qr_human_code") {
      throw new QrInventoryAssignmentError("INVALID_CSV_HEADER");
    }

    const sourceChecksumSha256 = createHash("sha256").update(input.csvBytes).digest("hex");
    const seenPlates = new Set<string>();
    const seenQrCodes = new Set<string>();
    const invalidRows: VehicleImportValidation["invalidRows"][number][] = [];
    const validRows: ValidatedVehicleImportRow[] = [];

    for (const [index, row] of rows.slice(1).entries()) {
      const rowNumber = index + 2;
      const plate = normalizePlate(row[0] ?? "");
      const qrHumanCode = (row[1] ?? "").trim().toUpperCase();
      if (!PLATE_PATTERN.test(plate)) {
        invalidRows.push({ code: "INVALID_PLATE", rowNumber });
        continue;
      }
      if (!HUMAN_CODE_PATTERN.test(qrHumanCode)) {
        invalidRows.push({ code: "INVALID_QR_CODE", rowNumber });
        continue;
      }
      if (seenPlates.has(plate)) {
        invalidRows.push({ code: "DUPLICATE_PLATE", rowNumber });
        continue;
      }
      if (seenQrCodes.has(qrHumanCode)) {
        invalidRows.push({ code: "DUPLICATE_QR", rowNumber });
        continue;
      }
      seenPlates.add(plate);
      seenQrCodes.add(qrHumanCode);
      validRows.push({
        plate: await this.plateProtector.protect(plate),
        qrHumanCode,
        rowNumber,
      });
    }

    return { invalidRows, sourceChecksumSha256, validRows };
  }

  async saveValidatedImport(input: {
    actor: QrInventoryAssignmentActor;
    auditRequestId: string;
    idempotencyKey: string;
    managementCompanyId: string;
    reason: string;
    siteId: string;
    tenantId: string;
    validation: VehicleImportValidation;
  }): Promise<QrInventoryAssignmentCommandResult> {
    authorize(input.actor, "qr-asset:assign", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.idempotencyKey);
    assertUuid(input.siteId);
    if (input.validation.validRows.length === 0) {
      throw new QrInventoryAssignmentError("NO_VALID_ROWS");
    }
    return this.repository.saveValidatedImport({
      auditRequestId: input.auditRequestId,
      idempotencyKey: input.idempotencyKey,
      reason: normalizeReason(input.reason),
      siteId: input.siteId,
      sourceChecksumSha256: input.validation.sourceChecksumSha256,
      validRows: input.validation.validRows,
    });
  }

  async receiveBatch(input: {
    actor: QrInventoryAssignmentActor;
    auditRequestId: string;
    batchId: string;
    expectedBatchVersion: number;
    managementCompanyId: string;
    reason: string;
    siteId: string;
    tenantId: string;
  }): Promise<QrInventoryAssignmentCommandResult> {
    authorize(input.actor, "qr-asset:assign", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.batchId);
    assertVersion(input.expectedBatchVersion);
    return this.repository.receiveBatch({
      auditRequestId: input.auditRequestId,
      batchId: input.batchId,
      expectedBatchVersion: input.expectedBatchVersion,
      reason: normalizeReason(input.reason),
    });
  }

  async receiveBatchQuantity(input: {
    actor: QrInventoryAssignmentActor;
    auditRequestId: string;
    batchId: string;
    expectedBatchVersion: number;
    managementCompanyId: string;
    receivedQuantity: number;
    reason: string;
    siteId: string;
    tenantId: string;
  }): Promise<QrInventoryAssignmentCommandResult> {
    authorize(input.actor, "qr-asset:assign", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.batchId);
    assertVersion(input.expectedBatchVersion);
    assertQuantity(input.receivedQuantity);
    return this.repository.receiveBatchQuantity({
      auditRequestId: input.auditRequestId,
      batchId: input.batchId,
      expectedBatchVersion: input.expectedBatchVersion,
      receivedQuantity: input.receivedQuantity,
      reason: normalizeReason(input.reason),
    });
  }

  async assign(input: {
    actor: QrInventoryAssignmentActor;
    auditRequestId: string;
    expectedAssetVersion: number;
    managementCompanyId: string;
    normalizedPlate: string;
    qrAssetId: string;
    reason: string;
    siteId: string;
    tenantId: string;
  }): Promise<QrInventoryAssignmentCommandResult> {
    authorize(input.actor, "qr-asset:assign", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.qrAssetId);
    assertVersion(input.expectedAssetVersion);
    const normalizedPlate = normalizePlate(input.normalizedPlate);
    if (!PLATE_PATTERN.test(normalizedPlate)) {
      throw new QrInventoryAssignmentError("NO_VALID_ROWS");
    }
    return this.repository.assign({
      auditRequestId: input.auditRequestId,
      expectedAssetVersion: input.expectedAssetVersion,
      plate: await this.plateProtector.protect(normalizedPlate),
      qrAssetId: input.qrAssetId,
      reason: normalizeReason(input.reason),
    });
  }

  async commitImport(input: {
    actor: QrInventoryAssignmentActor;
    auditRequestId: string;
    expectedImportVersion: number;
    importId: string;
    managementCompanyId: string;
    reason: string;
    siteId: string;
    tenantId: string;
  }): Promise<QrInventoryAssignmentCommandResult> {
    authorize(input.actor, "qr-asset:assign", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.importId);
    assertVersion(input.expectedImportVersion);
    return this.repository.commitImport({
      auditRequestId: input.auditRequestId,
      expectedImportVersion: input.expectedImportVersion,
      importId: input.importId,
      reason: normalizeReason(input.reason),
    });
  }

  async replace(input: {
    actor: QrInventoryAssignmentActor;
    auditRequestId: string;
    expectedReplacementVersion: number;
    expectedSourceVersion: number;
    managementCompanyId: string;
    reason: string;
    replacementQrAssetId: string;
    siteId: string;
    sourceQrAssetId: string;
    tenantId: string;
  }): Promise<QrInventoryAssignmentCommandResult> {
    authorize(input.actor, "qr-asset:revoke", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.sourceQrAssetId);
    assertUuid(input.replacementQrAssetId);
    assertVersion(input.expectedSourceVersion);
    assertVersion(input.expectedReplacementVersion);
    return this.repository.replace({
      auditRequestId: input.auditRequestId,
      expectedReplacementVersion: input.expectedReplacementVersion,
      expectedSourceVersion: input.expectedSourceVersion,
      reason: normalizeReason(input.reason),
      replacementQrAssetId: input.replacementQrAssetId,
      sourceQrAssetId: input.sourceQrAssetId,
    });
  }

  async revoke(input: {
    actor: QrInventoryAssignmentActor;
    auditRequestId: string;
    expectedAssetVersion: number;
    managementCompanyId: string;
    qrAssetId: string;
    reason: string;
    siteId: string;
    tenantId: string;
  }): Promise<QrInventoryAssignmentCommandResult> {
    authorize(input.actor, "qr-asset:revoke", input);
    assertUuid(input.auditRequestId);
    assertUuid(input.qrAssetId);
    assertVersion(input.expectedAssetVersion);
    return this.repository.revoke({
      auditRequestId: input.auditRequestId,
      expectedAssetVersion: input.expectedAssetVersion,
      qrAssetId: input.qrAssetId,
      reason: normalizeReason(input.reason),
    });
  }
}
