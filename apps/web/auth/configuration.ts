import "server-only";

import type { PublicSupabaseConfiguration } from "@taptolk/auth";
import { parseClientEnvironment } from "@taptolk/config";

export function readPublicSupabaseConfiguration(): PublicSupabaseConfiguration | null {
  try {
    const environment = parseClientEnvironment({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });

    if (
      !environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      !environment.NEXT_PUBLIC_SUPABASE_URL
    ) {
      return null;
    }

    return {
      publishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      url: environment.NEXT_PUBLIC_SUPABASE_URL,
    };
  } catch {
    return null;
  }
}
