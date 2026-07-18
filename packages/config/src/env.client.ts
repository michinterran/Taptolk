import { z } from "zod";
import { optionalUrlSchema } from "./env.shared.js";

const clientEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(20).optional(),
  ),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrlSchema,
});

export type ClientEnvironment = z.infer<typeof clientEnvironmentSchema>;

export function parseClientEnvironment(input: Record<string, string | undefined>) {
  return clientEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_ANON_KEY: input.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: input.NEXT_PUBLIC_SUPABASE_URL,
  });
}
