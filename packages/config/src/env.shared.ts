import { z } from "zod";

export const appEnvironmentSchema = z.enum(["local", "staging", "production"]);

export const emptyStringToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const optionalUrlSchema = z.preprocess(emptyStringToUndefined, z.string().url().optional());

export const optionalSecretSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().min(24).optional(),
);

export function integerEnvironmentSchema(defaultValue: number, minimum = 1) {
  return z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(minimum).default(defaultValue),
  );
}
