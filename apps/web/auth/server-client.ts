import "server-only";

import { createTaptolkServerClient } from "@taptolk/auth";
import { cookies } from "next/headers";
import { readPublicSupabaseConfiguration } from "./configuration";

export async function createAdminServerClient() {
  const configuration = readPublicSupabaseConfiguration();
  if (!configuration) {
    return null;
  }

  const cookieStore = await cookies();

  return createTaptolkServerClient(configuration, {
    getAll: () => cookieStore.getAll(),
    setAll: async (cookiesToSet) => {
      try {
        for (const { name, options, value } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Server Components cannot always persist refreshed cookies.
        // The proxy refresh path handles writable request/response cookies.
      }
    },
  });
}
