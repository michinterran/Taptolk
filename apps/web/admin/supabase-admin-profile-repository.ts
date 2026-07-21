import "server-only";

import type { AdminProfileRepository } from "@taptolk/application";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

export function createSupabaseAdminProfileRepository(
  client: AdminServerClient,
): AdminProfileRepository {
  return {
    async read() {
      const authResult = await client.auth.getUser();
      const userId = authResult.data.user?.id;
      if (authResult.error || !userId) throw new Error("ADMIN_PROFILE_UNAVAILABLE");
      const result = await client
        .from("admin_profiles")
        .select("display_name, status, version")
        .eq("user_id", userId)
        .single();
      if (result.error || !result.data) throw new Error("ADMIN_PROFILE_UNAVAILABLE");
      return {
        displayName: result.data.display_name,
        status: result.data.status,
        version: result.data.version,
      };
    },
    async update(input) {
      const result = await client.rpc("update_current_admin_profile", {
        p_display_name: input.displayName,
        p_expected_version: input.expectedVersion,
        p_reason: input.reason,
        p_request_id: input.requestId,
      });
      if (result.error) throw new Error("ADMIN_PROFILE_UPDATE_FAILED");
    },
  };
}
