import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export interface DatabaseClientOptions {
  maxConnections?: number;
}

const DEFAULT_MAX_CONNECTIONS = 5;

export function createDatabaseClient(databaseUrl: string, options: DatabaseClientOptions = {}) {
  const queryClient = postgres(databaseUrl, {
    max: options.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
    prepare: false,
  });

  return {
    db: drizzle(queryClient),
    close: () => queryClient.end(),
  };
}
