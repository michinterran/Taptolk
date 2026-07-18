import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runWcj } from "./core.mjs";

const json = process.argv.includes("--format") && process.argv.includes("json");
const result = await runWcj();

if (json) {
  const path = resolve("wcj-report.json");
  await writeFile(path, `${JSON.stringify(result, null, 2)}\n`);
  console.log(path);
} else {
  console.log(`${result.standard} — ${result.score.passed ? "PASS" : "FAIL"}`);
  console.log(
    `Total ${result.score.total} · ${Object.entries(result.score.categories)
      .map(([key, value]) => `${key} ${value.score}`)
      .join(" · ")} · ${result.checkedFiles} files`,
  );
  for (const item of result.findings) {
    console.error(`[${item.id}/${item.severity}] ${item.file}: ${item.message}`);
  }
}

if (!result.score.passed) {
  process.exitCode = 1;
}
