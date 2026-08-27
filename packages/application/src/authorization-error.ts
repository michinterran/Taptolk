import type { AuthorizationDecision } from "@taptolk/domain";

export class AdminAuthorizationError extends Error {
  readonly code: Exclude<AuthorizationDecision, { allowed: true }>["reason"];

  constructor(code: Exclude<AuthorizationDecision, { allowed: true }>["reason"]) {
    super(`Admin action denied: ${code}`);
    this.name = "AdminAuthorizationError";
    this.code = code;
  }
}

export function assertAdminAuthorized(decision: AuthorizationDecision): void {
  if (!decision.allowed) {
    throw new AdminAuthorizationError(decision.reason);
  }
}
