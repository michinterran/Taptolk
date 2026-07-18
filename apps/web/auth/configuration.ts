import "server-only";

import type { PublicSupabaseConfiguration, SecretSupabaseConfiguration } from "@taptolk/auth";
import { parseClientEnvironment, parseServerEnvironment } from "@taptolk/config";

export function readAppUrl(): string | null {
  try {
    return parseServerEnvironment().APP_URL ?? null;
  } catch {
    return null;
  }
}

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

export function readSecretSupabaseConfiguration(): SecretSupabaseConfiguration | null {
  try {
    const serverEnvironment = parseServerEnvironment();
    const publicEnvironment = parseClientEnvironment({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });

    if (!serverEnvironment.SUPABASE_SECRET_KEY || !publicEnvironment.NEXT_PUBLIC_SUPABASE_URL) {
      return null;
    }

    return {
      secretKey: serverEnvironment.SUPABASE_SECRET_KEY,
      url: publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    };
  } catch {
    return null;
  }
}
