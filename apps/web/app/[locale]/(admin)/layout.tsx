import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Administrator surface shell.
 *
 * Keeps the administrator area dynamic so an authenticated response is never served
 * from a shared cache, and keeps the whole area out of search indexes.
 *
 * `noindex` is a discoverability control, not an authorization control. Access is
 * still decided by the server from the approved profile, active membership,
 * role/scope, and MFA state, and independently by PostgreSQL RLS.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
};

export default function AdminGroupLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
