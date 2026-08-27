import "server-only";

import type {
  OperationsWorkItem,
  OperationsWorkItemAction,
  OperationsWorkItemKind,
  OperationsWorkQueueModel,
  OperationsWorkQueuePriority,
  OperationsWorkQueueReadRequest,
  OperationsWorkQueueRepository,
  OperationsWorkQueueSource,
  OperationsWorkQueueState,
} from "@taptolk/application";
import type { createAdminServerClient } from "../auth/server-client";

type AdminServerClient = NonNullable<Awaited<ReturnType<typeof createAdminServerClient>>>;

function unavailable(): never {
  throw new Error("OPERATIONS_WORK_QUEUE_UNAVAILABLE");
}

function stringValue(value: unknown): string {
  if (typeof value !== "string") unavailable();
  return value;
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  return stringValue(value);
}

function nullableNumber(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) unavailable();
  return value;
}

function mapKind(value: unknown): OperationsWorkItemKind {
  if (
    value === "CONTACT_REQUEST" ||
    value === "UNANSWERED_CONTACT" ||
    value === "NOTIFICATION_FAILURE" ||
    value === "ESCALATION" ||
    value === "REPORT_REVIEW"
  ) {
    return value;
  }
  return unavailable();
}

function mapState(value: unknown): OperationsWorkQueueState {
  if (
    value === "WAITING" ||
    value === "ACKNOWLEDGED" ||
    value === "ASSIGNED" ||
    value === "IN_PROGRESS" ||
    value === "RESOLVED" ||
    value === "RETRY_PENDING"
  ) {
    return value;
  }
  return unavailable();
}

function mapPriority(value: unknown): OperationsWorkQueuePriority | null {
  if (value === null) return null;
  if (value === "LOW" || value === "NORMAL" || value === "HIGH" || value === "URGENT") {
    return value;
  }
  return unavailable();
}

function mapSource(value: unknown): OperationsWorkQueueSource {
  if (
    value === "CONTACT_SESSIONS" ||
    value === "CONTACT_REPORTS" ||
    value === "NOTIFICATION_DELIVERIES"
  ) {
    return value;
  }
  return unavailable();
}

function mapActions(value: unknown): readonly OperationsWorkItemAction[] {
  if (!Array.isArray(value)) unavailable();
  return value.map((action) => {
    if (action === "OPEN_REPORT" || action === "OPEN_SITE_WORKSPACE") return action;
    return unavailable();
  });
}

function mapItem(value: unknown): OperationsWorkItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) unavailable();
  const row = value as Record<string, unknown>;
  const elapsedSeconds = row.elapsed_seconds;
  if (typeof elapsedSeconds !== "number" || !Number.isInteger(elapsedSeconds)) unavailable();
  const version = row.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) unavailable();
  return {
    actions: mapActions(row.actions),
    assigneeDisplayName: nullableString(row.assignee_display_name),
    createdAt: stringValue(row.created_at),
    elapsedSeconds,
    id: stringValue(row.id),
    kind: mapKind(row.kind),
    queueState: mapState(row.queue_state),
    lastAttemptAt: nullableString(row.last_attempt_at),
    managementCompanyName: stringValue(row.management_company_name),
    priority: mapPriority(row.priority),
    siteId: stringValue(row.site_id),
    siteName: stringValue(row.site_name),
    source: mapSource(row.source),
    sourceStatus: stringValue(row.source_status),
    sourceVersion: nullableNumber(row.source_version),
    version,
    sla: nullableString(row.sla),
  };
}

function mapQueue(value: unknown): OperationsWorkQueueModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) unavailable();
  const row = value as Record<string, unknown>;
  if (typeof row.has_more !== "boolean" || !Array.isArray(row.items)) unavailable();
  return {
    asOf: stringValue(row.as_of),
    hasMore: row.has_more,
    items: row.items.map(mapItem),
    nextCursor: nullableString(row.next_cursor),
  };
}

export function createSupabaseOperationsWorkQueueRepository(
  client: AdminServerClient,
): OperationsWorkQueueRepository {
  return {
    async mutate(input) {
      const { error } = await client.rpc("mutate_operations_work_queue", {
        p_action: input.mutation.type,
        p_assignee_membership_id:
          input.mutation.type === "ASSIGN" ? (input.mutation.assigneeMembershipId ?? null) : null,
        p_expected_version: input.mutation.expectedVersion,
        p_item_id: input.mutation.itemId,
        p_item_kind: input.mutation.kind,
        p_reason: input.mutation.reason,
        p_request_id: input.mutation.requestId,
      });
      if (error) throw new Error("OPERATIONS_WORK_QUEUE_MUTATION_UNAVAILABLE");
      return this.read({ actor: input.actor, scope: input.scope });
    },
    async read(input: OperationsWorkQueueReadRequest) {
      const { data, error } = await client.rpc("read_operations_work_queue_with_state", {
        p_cursor: null,
        p_limit: 100,
        p_management_company_id: input.scope.managementCompanyId ?? null,
        p_site_id: input.scope.siteId ?? null,
      });
      if (error) throw new Error("OPERATIONS_WORK_QUEUE_UNAVAILABLE");
      return mapQueue(data);
    },
  };
}
