import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const target = resolve(process.argv[2] ?? "apps/web", ".next");

await rm(target, { force: true, recursive: true });
console.log(`[clean] removed ${target}`);
