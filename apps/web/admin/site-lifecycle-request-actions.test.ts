import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/page-guard", () => ({
  requireReadyAdminContext: vi.fn(async () => ({})),
}));
vi.mock("../auth/server-client", () => ({
  createAdminServerClient: vi.fn(async () => null),
}));

import { cancelSiteLifecycleRequest, requestSiteLifecycle } from "./site-lifecycle-request-actions";

describe("site lifecycle mutation action results", () => {
  it("returns unavailable instead of redirecting when creating a lifecycle request is unconfigured", async () => {
    const formData = new FormData();
    formData.set("locale", "ko");
    formData.set("siteId", "site-id");

    await expect(requestSiteLifecycle(formData)).resolves.toEqual({
      error: "unavailable",
      status: "error",
    });
  });

  it("returns unavailable when cancelling a lifecycle request is unconfigured", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("siteId", "site-id");

    await expect(cancelSiteLifecycleRequest(formData)).resolves.toEqual({
      error: "unavailable",
      status: "error",
    });
  });
});
