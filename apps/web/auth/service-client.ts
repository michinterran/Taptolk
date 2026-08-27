import "server-only";

import { createTaptolkAdminClient } from "@taptolk/auth";
import { readSecretSupabaseConfiguration } from "./configuration";

export function createAdminServiceClient() {
  const configuration = readSecretSupabaseConfiguration();
  return configuration ? createTaptolkAdminClient(configuration) : null;
}
