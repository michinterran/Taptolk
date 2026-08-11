import "server-only";

import { type OperationsWorkQueueModel, OperationsWorkQueueService } from "@taptolk/application";
import { toAdminAuthorizationContext } from "../auth/admin-authorization";
import type { requireReadyAdminContext } from "../auth/page-guard";
import { createAdminServerClient } from "../auth/server-client";
import { createSupabaseOperationsWorkQueueRepository } from "./supabase-operations-work-queue-repository";

type ReadyAdminContext = Awaited<ReturnType<typeof requireReadyAdminContext>>;

export async function loadOperationsWorkQueue(
  context: ReadyAdminContext,
  scope: { managementCompanyId?: string; siteId?: string } = {},
): Promise<OperationsWorkQueueModel | null> {
  const client = await createAdminServerClient();
  if (!client) return null;

  try {
    return await new OperationsWorkQueueService(
      createSupabaseOperationsWorkQueueRepository(client),
    ).read({
      actor: {
        authorization: toAdminAuthorizationContext(
          context.decision.membership,
          context.mfaLevel === "aal2",
        ),
        userId: context.userId,
      },
      scope,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "OPERATIONS_WORK_QUEUE_UNAVAILABLE") {
      return null;
    }
    throw error;
  }
}
