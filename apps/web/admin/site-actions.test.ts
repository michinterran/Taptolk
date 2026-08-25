import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/page-guard", () => ({
  requireReadyAdminContext: vi.fn(async () => ({})),
}));
vi.mock("../auth/server-client", () => ({
  createAdminServerClient: vi.fn(async () => null),
}));

import {
  changeSiteStatus,
  createSite,
  updateSiteContract,
  updateSiteOperational,
} from "./site-actions";

describe("site mutation action results", () => {
  it("returns validation when a direct status change is incomplete", async () => {
    const formData = new FormData();
    formData.set("locale", "ko");
    formData.set("currentStatus", "ACTIVE");

    await expect(changeSiteStatus(formData)).resolves.toEqual({
      error: "validation",
      status: "error",
    });
  });

  it("returns unavailable instead of redirecting when site creation is unconfigured", async () => {
    const formData = new FormData();
    formData.set("locale", "ko");
    formData.set("parentScope", "tenant-id|company-id");

    await expect(createSite(formData)).resolves.toEqual({
      error: "unavailable",
      status: "error",
    });
  });

  it("returns unavailable for operational and contract updates when the client is missing", async () => {
    const operationalForm = new FormData();
    operationalForm.set("locale", "en");
    operationalForm.set("siteId", "site-id");

    const contractForm = new FormData();
    contractForm.set("locale", "en");
    contractForm.set("siteId", "site-id");

    await expect(updateSiteOperational(operationalForm)).resolves.toEqual({
      error: "unavailable",
      status: "error",
    });
    await expect(updateSiteContract(contractForm)).resolves.toEqual({
      error: "unavailable",
      status: "error",
    });
  });
});
