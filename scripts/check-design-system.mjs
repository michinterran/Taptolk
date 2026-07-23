/**
 * Taptolk design system gate.
 *
 * A written rule that nothing checks is a rule that gets skipped. Across several
 * sessions the console drifted because screen-specific CSS blocks each restated
 * the same values — 68 rules were defining a card at one point, with padding at
 * 0.85/1/1.1/1.25rem and corners at 0.8/1/2rem. Fixing one screen never fixed the
 * next, and every session rediscovered that the hard way.
 *
 * This gate fails the build when a console rule restates something the tokens
 * already own. It reads `apps/web/app/globals.css`, splits it at the console
 * surface rule block, and holds the screen-specific half to the contract in
 * DESIGN_SYSTEM.md §2.
 *
 * It cannot check whether a screen looks like the canon — only a person can. It
 * checks the mechanical part that kept regressing.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const globalsPath = path.join(root, "apps/web/app/globals.css");
const tokensPath = path.join(root, "packages/ui/src/styles/tokens.css");
const canonDirectory = path.join(root, "docs/design-canon");
const baselinePath = path.join(root, "config/design-system-baseline.json");
const designSystemDoc = path.join(root, "DESIGN_SYSTEM.md");
const publicDirectory = path.join(root, "apps/web/public");

/** The marker that splits screen-specific CSS from the single-definition block. */
const CONSOLE_RULE_MARKER = "Admin console surface rules";

/** Canon files DESIGN_SYSTEM.md §1 promises are present. */
const REQUIRED_CANON = [
  "reference-1-admin-console.png",
  "console-qr-wizard.html",
  "console-shell.html",
  "console-pages.html",
  "console-detail.html",
];

/**
 * Properties the tokens own. A console rule that sets one of these to a literal is
 * re-deciding something the design system already decided.
 */
const TOKEN_OWNED_PROPERTIES = new Set([
  "border-radius",
  "font-size",
  "font-weight",
  "padding",
  "padding-block",
  "padding-inline",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
]);

/**
 * Selectors that legitimately carry their own values because they are not console
 * surfaces: the public site, auth screens, print styles and the primitives that
 * define the system itself.
 */
const EXEMPT_SELECTOR_PATTERN =
  /^(?:\*|:root|html|body|@|\.tt-button|\.tt-badge|\.tt-status-pill|\.semantic-|\.landing|\.public-|\.owner-|\.marketing-|\.tt-auth|\.admin-auth|\.skip-link|\.visually-hidden)/u;

const failures = [];
/**
 * Known drift, recorded so the gate can land red-free while the console is
 * migrated. A baseline entry is a debt, not a permission: the gate fails when a
 * new one appears, and fails again when a recorded one disappears without the
 * baseline being updated, so the list can only shrink.
 */
const observedDrift = new Set();

function fail(message) {
  failures.push(message);
}

/** Strip comments so a documented value is not read as a declaration. */
function stripComments(source) {
  return source.replaceAll(/\/\*[\s\S]*?\*\//gu, "");
}

/**
 * Walk top-level rules, returning `{ selector, body, line }`. Nested at-rules keep
 * their inner rules so a media query cannot smuggle a literal past the gate.
 */
function readRules(source) {
  const rules = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = 0;
  let line = 1;
  let currentSelector = "";
  let currentLine = 1;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\n") {
      line += 1;
    }
    if (character === "{") {
      if (depth === 0) {
        currentSelector = source.slice(selectorStart, index).trim();
        currentLine = currentSelector.startsWith("@")
          ? line
          : line - currentSelector.split("\n").length + 1;
        bodyStart = index + 1;
      }
      depth += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = source.slice(bodyStart, index);
        if (currentSelector.startsWith("@")) {
          rules.push(
            ...readRules(body).map((rule) => ({ ...rule, line: rule.line + currentLine })),
          );
        } else {
          rules.push({ body, line: currentLine, selector: currentSelector });
        }
        selectorStart = index + 1;
      }
    }
  }
  return rules;
}

function readDeclarations(body) {
  return body
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 1) {
        return null;
      }
      return {
        property: declaration.slice(0, separator).trim().toLowerCase(),
        value: declaration.slice(separator + 1).trim(),
      };
    })
    .filter(Boolean);
}

/** A value is compliant when every length in it comes from a token. */
function usesLiteralLength(value) {
  const withoutTokens = value.replaceAll(/var\(--[^)]*\)/gu, "");
  return /(?:^|[\s(,])-?\d*\.?\d+(?:rem|em|px)/u.test(withoutTokens);
}

const [globalsSource, tokensSource, designSystemSource, baselineSource] = await Promise.all([
  readFile(globalsPath, "utf8"),
  readFile(tokensPath, "utf8"),
  readFile(designSystemDoc, "utf8").catch(() => ""),
  readFile(baselinePath, "utf8").catch(() => '{"schemaVersion":1,"entries":[]}'),
]);

let baselineEntries = [];
try {
  const parsed = JSON.parse(baselineSource);
  baselineEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
} catch {
  fail("config/design-system-baseline.json is not valid JSON.");
}
const baseline = new Set(baselineEntries);
const writeBaseline = process.argv.includes("--update-baseline");

if (!designSystemSource) {
  fail("DESIGN_SYSTEM.md is missing; the design system has no written authority.");
}

const markerIndex = globalsSource.indexOf(CONSOLE_RULE_MARKER);
if (markerIndex < 0) {
  fail(
    `apps/web/app/globals.css has no "${CONSOLE_RULE_MARKER}" block; the single-definition rule has nowhere to live.`,
  );
}

const screenSource = stripComments(
  markerIndex < 0 ? globalsSource : globalsSource.slice(0, markerIndex),
);
const screenLineOffset = 0;

for (const rule of readRules(screenSource)) {
  const selectors = rule.selector
    .split(",")
    .map((selector) => selector.trim())
    .filter(Boolean);
  if (
    selectors.length === 0 ||
    selectors.every((selector) => EXEMPT_SELECTOR_PATTERN.test(selector))
  ) {
    continue;
  }
  const isConsoleRule = selectors.some((selector) =>
    /(?:^|\s)\.(?:admin-|operations-|qr-|tt-(?:data-table|stat|side-card|filter-bar|empty-state|sidebar|admin-shell|topbar))/u.test(
      selector,
    ),
  );
  if (!isConsoleRule) {
    continue;
  }
  for (const declaration of readDeclarations(rule.body)) {
    if (!TOKEN_OWNED_PROPERTIES.has(declaration.property)) {
      continue;
    }
    if (!usesLiteralLength(declaration.value)) {
      continue;
    }
    const key = `${selectors.join(",")}|${declaration.property}`;
    observedDrift.add(key);
    if (baseline.has(key)) {
      continue;
    }
    fail(
      `globals.css:${rule.line + screenLineOffset} — "${rule.selector.split("\n")[0].trim()}" sets ${declaration.property}: ${declaration.value}. ` +
        "Console surfaces resolve this from a token (DESIGN_SYSTEM.md §2).",
    );
  }
}

// Card-in-card. The reference never nests a card; it separates with a hairline.
const nestedCardPattern =
  /\.(?:admin-[a-z-]*(?:panel|section|card)|qr-order__panel|operations-[a-z-]*panel)\s+\.(?:tt-side-card|admin-[a-z-]*card)\s*\{[^}]*\bborder\s*:\s*(?!0)/gu;
if (nestedCardPattern.test(stripComments(globalsSource))) {
  fail(
    "A console card draws a border inside another card. Separate with a hairline (DESIGN_SYSTEM.md §2).",
  );
}

// The canon has to exist, and it must not ship.
let canonEntries = [];
try {
  canonEntries = await readdir(canonDirectory);
} catch {
  fail("docs/design-canon/ is missing; there is no visual source of truth to work against.");
}
for (const required of REQUIRED_CANON) {
  if (canonEntries.length > 0 && !canonEntries.includes(required)) {
    fail(`docs/design-canon/${required} is missing (DESIGN_SYSTEM.md §1).`);
  }
}

let publicEntries = [];
try {
  publicEntries = await readdir(publicDirectory);
} catch {
  // A missing public directory is not this gate's concern.
}
for (const entry of publicEntries) {
  if (/^_(?:proto|design-prototype)/u.test(entry)) {
    fail(
      `apps/web/public/${entry} is a prototype in a deployable path. Canon belongs in docs/design-canon/ (DESIGN_SYSTEM.md §1).`,
    );
  }
}

// The tokens the patterns in §3 name have to actually exist.
const REQUIRED_TOKENS = [
  "--tt-table-row-min-height",
  "--tt-table-header-min-height",
  "--tt-table-header-surface",
  "--tt-table-divider-color",
  "--tt-table-font-size",
  "--tt-heading-1-size",
  "--tt-heading-2-size",
  "--tt-heading-3-size",
  "--tt-label-size",
  "--tt-stat-value-size",
  "--tt-numeric-font-variant",
  "--tt-sidebar-width",
  "--tt-sidebar-item-height",
  "--tt-card-padding",
  "--tt-card-radius",
  "--tt-button-height",
];
for (const token of REQUIRED_TOKENS) {
  if (!tokensSource.includes(`${token}:`)) {
    fail(
      `packages/ui/src/styles/tokens.css is missing ${token}, which DESIGN_SYSTEM.md §3 relies on.`,
    );
  }
}

const resolved = baselineEntries.filter((entry) => !observedDrift.has(entry));
if (writeBaseline) {
  const next = { entries: [...observedDrift].sort(), schemaVersion: 1 };
  await writeFile(baselinePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(
    `[design-system] baseline written: ${next.entries.length} recorded violation(s) to migrate.`,
  );
  process.exit(0);
}
if (resolved.length > 0) {
  fail(
    `${resolved.length} baseline entr(ies) no longer exist. Run "corepack pnpm validate:design-system --update-baseline" so the debt list shrinks with the fix.`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[design-system] ${failure}`);
  }
  console.error(
    `[design-system] FAIL — ${failures.length} violation(s). Read DESIGN_SYSTEM.md before changing a console surface.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `[design-system] PASS — no new drift; canon present and undeployed. ${baseline.size} recorded violation(s) still to migrate.`,
  );
}
