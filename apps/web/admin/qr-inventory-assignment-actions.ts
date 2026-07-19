"use server";

import {
  AdminAuthorizationError,
  QrInventoryAssignmentError,
  QrInventoryAssignmentService,
  type VehiclePlateProtector,
} from "@taptolk/application";
import { parseServerEnvironment } from "@taptolk/config";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import { getLocalizedAdminPath } from "../auth/admin-routing";
import { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import {
  createSupabaseQrInventoryAssignmentRepository,
  QrInventoryAssignmentRepositoryError,
} from "./supabase-qr-inventory-assignment-repository";
import { AesGcmVehiclePlateProtector } from "./vehicle-plate-protector";

type ActionError = "blocked" | "conflict" | "forbidden" | "unavailable" | "validation";
type ActionStatus =
  | "assetAssigned"
  | "assetReplaced"
  | "assetRevoked"
  | "batchReceived"
  | "importCommitted"
  | "importValidated";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readLocale(formData: FormData): AppLocale {
  const value = readString(formData, "locale");
  return isAppLocale(value) ? value : "en";
}

function path(
  locale: AppLocale,
  kind: "error" | "status",
  value: ActionError | ActionStatus,
): Route {
  return getLocalizedAdminPath(locale, `/qr-inventory?${kind}=${value}`) as Route;
}

function mapError(error: unknown): ActionError {
  if (error instanceof AdminAuthorizationError) {
    return "forbidden";
  }
  if (error instanceof QrInventoryAssignmentError) {
    return "validation";
  }
  if (error instanceof QrInventoryAssignmentRepositoryError) {
    return error.code === "BLOCKED"
      ? "blocked"
      : error.code === "CONFLICT"
        ? "conflict"
        : error.code === "FORBIDDEN"
          ? "forbidden"
          : "unavailable";
  }
  return "unavailable";
}

function configuredProtector(): VehiclePlateProtector {
  const environment = parseServerEnvironment();
  if (!environment.APP_ENCRYPTION_KEY_V1 || !environment.TOKEN_HMAC_KEY) {
    return {
      async protect() {
        throw new Error("VEHICLE_PLATE_PROTECTION_CONFIG_MISSING");
      },
    };
  }
  return new AesGcmVehiclePlateProtector(
    environment.APP_ENCRYPTION_KEY_V1,
    environment.TOKEN_HMAC_KEY,
  );
}

async function commandContext(locale: AppLocale) {
  const admin = await requireReadyAdminContext(locale);
  const client = await createAdminServerClient();
  if (!client) {
    redirect(path(locale, "error", "unavailable"));
  }
  return {
    actor: {
      authorization: toAdminAuthorizationContext(
        admin.decision.membership,
        admin.mfaLevel === "aal2",
      ),
      userId: admin.userId,
    },
    service: new QrInventoryAssignmentService(
      createSupabaseQrInventoryAssignmentRepository(client),
      configuredProtector(),
    ),
  };
}

function scope(formData: FormData) {
  return {
    managementCompanyId: readString(formData, "managementCompanyId"),
    siteId: readString(formData, "siteId"),
    tenantId: readString(formData, "tenantId"),
  };
}

function selectedSiteScope(formData: FormData) {
  const [tenantId = "", managementCompanyId = "", siteId = ""] = readString(
    formData,
    "siteScope",
  ).split("|");
  return { managementCompanyId, siteId, tenantId };
}

async function run(
  formData: FormData,
  status: ActionStatus,
  command: (context: Awaited<ReturnType<typeof commandContext>>) => Promise<unknown>,
): Promise<never> {
  const locale = readLocale(formData);
  try {
    await command(await commandContext(locale));
  } catch (error) {
    redirect(path(locale, "error", mapError(error)));
  }
  redirect(path(locale, "status", status));
}

export async function receiveQrBatch(formData: FormData): Promise<never> {
  return run(formData, "batchReceived", async ({ actor, service }) => {
    await service.receiveBatch({
      actor,
      auditRequestId: crypto.randomUUID(),
      batchId: readString(formData, "batchId"),
      expectedBatchVersion: Number(readString(formData, "expectedVersion")),
      reason: readString(formData, "reason"),
      ...scope(formData),
    });
  });
}

export async function assignQrAsset(formData: FormData): Promise<never> {
  return run(formData, "assetAssigned", async ({ actor, service }) => {
    await service.assign({
      actor,
      auditRequestId: crypto.randomUUID(),
      expectedAssetVersion: Number(readString(formData, "expectedVersion")),
      normalizedPlate: readString(formData, "vehiclePlate"),
      qrAssetId: readString(formData, "qrAssetId"),
      reason: readString(formData, "reason"),
      ...scope(formData),
    });
  });
}

export async function validateVehicleImport(formData: FormData): Promise<never> {
  return run(formData, "importValidated", async ({ actor, service }) => {
    const source = formData.get("csvFile");
    if (!(source instanceof File) || source.size === 0 || source.size > 2_000_000) {
      throw new QrInventoryAssignmentError("EMPTY_CSV");
    }
    const validation = await service.validateVehicleCsv({
      csvBytes: new Uint8Array(await source.arrayBuffer()),
    });
    if (validation.invalidRows.length > 0) {
      throw new QrInventoryAssignmentError("NO_VALID_ROWS");
    }
    await service.saveValidatedImport({
      actor,
      auditRequestId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      reason: readString(formData, "reason"),
      validation,
      ...selectedSiteScope(formData),
    });
  });
}

export async function commitVehicleImport(formData: FormData): Promise<never> {
  return run(formData, "importCommitted", async ({ actor, service }) => {
    await service.commitImport({
      actor,
      auditRequestId: crypto.randomUUID(),
      expectedImportVersion: Number(readString(formData, "expectedVersion")),
      importId: readString(formData, "importId"),
      reason: readString(formData, "reason"),
      ...scope(formData),
    });
  });
}

export async function replaceQrAsset(formData: FormData): Promise<never> {
  return run(formData, "assetReplaced", async ({ actor, service }) => {
    const [replacementQrAssetId = "", replacementVersion = ""] = readString(
      formData,
      "replacementScope",
    ).split("|");
    await service.replace({
      actor,
      auditRequestId: crypto.randomUUID(),
      expectedReplacementVersion: Number(replacementVersion),
      expectedSourceVersion: Number(readString(formData, "expectedVersion")),
      reason: readString(formData, "reason"),
      replacementQrAssetId,
      sourceQrAssetId: readString(formData, "qrAssetId"),
      ...scope(formData),
    });
  });
}

export async function revokeQrAsset(formData: FormData): Promise<never> {
  return run(formData, "assetRevoked", async ({ actor, service }) => {
    await service.revoke({
      actor,
      auditRequestId: crypto.randomUUID(),
      expectedAssetVersion: Number(readString(formData, "expectedVersion")),
      qrAssetId: readString(formData, "qrAssetId"),
      reason: readString(formData, "reason"),
      ...scope(formData),
    });
  });
}
