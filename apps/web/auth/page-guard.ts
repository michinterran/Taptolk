import "server-only";

import type { AdminAccessDecision } from "@taptolk/auth";
import { redirect } from "next/navigation";
import type { AppLocale } from "../i18n/config";
import { loadAdminContext } from "./admin-context";
import { getAdminDecisionPath, getLocalizedAdminPath } from "./admin-routing";

export async function requireReadyAdminContext(locale: AppLocale): Promise<{
  decision: Extract<AdminAccessDecision, { state: "READY" }>;
  email: string | null;
  mfaLevel: "aal1" | "aal2" | null;
}> {
  const context = await loadAdminContext();
  if (context.status === "CONFIGURATION_MISSING") {
    redirect(getLocalizedAdminPath(locale, "/login?error=configuration"));
  }
  if (context.status === "LOAD_ERROR") {
    throw new Error("Unable to load the authenticated admin context.");
  }
  if (context.decision.state !== "READY") {
    redirect(getAdminDecisionPath(locale, context.decision));
  }

  return {
    decision: context.decision,
    email: context.email,
    mfaLevel: context.mfaLevel,
  };
}
