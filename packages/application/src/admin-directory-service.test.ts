import { describe, expect, it, vi } from "vitest";
import { type AdminDirectoryRepository, AdminDirectoryService } from "./admin-directory-service.js";

const actor = {
  authorization: {
    mfaVerified: false,
    role: "SUPER_ADMIN" as const,
    scope: { type: "PLATFORM" as const },
  },
  userId: "11111111-1111-4111-8111-111111111111",
};

describe("AdminDirectoryService", () => {
  it("reads the directory after central membership authorization", async () => {
    const repository: AdminDirectoryRepository = { list: vi.fn(async () => []), update: vi.fn() };
    await expect(new AdminDirectoryService(repository).list({ actor })).resolves.toEqual([]);
  });

  it("updates a role in a valid scope", async () => {
    const repository: AdminDirectoryRepository = { list: vi.fn(), update: vi.fn() };
    await new AdminDirectoryService(repository).update({
      actor,
      expectedVersion: 1,
      membershipId: "22222222-2222-4222-8222-222222222222",
      reason: "Operator assignment",
      requestId: "33333333-3333-4333-8333-333333333333",
      role: "PLATFORM_OPERATOR",
      scope: { type: "PLATFORM" },
      status: "ACTIVE",
    });
    expect(repository.update).toHaveBeenCalledOnce();
  });
});
