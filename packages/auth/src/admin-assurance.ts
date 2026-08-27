import type { AdminRole } from "@taptolk/domain";
import { roleRequiresMfa } from "@taptolk/domain";

export interface AdminSessionAssurance {
  authenticated: boolean;
  mfaLevel: "aal1" | "aal2" | null;
}

export function hasRequiredAdminAssurance(
  role: AdminRole,
  assurance: AdminSessionAssurance,
): boolean {
  if (!assurance.authenticated) {
    return false;
  }

  return !roleRequiresMfa(role) || assurance.mfaLevel === "aal2";
}
