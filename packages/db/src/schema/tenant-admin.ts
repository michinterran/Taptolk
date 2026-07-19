import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const tenantStatus = pgEnum("tenant_status", ["ACTIVE", "SUSPENDED", "CLOSED"]);
export const organizationStatus = pgEnum("organization_status", ["ACTIVE", "SUSPENDED", "CLOSED"]);
export const siteType = pgEnum("site_type", ["APARTMENT", "OFFICETEL", "BUILDING", "OTHER"]);
export const contractStatus = pgEnum("contract_status", [
  "DRAFT",
  "ACTIVE",
  "SUSPENDED",
  "EXPIRED",
  "TERMINATED",
]);
export const billingBasis = pgEnum("billing_basis", [
  "ACTIVE_VEHICLE",
  "CONTRACTED_VEHICLE",
  "FLAT",
]);
export const adminProfileStatus = pgEnum("admin_profile_status", [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "CLOSED",
]);
export const adminRole = pgEnum("admin_role", [
  "SUPER_ADMIN",
  "PLATFORM_OPERATOR",
  "MANAGEMENT_ADMIN",
  "SITE_ADMIN",
  "SITE_OPERATOR",
  "READ_ONLY",
]);
export const adminScopeType = pgEnum("admin_scope_type", [
  "PLATFORM",
  "TENANT",
  "MANAGEMENT_COMPANY",
  "SITE",
]);
export const adminMembershipStatus = pgEnum("admin_membership_status", [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "REVOKED",
]);
export const auditActorType = pgEnum("audit_actor_type", [
  "ADMIN",
  "OWNER",
  "CALLER",
  "SYSTEM",
  "WORKER",
]);
export const siteLifecycleAction = pgEnum("site_lifecycle_action", [
  "SUSPEND",
  "REACTIVATE",
  "CLOSE",
]);
export const siteLifecycleRequestStatus = pgEnum("site_lifecycle_request_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);
export const stickerDesignStatus = pgEnum("sticker_design_status", [
  "DRAFT",
  "APPROVED",
  "ARCHIVED",
]);
export const qrBatchStatus = pgEnum("qr_batch_status", [
  "DRAFT",
  "SAMPLE_RENDERING",
  "SAMPLE_READY",
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
  "CANCELLED",
  "PARTIALLY_COMPLETED",
]);
export const qrBatchSampleStatus = pgEnum("qr_batch_sample_status", [
  "READY",
  "APPROVED",
  "INVALIDATED",
]);
export const qrAssetStatus = pgEnum("qr_asset_status", [
  "GENERATED",
  "PRINT_READY",
  "PRINTED",
  "IN_STOCK",
  "ASSIGNED",
  "ACTIVATION_PENDING",
  "ACTIVE",
  "SUSPENDED",
  "LOST",
  "DAMAGED",
  "REPLACED",
  "REVOKED",
  "EXPIRED",
]);
export const qrGenerationJobStatus = pgEnum("qr_generation_job_status", [
  "PENDING_DELIVERY",
  "DELIVERY_LEASED",
  "QUEUED",
  "PROCESSING",
  "RETRY_WAIT",
  "COMPLETED",
  "FAILED",
  "ABORTED",
  "PARTIALLY_COMPLETED",
]);
export const brandAssetType = pgEnum("brand_asset_type", [
  "MANAGEMENT_COMPANY_LOGO",
  "SITE_LOGO",
  "TAPTOLK_LOGO",
  "BACKGROUND_TEMPLATE",
  "DECORATION",
]);
export const brandAssetStatus = pgEnum("brand_asset_status", [
  "UPLOADING",
  "ACTIVE",
  "REJECTED",
  "ARCHIVED",
]);
export const stickerTemplateStatus = pgEnum("sticker_template_status", ["ACTIVE", "ARCHIVED"]);
export const qrActivationCodeStatus = pgEnum("qr_activation_code_status", [
  "ISSUED",
  "USED",
  "REVOKED",
  "EXPIRED",
]);
export const renderJobType = pgEnum("render_job_type", ["SAMPLE", "BATCH", "RETRY"]);
export const renderJobStatus = pgEnum("render_job_status", [
  "QUEUED",
  "PROCESSING",
  "RENDERED",
  "QUALITY_CHECKED",
  "EXPORTED",
  "COMPLETED",
  "FAILED_RETRYABLE",
  "FAILED_FINAL",
  "CANCELLED",
]);
export const renderQualityStatus = pgEnum("render_quality_status", ["PENDING", "PASSED", "FAILED"]);
export const printExportType = pgEnum("print_export_type", ["PDF", "CSV", "ZIP", "MANIFEST"]);
export const printExportStatus = pgEnum("print_export_status", ["PENDING", "READY", "FAILED"]);
export const inventoryTransactionType = pgEnum("inventory_transaction_type", [
  "RECEIVE",
  "ASSIGN",
  "RETURN",
  "DAMAGE",
  "REPLACE",
  "REVOKE",
]);
export const qrAssignmentMethod = pgEnum("qr_assignment_method", [
  "MANUAL",
  "CSV_IMPORT",
  "OWNER_ACTIVATION",
  "REPLACEMENT",
]);
export const vehicleImportStatus = pgEnum("vehicle_import_status", [
  "VALIDATED",
  "COMMITTED",
  "REJECTED",
  "EXPIRED",
]);

function commonColumns() {
  return {
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    version: integer("version").default(1).notNull(),
  };
}

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: tenantStatus("status").default("ACTIVE").notNull(),
    settings: jsonb("settings").default(sql`'{}'::jsonb`).notNull(),
    ...commonColumns(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    unique("uq_tenants_tenant_id").on(table.id),
    uniqueIndex("uq_tenants_active_slug")
      .on(sql`lower(${table.slug})`)
      .where(sql`${table.deletedAt} is null`),
    check("chk_tenants_name", sql`length(trim(${table.name})) between 1 and 200`),
    check("chk_tenants_slug", sql`${table.slug} ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$'`),
    check("chk_tenants_settings_object", sql`jsonb_typeof(${table.settings}) = 'object'`),
  ],
);

export const managementCompanies = pgTable(
  "management_companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    businessNumber: text("business_number"),
    status: organizationStatus("status").default("ACTIVE").notNull(),
    contactName: text("contact_name"),
    contactPhoneEncrypted: text("contact_phone_encrypted"),
    billingEmail: text("billing_email"),
    ...commonColumns(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: "fk_management_companies_tenant",
    }).onDelete("restrict"),
    unique("uq_management_companies_tenant_id").on(table.tenantId, table.id),
    index("idx_management_companies_tenant_status").on(table.tenantId, table.status),
    uniqueIndex("uq_management_companies_active_business_number")
      .on(table.tenantId, table.businessNumber)
      .where(sql`${table.businessNumber} is not null and ${table.deletedAt} is null`),
    check("chk_management_companies_name", sql`length(trim(${table.name})) between 1 and 200`),
    check(
      "chk_management_companies_business_number",
      sql`${table.businessNumber} is null or ${table.businessNumber} ~ '^[0-9]{10}$'`,
    ),
  ],
);

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id").notNull(),
    name: text("name").notNull(),
    type: siteType("site_type").default("APARTMENT").notNull(),
    address: text("address"),
    timezone: text("timezone").default("Asia/Seoul").notNull(),
    contractVehicleLimit: integer("contract_vehicle_limit").default(0).notNull(),
    status: organizationStatus("status").default("ACTIVE").notNull(),
    escalationPhoneEncrypted: text("escalation_phone_encrypted"),
    settings: jsonb("settings").default(sql`'{}'::jsonb`).notNull(),
    ...commonColumns(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId],
      foreignColumns: [managementCompanies.tenantId, managementCompanies.id],
      name: "fk_sites_tenant_management_company",
    }).onDelete("restrict"),
    unique("uq_sites_tenant_management_id").on(table.tenantId, table.managementCompanyId, table.id),
    unique("uq_sites_tenant_id").on(table.tenantId, table.id),
    uniqueIndex("uq_sites_active_management_name")
      .on(table.managementCompanyId, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} is null`),
    index("idx_sites_tenant_status").on(table.tenantId, table.status),
    index("idx_sites_management_status").on(table.managementCompanyId, table.status),
    check("chk_sites_name", sql`length(trim(${table.name})) between 1 and 200`),
    check("chk_sites_vehicle_limit", sql`${table.contractVehicleLimit} >= 0`),
    check("chk_sites_settings_object", sql`jsonb_typeof(${table.settings}) = 'object'`),
  ],
);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id").notNull(),
    siteId: uuid("site_id"),
    planCode: text("plan_code").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    minimumVehicleCount: integer("minimum_vehicle_count").default(0).notNull(),
    basis: billingBasis("billing_basis").notNull(),
    status: contractStatus("status").default("DRAFT").notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    ...commonColumns(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId],
      foreignColumns: [managementCompanies.tenantId, managementCompanies.id],
      name: "fk_contracts_tenant_management_company",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId, table.siteId],
      foreignColumns: [sites.tenantId, sites.managementCompanyId, sites.id],
      name: "fk_contracts_tenant_management_site",
    }).onDelete("restrict"),
    index("idx_contracts_tenant_status").on(table.tenantId, table.status),
    check(
      "chk_contracts_date_range",
      sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
    ),
    check("chk_contracts_minimum_vehicle_count", sql`${table.minimumVehicleCount} >= 0`),
    check("chk_contracts_metadata_object", sql`jsonb_typeof(${table.metadata}) = 'object'`),
  ],
);

export const adminProfiles = pgTable(
  "admin_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    status: adminProfileStatus("status").default("INVITED").notNull(),
    lastLoginAt: timestamp("last_login_at", { mode: "date", withTimezone: true }),
    ...commonColumns(),
  },
  (table) => [
    check(
      "chk_admin_profiles_display_name",
      sql`length(trim(${table.displayName})) between 1 and 100`,
    ),
  ],
);

export const adminMemberships = pgTable(
  "admin_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "restrict" }),
    managementCompanyId: uuid("management_company_id"),
    siteId: uuid("site_id"),
    role: adminRole("role").notNull(),
    scopeType: adminScopeType("scope_type").notNull(),
    status: adminMembershipStatus("status").default("INVITED").notNull(),
    invitedBy: uuid("invited_by").references(() => authUsers.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId],
      foreignColumns: [managementCompanies.tenantId, managementCompanies.id],
      name: "fk_admin_memberships_tenant_management_company",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId, table.siteId],
      foreignColumns: [sites.tenantId, sites.managementCompanyId, sites.id],
      name: "fk_admin_memberships_tenant_management_site",
    }).onDelete("restrict"),
    unique("uq_admin_memberships_user_scope").on(
      table.userId,
      table.scopeType,
      table.tenantId,
      table.managementCompanyId,
      table.siteId,
      table.role,
    ),
    index("idx_admin_memberships_user_status").on(table.userId, table.status),
    index("idx_admin_memberships_tenant_scope").on(
      table.tenantId,
      table.managementCompanyId,
      table.siteId,
      table.status,
    ),
    check(
      "chk_admin_memberships_role_scope",
      sql`
        (
          ${table.role} in ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
          and ${table.scopeType} = 'PLATFORM'
          and ${table.tenantId} is null
          and ${table.managementCompanyId} is null
          and ${table.siteId} is null
        )
        or (
          ${table.role} = 'MANAGEMENT_ADMIN'
          and ${table.scopeType} = 'MANAGEMENT_COMPANY'
          and ${table.tenantId} is not null
          and ${table.managementCompanyId} is not null
          and ${table.siteId} is null
        )
        or (
          ${table.role} in ('SITE_ADMIN', 'SITE_OPERATOR')
          and ${table.scopeType} = 'SITE'
          and ${table.tenantId} is not null
          and ${table.managementCompanyId} is not null
          and ${table.siteId} is not null
        )
        or (
          ${table.role} = 'READ_ONLY'
          and (
            (
              ${table.scopeType} = 'TENANT'
              and ${table.tenantId} is not null
              and ${table.managementCompanyId} is null
              and ${table.siteId} is null
            )
            or (
              ${table.scopeType} = 'MANAGEMENT_COMPANY'
              and ${table.tenantId} is not null
              and ${table.managementCompanyId} is not null
              and ${table.siteId} is null
            )
            or (
              ${table.scopeType} = 'SITE'
              and ${table.tenantId} is not null
              and ${table.managementCompanyId} is not null
              and ${table.siteId} is not null
            )
          )
        )
      `,
    ),
  ],
);

export const siteLifecycleRequests = pgTable(
  "site_lifecycle_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id").notNull(),
    siteId: uuid("site_id").notNull(),
    action: siteLifecycleAction("action").notNull(),
    status: siteLifecycleRequestStatus("status").default("PENDING").notNull(),
    requestedSiteVersion: integer("requested_site_version").notNull(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    requestReason: text("request_reason").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => authUsers.id, { onDelete: "restrict" }),
    reviewReason: text("review_reason"),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId, table.siteId],
      foreignColumns: [sites.tenantId, sites.managementCompanyId, sites.id],
      name: "fk_site_lifecycle_requests_site",
    }).onDelete("restrict"),
    index("idx_site_lifecycle_requests_tenant_status_created").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    index("idx_site_lifecycle_requests_site_status_created").on(
      table.siteId,
      table.status,
      table.createdAt,
    ),
    uniqueIndex("uq_site_lifecycle_requests_pending_site")
      .on(table.siteId)
      .where(sql`${table.status} = 'PENDING'`),
    check("chk_site_lifecycle_requests_site_version", sql`${table.requestedSiteVersion} >= 1`),
    check(
      "chk_site_lifecycle_requests_request_reason",
      sql`length(trim(${table.requestReason})) between 3 and 500`,
    ),
    check(
      "chk_site_lifecycle_requests_review_reason",
      sql`${table.reviewReason} is null or length(trim(${table.reviewReason})) between 3 and 500`,
    ),
    check(
      "chk_site_lifecycle_requests_state_metadata",
      sql`
        (
          ${table.status} = 'PENDING'
          and ${table.reviewedBy} is null
          and ${table.reviewReason} is null
          and ${table.reviewedAt} is null
          and ${table.cancelledAt} is null
        )
        or (
          ${table.status} in ('APPROVED', 'REJECTED')
          and ${table.reviewedBy} is not null
          and ${table.reviewReason} is not null
          and ${table.reviewedAt} is not null
          and ${table.cancelledAt} is null
          and ${table.requestedBy} <> ${table.reviewedBy}
        )
        or (
          ${table.status} = 'CANCELLED'
          and ${table.reviewedBy} is null
          and ${table.reviewReason} is null
          and ${table.reviewedAt} is null
          and ${table.cancelledAt} is not null
        )
      `,
    ),
  ],
);

export const brandAssets = pgTable(
  "brand_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id"),
    siteId: uuid("site_id"),
    assetType: brandAssetType("asset_type").notNull(),
    name: text("name").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    widthPx: integer("width_px"),
    heightPx: integer("height_px"),
    byteSize: integer("byte_size").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    backgroundVariant: text("background_variant"),
    isDefault: boolean("is_default").default(false).notNull(),
    status: brandAssetStatus("status").default("UPLOADING").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: "fk_brand_assets_tenant",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId],
      foreignColumns: [managementCompanies.tenantId, managementCompanies.id],
      name: "fk_brand_assets_management_company",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId, table.siteId],
      foreignColumns: [sites.tenantId, sites.managementCompanyId, sites.id],
      name: "fk_brand_assets_site",
    }).onDelete("restrict"),
    unique("uq_brand_assets_tenant_id").on(table.tenantId, table.id),
    index("idx_brand_assets_tenant_status_created").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    index("idx_brand_assets_site_type_status").on(table.siteId, table.assetType, table.status),
    check("chk_brand_assets_checksum", sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    check("chk_brand_assets_byte_size", sql`${table.byteSize} between 1 and 5000000`),
  ],
);

export const stickerTemplates = pgTable(
  "sticker_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateCode: text("template_code").notNull().unique(),
    name: text("name").notNull(),
    shape: text("shape").notNull(),
    widthMm: numeric("width_mm", { precision: 8, scale: 2 }).notNull(),
    heightMm: numeric("height_mm", { precision: 8, scale: 2 }).notNull(),
    dpi: integer("dpi").notNull(),
    layoutSchema: jsonb("layout_schema").notNull(),
    materialCode: text("material_code"),
    version: integer("version").notNull(),
    status: stickerTemplateStatus("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("chk_sticker_templates_code", sql`${table.templateCode} ~ '^[A-Z0-9][A-Z0-9_]{1,63}$'`),
    check("chk_sticker_templates_shape", sql`${table.shape} in ('CIRCLE', 'SQUARE')`),
    check("chk_sticker_templates_dpi", sql`${table.dpi} between 72 and 1200`),
  ],
);

export const stickerDesignVersions = pgTable(
  "sticker_design_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id").notNull(),
    siteId: uuid("site_id").notNull(),
    templateCode: text("template_code").notNull(),
    templateId: uuid("template_id").references(() => stickerTemplates.id, {
      onDelete: "restrict",
    }),
    customerLogoAssetId: uuid("customer_logo_asset_id"),
    taptolkLogoAssetId: uuid("taptolk_logo_asset_id"),
    designConfig: jsonb("design_config").notNull(),
    status: stickerDesignStatus("status").default("DRAFT").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    approvedBy: uuid("approved_by").references(() => authUsers.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at", { mode: "date", withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => authUsers.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId, table.siteId],
      foreignColumns: [sites.tenantId, sites.managementCompanyId, sites.id],
      name: "fk_sticker_design_versions_site",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.customerLogoAssetId],
      foreignColumns: [brandAssets.tenantId, brandAssets.id],
      name: "fk_sticker_design_versions_customer_logo",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.taptolkLogoAssetId],
      foreignColumns: [brandAssets.tenantId, brandAssets.id],
      name: "fk_sticker_design_versions_taptolk_logo",
    }).onDelete("restrict"),
    unique("uq_sticker_design_versions_scope_id").on(
      table.tenantId,
      table.managementCompanyId,
      table.siteId,
      table.id,
    ),
    uniqueIndex("uq_sticker_design_versions_site_draft")
      .on(table.siteId)
      .where(sql`${table.status} = 'DRAFT'`),
    uniqueIndex("uq_sticker_design_versions_site_approved")
      .on(table.siteId)
      .where(sql`${table.status} = 'APPROVED'`),
    index("idx_sticker_design_versions_tenant_status_created").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    index("idx_sticker_design_versions_site_status_created").on(
      table.siteId,
      table.status,
      table.createdAt,
    ),
    check(
      "chk_sticker_design_versions_template_code",
      sql`${table.templateCode} ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'`,
    ),
    check(
      "chk_sticker_design_versions_config",
      sql`jsonb_typeof(${table.designConfig}) = 'object' and length(${table.designConfig}::text) <= 20000`,
    ),
  ],
);

export const qrBatches = pgTable(
  "qr_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id").notNull(),
    siteId: uuid("site_id").notNull(),
    batchCode: text("batch_code").notNull(),
    stickerDesignVersionId: uuid("sticker_design_version_id").notNull(),
    requestedQuantity: integer("requested_quantity").notNull(),
    generatedQuantity: integer("generated_quantity").default(0).notNull(),
    renderedQuantity: integer("rendered_quantity").default(0).notNull(),
    passedQuantity: integer("passed_quantity").default(0).notNull(),
    failedQuantity: integer("failed_quantity").default(0).notNull(),
    purpose: text("purpose").notNull(),
    status: qrBatchStatus("status").default("DRAFT").notNull(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    sampleApprovedBy: uuid("sample_approved_by").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
    sampleApprovedAt: timestamp("sample_approved_at", { mode: "date", withTimezone: true }),
    generationApprovedBy: uuid("generation_approved_by").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
    generationApprovedAt: timestamp("generation_approved_at", {
      mode: "date",
      withTimezone: true,
    }),
    cancelledBy: uuid("cancelled_by").references(() => authUsers.id, { onDelete: "restrict" }),
    cancelledAt: timestamp("cancelled_at", { mode: "date", withTimezone: true }),
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId, table.siteId],
      foreignColumns: [sites.tenantId, sites.managementCompanyId, sites.id],
      name: "fk_qr_batches_site",
    }).onDelete("restrict"),
    foreignKey({
      columns: [
        table.tenantId,
        table.managementCompanyId,
        table.siteId,
        table.stickerDesignVersionId,
      ],
      foreignColumns: [
        stickerDesignVersions.tenantId,
        stickerDesignVersions.managementCompanyId,
        stickerDesignVersions.siteId,
        stickerDesignVersions.id,
      ],
      name: "fk_qr_batches_sticker_design",
    }).onDelete("restrict"),
    unique("uq_qr_batches_scope_id").on(
      table.tenantId,
      table.managementCompanyId,
      table.siteId,
      table.id,
    ),
    unique("uq_qr_batches_batch_code").on(table.batchCode),
    index("idx_qr_batches_tenant_status_created").on(table.tenantId, table.status, table.createdAt),
    index("idx_qr_batches_site_status_created").on(table.siteId, table.status, table.createdAt),
    check("chk_qr_batches_requested_quantity", sql`${table.requestedQuantity} between 1 and 10000`),
    check("chk_qr_batches_purpose", sql`length(trim(${table.purpose})) between 3 and 200`),
  ],
);

export const qrBatchSamples = pgTable(
  "qr_batch_samples",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id").notNull(),
    siteId: uuid("site_id").notNull(),
    batchId: uuid("batch_id").notNull(),
    status: qrBatchSampleStatus("status").default("READY").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    decodePassed: boolean("decode_passed").default(false).notNull(),
    quietZonePassed: boolean("quiet_zone_passed").default(false).notNull(),
    contrastPassed: boolean("contrast_passed").default(false).notNull(),
    attachedBy: uuid("attached_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    approvedBy: uuid("approved_by").references(() => authUsers.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at", { mode: "date", withTimezone: true }),
    invalidatedBy: uuid("invalidated_by").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
    invalidatedAt: timestamp("invalidated_at", { mode: "date", withTimezone: true }),
    invalidationReason: text("invalidation_reason"),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId, table.siteId, table.batchId],
      foreignColumns: [
        qrBatches.tenantId,
        qrBatches.managementCompanyId,
        qrBatches.siteId,
        qrBatches.id,
      ],
      name: "fk_qr_batch_samples_batch",
    }).onDelete("restrict"),
    unique("uq_qr_batch_samples_scope_id").on(
      table.tenantId,
      table.managementCompanyId,
      table.siteId,
      table.batchId,
      table.id,
    ),
    uniqueIndex("uq_qr_batch_samples_active_batch")
      .on(table.batchId)
      .where(sql`${table.status} <> 'INVALIDATED'`),
    index("idx_qr_batch_samples_site_status_created").on(
      table.siteId,
      table.status,
      table.createdAt,
    ),
    check("chk_qr_batch_samples_checksum", sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    check("chk_qr_batch_samples_byte_size", sql`${table.byteSize} between 1 and 20000000`),
  ],
);

export const qrGenerationJobs = pgTable(
  "qr_generation_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id").notNull(),
    siteId: uuid("site_id").notNull(),
    qrBatchId: uuid("qr_batch_id").notNull(),
    jobType: text("job_type").default("QR_GENERATION").notNull(),
    generationRevision: integer("generation_revision").default(1).notNull(),
    approvalRequestId: uuid("approval_request_id").notNull(),
    status: qrGenerationJobStatus("status").default("PENDING_DELIVERY").notNull(),
    deliveryAttemptCount: integer("delivery_attempt_count").default(0).notNull(),
    executionAttemptCount: integer("execution_attempt_count").default(0).notNull(),
    maxExecutionAttempts: integer("max_execution_attempts").default(5).notNull(),
    availableAt: timestamp("available_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", { mode: "date", withTimezone: true }),
    queueMessageId: text("queue_message_id"),
    processedCount: integer("processed_count").default(0).notNull(),
    passedCount: integer("passed_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    lastErrorCode: text("last_error_code"),
    queuedAt: timestamp("queued_at", { mode: "date", withTimezone: true }),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    failedAt: timestamp("failed_at", { mode: "date", withTimezone: true }),
    abortedAt: timestamp("aborted_at", { mode: "date", withTimezone: true }),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId, table.siteId, table.qrBatchId],
      foreignColumns: [
        qrBatches.tenantId,
        qrBatches.managementCompanyId,
        qrBatches.siteId,
        qrBatches.id,
      ],
      name: "fk_qr_generation_jobs_batch",
    }).onDelete("restrict"),
    unique("uq_qr_generation_jobs_tenant_id").on(table.tenantId, table.id),
    unique("uq_qr_generation_jobs_approval_request").on(table.tenantId, table.approvalRequestId),
    unique("uq_qr_generation_jobs_revision").on(
      table.tenantId,
      table.qrBatchId,
      table.generationRevision,
      table.jobType,
    ),
    index("idx_qr_generation_jobs_tenant_status_available").on(
      table.tenantId,
      table.status,
      table.availableAt,
      table.createdAt,
    ),
    index("idx_qr_generation_jobs_batch_revision").on(table.qrBatchId, table.generationRevision),
    check("chk_qr_generation_jobs_job_type", sql`${table.jobType} = 'QR_GENERATION'`),
    check("chk_qr_generation_jobs_revision", sql`${table.generationRevision} >= 1`),
    check(
      "chk_qr_generation_jobs_attempts",
      sql`
        ${table.deliveryAttemptCount} >= 0
        and ${table.executionAttemptCount} >= 0
        and ${table.maxExecutionAttempts} = 5
        and ${table.executionAttemptCount} <= ${table.maxExecutionAttempts}
      `,
    ),
    check(
      "chk_qr_generation_jobs_counts",
      sql`
        ${table.processedCount} >= 0
        and ${table.passedCount} >= 0
        and ${table.failedCount} >= 0
        and ${table.passedCount} + ${table.failedCount} <= ${table.processedCount}
      `,
    ),
    check(
      "chk_qr_generation_jobs_error_code",
      sql`${table.lastErrorCode} is null or ${table.lastErrorCode} ~ '^[A-Z0-9][A-Z0-9_]{1,63}$'`,
    ),
    check(
      "chk_qr_generation_jobs_state_metadata",
      sql`
        (
          ${table.status} = 'PENDING_DELIVERY'
          and ${table.queueMessageId} is null
          and ${table.queuedAt} is null
          and ${table.startedAt} is null
          and ${table.completedAt} is null
          and ${table.failedAt} is null
          and ${table.abortedAt} is null
        )
        or (
          ${table.status} = 'DELIVERY_LEASED'
          and ${table.queueMessageId} is null
          and ${table.leaseExpiresAt} is not null
          and ${table.completedAt} is null
          and ${table.failedAt} is null
          and ${table.abortedAt} is null
        )
        or (
          ${table.status} in ('QUEUED', 'PROCESSING', 'RETRY_WAIT')
          and ${table.completedAt} is null
          and ${table.failedAt} is null
          and ${table.abortedAt} is null
        )
        or (
          ${table.status} = 'COMPLETED'
          and ${table.completedAt} is not null
          and ${table.failedAt} is null
          and ${table.abortedAt} is null
        )
        or (
          ${table.status} in ('FAILED', 'PARTIALLY_COMPLETED')
          and ${table.failedAt} is not null
          and ${table.completedAt} is null
          and ${table.abortedAt} is null
        )
        or (
          ${table.status} = 'ABORTED'
          and ${table.abortedAt} is not null
          and ${table.completedAt} is null
          and ${table.failedAt} is null
        )
      `,
    ),
  ],
);

export const qrAssets = pgTable(
  "qr_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id").notNull(),
    siteId: uuid("site_id").notNull(),
    batchId: uuid("batch_id").notNull(),
    internalUuid: uuid("internal_uuid").defaultRandom().notNull().unique(),
    publicTokenHash: text("public_token_hash").notNull().unique(),
    publicTokenCiphertext: text("public_token_ciphertext").notNull(),
    tokenKeyVersion: integer("token_key_version").notNull(),
    humanCode: text("human_code").notNull().unique(),
    status: qrAssetStatus("status").default("GENERATED").notNull(),
    currentVehicleId: uuid("current_vehicle_id"),
    currentBindingId: uuid("current_binding_id"),
    activatedAt: timestamp("activated_at", { mode: "date", withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    revokeReason: text("revoke_reason"),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.managementCompanyId, table.siteId, table.batchId],
      foreignColumns: [
        qrBatches.tenantId,
        qrBatches.managementCompanyId,
        qrBatches.siteId,
        qrBatches.id,
      ],
      name: "fk_qr_assets_batch",
    }).onDelete("restrict"),
    unique("uq_qr_assets_scope_id").on(
      table.tenantId,
      table.managementCompanyId,
      table.siteId,
      table.batchId,
      table.id,
    ),
    index("idx_qr_assets_tenant_status_created").on(table.tenantId, table.status, table.createdAt),
    index("idx_qr_assets_site_status_created").on(table.siteId, table.status, table.createdAt),
    check("chk_qr_assets_key_version", sql`${table.tokenKeyVersion} >= 1`),
  ],
);

export const qrAssetStatusLogs = pgTable(
  "qr_asset_status_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    managementCompanyId: uuid("management_company_id").notNull(),
    siteId: uuid("site_id").notNull(),
    batchId: uuid("batch_id").notNull(),
    qrAssetId: uuid("qr_asset_id").notNull(),
    fromStatus: qrAssetStatus("from_status"),
    toStatus: qrAssetStatus("to_status").notNull(),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text"),
    actorType: auditActorType("actor_type").notNull(),
    actorId: uuid("actor_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [
        table.tenantId,
        table.managementCompanyId,
        table.siteId,
        table.batchId,
        table.qrAssetId,
      ],
      foreignColumns: [
        qrAssets.tenantId,
        qrAssets.managementCompanyId,
        qrAssets.siteId,
        qrAssets.batchId,
        qrAssets.id,
      ],
      name: "fk_qr_asset_status_logs_asset",
    }).onDelete("restrict"),
    index("idx_qr_asset_status_logs_asset_created").on(table.qrAssetId, table.createdAt),
    check(
      "chk_qr_asset_status_logs_reason_code",
      sql`${table.reasonCode} ~ '^[A-Z0-9][A-Z0-9_]{1,63}$'`,
    ),
  ],
);

export const qrActivationCodes = pgTable(
  "qr_activation_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    qrAssetId: uuid("qr_asset_id").notNull(),
    codeHash: text("code_hash").notNull().unique(),
    codeCiphertext: text("code_ciphertext").notNull(),
    keyVersion: integer("key_version").notNull(),
    status: qrActivationCodeStatus("status").default("ISSUED").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    usedAt: timestamp("used_at", { mode: "date", withTimezone: true }),
    usedByOwnerId: uuid("used_by_owner_id"),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.siteId, table.qrAssetId],
      foreignColumns: [qrAssets.tenantId, qrAssets.siteId, qrAssets.id],
      name: "fk_qr_activation_codes_asset",
    }).onDelete("restrict"),
    unique("uq_qr_activation_codes_tenant_id").on(table.tenantId, table.id),
    unique("uq_qr_activation_codes_asset").on(table.qrAssetId),
    check("chk_qr_activation_codes_hash", sql`${table.codeHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const renderJobs = pgTable(
  "render_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    qrBatchId: uuid("qr_batch_id").notNull(),
    stickerDesignVersionId: uuid("sticker_design_version_id").notNull(),
    jobType: renderJobType("job_type").notNull(),
    renderRevision: integer("render_revision").default(1).notNull(),
    requestedCount: integer("requested_count").notNull(),
    processedCount: integer("processed_count").default(0).notNull(),
    passedCount: integer("passed_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    status: renderJobStatus("status").default("QUEUED").notNull(),
    queueMessageId: text("queue_message_id"),
    idempotencyKey: uuid("idempotency_key").notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    errorSummary: jsonb("error_summary"),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.siteId, table.qrBatchId],
      foreignColumns: [qrBatches.tenantId, qrBatches.siteId, qrBatches.id],
      name: "fk_render_jobs_batch",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.siteId, table.stickerDesignVersionId],
      foreignColumns: [
        stickerDesignVersions.tenantId,
        stickerDesignVersions.siteId,
        stickerDesignVersions.id,
      ],
      name: "fk_render_jobs_design",
    }).onDelete("restrict"),
    unique("uq_render_jobs_tenant_id").on(table.tenantId, table.id),
    unique("uq_render_jobs_idempotency").on(table.tenantId, table.idempotencyKey),
    unique("uq_render_jobs_revision").on(
      table.tenantId,
      table.qrBatchId,
      table.stickerDesignVersionId,
      table.jobType,
      table.renderRevision,
    ),
  ],
);

export const renderedAssets = pgTable(
  "rendered_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    qrAssetId: uuid("qr_asset_id").notNull(),
    stickerDesignVersionId: uuid("sticker_design_version_id").notNull(),
    renderVersion: integer("render_version").notNull(),
    previewPngPath: text("preview_png_path").notNull(),
    printSvgPath: text("print_svg_path").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    qualityStatus: renderQualityStatus("quality_status").default("PENDING").notNull(),
    decodedPublicTokenHash: text("decoded_public_token_hash"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.siteId, table.qrAssetId],
      foreignColumns: [qrAssets.tenantId, qrAssets.siteId, qrAssets.id],
      name: "fk_rendered_assets_qr",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.siteId, table.stickerDesignVersionId],
      foreignColumns: [
        stickerDesignVersions.tenantId,
        stickerDesignVersions.siteId,
        stickerDesignVersions.id,
      ],
      name: "fk_rendered_assets_design",
    }).onDelete("restrict"),
    unique("uq_rendered_assets_version").on(
      table.qrAssetId,
      table.stickerDesignVersionId,
      table.renderVersion,
    ),
    check("chk_rendered_assets_checksum", sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const printExports = pgTable(
  "print_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    qrBatchId: uuid("qr_batch_id").notNull(),
    exportType: printExportType("export_type").notNull(),
    exportRevision: integer("export_revision").default(1).notNull(),
    storagePath: text("storage_path"),
    checksumSha256: text("checksum_sha256"),
    byteSize: bigint("byte_size", { mode: "number" }),
    status: printExportStatus("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.siteId, table.qrBatchId],
      foreignColumns: [qrBatches.tenantId, qrBatches.siteId, qrBatches.id],
      name: "fk_print_exports_batch",
    }).onDelete("restrict"),
    unique("uq_print_exports_revision").on(table.qrBatchId, table.exportType, table.exportRevision),
  ],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    plateLookupHash: text("plate_lookup_hash").notNull(),
    plateCiphertext: text("plate_ciphertext").notNull(),
    plateKeyVersion: integer("plate_key_version").notNull(),
    plateLast4: text("plate_last4").notNull(),
    status: text("status").default("PREASSIGNED").notNull(),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.siteId],
      foreignColumns: [sites.tenantId, sites.id],
      name: "fk_vehicles_site",
    }).onDelete("restrict"),
    unique("uq_vehicles_tenant_id").on(table.tenantId, table.id),
    unique("uq_vehicles_tenant_site_id").on(table.tenantId, table.siteId, table.id),
    unique("uq_vehicles_site_plate_hash").on(table.siteId, table.plateLookupHash),
    check("chk_vehicles_plate_hash", sql`${table.plateLookupHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const qrBindings = pgTable(
  "qr_bindings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    qrAssetId: uuid("qr_asset_id").notNull(),
    vehicleId: uuid("vehicle_id").notNull(),
    ownerId: uuid("owner_id"),
    assignmentMethod: qrAssignmentMethod("assignment_method").notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { mode: "date", withTimezone: true }),
    endedReason: text("ended_reason"),
    isPrimary: boolean("is_primary").default(true).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.siteId, table.qrAssetId],
      foreignColumns: [qrAssets.tenantId, qrAssets.siteId, qrAssets.id],
      name: "fk_qr_bindings_asset",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.siteId, table.vehicleId],
      foreignColumns: [vehicles.tenantId, vehicles.siteId, vehicles.id],
      name: "fk_qr_bindings_vehicle",
    }).onDelete("restrict"),
    unique("uq_qr_bindings_tenant_id").on(table.tenantId, table.id),
    uniqueIndex("uq_qr_active_binding").on(table.qrAssetId).where(sql`${table.endedAt} is null`),
    uniqueIndex("uq_vehicle_primary_active_qr")
      .on(table.vehicleId)
      .where(sql`${table.endedAt} is null and ${table.isPrimary} = true`),
  ],
);

export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    qrBatchId: uuid("qr_batch_id").notNull(),
    qrAssetId: uuid("qr_asset_id"),
    transactionType: inventoryTransactionType("transaction_type").notNull(),
    quantity: integer("quantity").notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.siteId, table.qrBatchId],
      foreignColumns: [qrBatches.tenantId, qrBatches.siteId, qrBatches.id],
      name: "fk_inventory_transactions_batch",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.siteId, table.qrAssetId],
      foreignColumns: [qrAssets.tenantId, qrAssets.siteId, qrAssets.id],
      name: "fk_inventory_transactions_asset",
    }).onDelete("restrict"),
    check("chk_inventory_transactions_quantity", sql`${table.quantity} > 0`),
  ],
);

export const vehicleImports = pgTable(
  "vehicle_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    sourceChecksumSha256: text("source_checksum_sha256").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    rowCount: integer("row_count").notNull(),
    validRowCount: integer("valid_row_count").notNull(),
    invalidRowCount: integer("invalid_row_count").notNull(),
    status: vehicleImportStatus("status").default("VALIDATED").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    committedAt: timestamp("committed_at", { mode: "date", withTimezone: true }),
    originalDeletedAt: timestamp("original_deleted_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    ...commonColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.siteId],
      foreignColumns: [sites.tenantId, sites.id],
      name: "fk_vehicle_imports_site",
    }).onDelete("restrict"),
    unique("uq_vehicle_imports_tenant_id").on(table.tenantId, table.id),
    unique("uq_vehicle_imports_idempotency").on(table.tenantId, table.idempotencyKey),
    unique("uq_vehicle_imports_checksum").on(
      table.tenantId,
      table.siteId,
      table.sourceChecksumSha256,
    ),
  ],
);

export const vehicleImportRows = pgTable(
  "vehicle_import_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    importId: uuid("import_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    plateLookupHash: text("plate_lookup_hash"),
    plateCiphertext: text("plate_ciphertext"),
    plateKeyVersion: integer("plate_key_version"),
    plateLast4: text("plate_last4"),
    qrAssetId: uuid("qr_asset_id"),
    validationCode: text("validation_code"),
    committedBindingId: uuid("committed_binding_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.importId],
      foreignColumns: [vehicleImports.tenantId, vehicleImports.id],
      name: "fk_vehicle_import_rows_import",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.siteId, table.qrAssetId],
      foreignColumns: [qrAssets.tenantId, qrAssets.siteId, qrAssets.id],
      name: "fk_vehicle_import_rows_asset",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.committedBindingId],
      foreignColumns: [qrBindings.tenantId, qrBindings.id],
      name: "fk_vehicle_import_rows_binding",
    }).onDelete("restrict"),
    unique("uq_vehicle_import_rows_number").on(table.importId, table.rowNumber),
  ],
);

export const qrGenerationItems = pgTable(
  "qr_generation_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    siteId: uuid("site_id").notNull(),
    generationJobId: uuid("generation_job_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    qrAssetId: uuid("qr_asset_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.generationJobId],
      foreignColumns: [qrGenerationJobs.tenantId, qrGenerationJobs.id],
      name: "fk_qr_generation_items_job",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.siteId, table.qrAssetId],
      foreignColumns: [qrAssets.tenantId, qrAssets.siteId, qrAssets.id],
      name: "fk_qr_generation_items_asset",
    }).onDelete("restrict"),
    unique("uq_qr_generation_items_ordinal").on(table.generationJobId, table.ordinal),
    unique("uq_qr_generation_items_asset").on(table.generationJobId, table.qrAssetId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "restrict" }),
    siteId: uuid("site_id"),
    actorType: auditActorType("actor_type").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    reason: text("reason"),
    requestId: uuid("request_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.siteId],
      foreignColumns: [sites.tenantId, sites.id],
      name: "fk_audit_logs_tenant_site",
    }).onDelete("restrict"),
    index("idx_audit_logs_tenant_created").on(table.tenantId, table.createdAt),
    index("idx_audit_logs_request").on(table.requestId),
    index("idx_audit_logs_resource").on(table.resourceType, table.resourceId),
    check(
      "chk_audit_logs_redacted_payload",
      sql`app_private.audit_payload_is_safe(${table.beforeData}) and app_private.audit_payload_is_safe(${table.afterData})`,
    ),
  ],
);
