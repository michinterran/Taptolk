import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const trackedOrUntracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .filter((file) => !file.endsWith(".png"))
  .filter((file) => !file.endsWith("pnpm-lock.yaml"));

const forbidden = [
  {
    label: "Supabase service role JWT",
    pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/u,
  },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/u },
  { label: "database credential", pattern: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/u },
];

const findings = [];

for (const file of trackedOrUntracked) {
  const source = await readFile(file, "utf8").catch(() => "");
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) {
      findings.push(`${file}: ${rule.label}`);
    }
  }
}

if (findings.length > 0) {
  throw new Error(`Potential secrets found:\n${findings.join("\n")}`);
}

console.log(`[secrets] scanned ${trackedOrUntracked.length} text file(s)`);
