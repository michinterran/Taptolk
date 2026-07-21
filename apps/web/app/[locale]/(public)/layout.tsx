import type { ReactNode } from "react";

/**
 * Public surface shell.
 *
 * Landing, onboarding, QR, caller, and owner journeys render here. This group never
 * loads an administrator context, so an anonymous QR scan does not depend on the
 * administrator authentication provider being reachable.
 *
 * Route groups are invisible in URLs: every path under this group keeps the exact
 * address it had before the split, including the printed `/{locale}/q/{token}` form.
 */
export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
