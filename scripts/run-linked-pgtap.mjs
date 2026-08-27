import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const testDirectory = path.join(root, "supabase/tests/database");
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "taptolk-linked-pgtap-"));

function captureAllTapLines(source) {
  if (!/^begin;\s*$/mu.test(source) || !/^rollback;\s*$/mu.test(source)) {
    throw new Error("Every linked pgTAP file must use begin and rollback.");
  }
  return source
    .replace(
      /^begin;\s*$/mu,
      "begin;\ncreate temp table __taptolk_tap_results (line text) on commit drop;",
    )
    .replace(/^select /gmu, "insert into __taptolk_tap_results\nselect ")
    .replace(
      /^rollback;\s*$/mu,
      "select line from __taptolk_tap_results order by ctid;\nrollback;",
    );
}

function parseQueryResult(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Supabase linked query returned no JSON result.");
  }
  return JSON.parse(output.slice(start, end + 1));
}

try {
  const testFiles = (await readdir(testDirectory)).filter((file) => file.endsWith(".sql")).sort();
  if (testFiles.length === 0) {
    throw new Error("No pgTAP files were found.");
  }

  for (const testFile of testFiles) {
    const source = await readFile(path.join(testDirectory, testFile), "utf8");
    const planMatch = source.match(/select plan\((\d+)\);/u);
    if (!planMatch) {
      throw new Error(`${testFile} has no fixed pgTAP plan.`);
    }
    const expectedAssertions = Number(planMatch[1]);
    const temporaryFile = path.join(temporaryDirectory, testFile);
    await writeFile(temporaryFile, captureAllTapLines(source), "utf8");

    const execution = spawnSync(
      "corepack",
      ["pnpm", "exec", "supabase", "db", "query", "--linked", "--file", temporaryFile],
      {
        cwd: root,
        encoding: "utf8",
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    if (execution.status !== 0) {
      throw new Error(
        `${testFile} linked execution failed.\n${execution.stderr || execution.stdout}`,
      );
    }

    const result = parseQueryResult(execution.stdout);
    const tapLines = Array.isArray(result.rows)
      ? result.rows
          .map((row) => (row && typeof row.line === "string" ? row.line : ""))
          .filter(Boolean)
      : [];
    const failed = tapLines.filter((line) => line.startsWith("not ok "));
    const passedAssertions = tapLines.filter((line) => /^ok \d+ - /u.test(line));
    const planLine = tapLines.find((line) => line === `1..${expectedAssertions}`);

    if (!planLine || failed.length > 0 || passedAssertions.length !== expectedAssertions) {
      const failureSummary = failed.length > 0 ? failed.join("\n") : "TAP plan/count mismatch";
      throw new Error(`${testFile} failed: ${failureSummary}`);
    }
    console.log(`[linked-pgtap] ${testFile}: ${expectedAssertions}/${expectedAssertions} PASS`);
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
