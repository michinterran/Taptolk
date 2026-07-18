import { type CookieOptionsWithName, createBrowserClient, createServerClient } from "@supabase/ssr";

export interface PublicSupabaseConfiguration {
  publishableKey: string;
  url: string;
}

export interface ServerCookie {
  name: string;
  value: string;
}

export interface ServerCookieToSet extends ServerCookie {
  options: CookieOptionsWithName;
}

export interface ServerCookieStore {
  getAll(): ServerCookie[] | Promise<ServerCookie[]>;
  setAll(cookies: ServerCookieToSet[]): void | Promise<void>;
}

function assertPublicConfiguration(
  configuration: PublicSupabaseConfiguration,
): PublicSupabaseConfiguration {
  if (!URL.canParse(configuration.url)) {
    throw new Error("A valid Supabase URL is required.");
  }
  if (
    !configuration.publishableKey.startsWith("sb_publishable_") ||
    configuration.publishableKey.length < 20
  ) {
    throw new Error("A valid Supabase publishable key is required.");
  }
  return configuration;
}

export function createTaptolkBrowserClient(configuration: PublicSupabaseConfiguration) {
  const config = assertPublicConfiguration(configuration);
  return createBrowserClient(config.url, config.publishableKey);
}

export function createTaptolkServerClient(
  configuration: PublicSupabaseConfiguration,
  cookieStore: ServerCookieStore,
) {
  const config = assertPublicConfiguration(configuration);
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => cookieStore.setAll(cookies),
    },
  });
}
