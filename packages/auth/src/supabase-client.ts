import { type CookieOptionsWithName, createBrowserClient, createServerClient } from "@supabase/ssr";

export interface PublicSupabaseConfiguration {
  anonKey: string;
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
  if (configuration.anonKey.length < 20) {
    throw new Error("A valid Supabase anonymous key is required.");
  }
  return configuration;
}

export function createTaptolkBrowserClient(configuration: PublicSupabaseConfiguration) {
  const config = assertPublicConfiguration(configuration);
  return createBrowserClient(config.url, config.anonKey);
}

export function createTaptolkServerClient(
  configuration: PublicSupabaseConfiguration,
  cookieStore: ServerCookieStore,
) {
  const config = assertPublicConfiguration(configuration);
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => cookieStore.setAll(cookies),
    },
  });
}
