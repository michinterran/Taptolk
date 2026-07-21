import "server-only";

import { type OperationsDashboardModel, OperationsDashboardService } from "@taptolk/application";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import type { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import { createSupabaseOperationsDashboardRepository } from "./supabase-operations-dashboard-repository";

type ReadyAdminContext = Awaited<ReturnType<typeof requireReadyAdminContext>>;

export async function loadOperationsDashboard(
  context: ReadyAdminContext,
): Promise<OperationsDashboardModel | null> {
  const client = await createAdminServerClient();
  if (!client) {
    return null;
  }

  return new OperationsDashboardService(createSupabaseOperationsDashboardRepository(client)).read({
    actor: {
      authorization: toAdminAuthorizationContext(
        context.decision.membership,
        context.mfaLevel === "aal2",
      ),
      userId: context.userId,
    },
  });
}
