import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { APPROVED_LOGO_SHA256, resolveApprovedLogoSource } from "../lib/approved-brand-assets.mjs";
import { WCJ_CONFIG, WCJ_RULES } from "./config.mjs";

const SOURCE_ROOTS = [
  "apps/web/app",
  "apps/web/components",
  "apps/web/content",
  "apps/web/i18n",
  "apps/web/policies",
  "packages/ui/src",
];
const SOURCE_FILES = ["apps/web/proxy.ts"];
const SOURCE_EXTENSIONS = new Set([".css", ".ts", ".tsx"]);
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return paths.flat();
}

async function loadSources(root) {
  const paths = [
    ...(await Promise.all(SOURCE_ROOTS.map((directory) => walk(resolve(root, directory))))).flat(),
    ...SOURCE_FILES.map((file) => resolve(root, file)),
  ].filter((path) => SOURCE_EXTENSIONS.has(extname(path)));

  return Promise.all(
    paths.map(async (path) => ({
      path: relative(root, path),
      source: await readFile(path, "utf8"),
    })),
  );
}

function finding(ruleId, file, message) {
  const rule = WCJ_RULES.find(({ id }) => id === ruleId);
  if (!rule) {
    throw new Error(`Unknown WCJ rule: ${ruleId}`);
  }
  return { ...rule, file, message };
}

function sourceAt(files, path) {
  return files.find((file) => file.path === path)?.source ?? "";
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function checkStaticRules(files) {
  const findings = [];
  const layout = sourceAt(files, "apps/web/app/[locale]/layout.tsx");
  const pageFiles = files.filter(({ path }) => /apps\/web\/app\/(?:.*\/)?page\.tsx$/u.test(path));
  const css = sourceAt(files, "apps/web/app/globals.css");
  const messages = sourceAt(files, "apps/web/content/messages.ts");
  const semanticHeading = sourceAt(files, "packages/ui/src/components/semantic-heading.tsx");
  const journeyStatus = sourceAt(files, "packages/ui/src/components/journey-status.tsx");
  const journeyState = sourceAt(files, "packages/ui/src/patterns/journey-state.ts");
  const routePolicy = sourceAt(files, "apps/web/policies/route-policy.ts");
  const errorPage = sourceAt(files, "apps/web/app/[locale]/error.tsx");
  const landingPage = sourceAt(files, "apps/web/app/[locale]/(public)/page.tsx");
  const onboardingPage = sourceAt(files, "apps/web/app/[locale]/(public)/onboarding/page.tsx");
  const adminPortalPage = sourceAt(files, "apps/web/app/[locale]/(admin)/admin/page.tsx");
  const adminPortalIntro = sourceAt(files, "apps/web/components/admin-portal-intro.tsx");
  const publicHeader = sourceAt(files, "apps/web/components/public-site-header.tsx");
  const localeModule = sourceAt(files, "apps/web/i18n/locale.ts");
  const localeSwitcher = sourceAt(files, "apps/web/components/locale-switcher.tsx");
  const localeRoute = sourceAt(files, "apps/web/app/api/locale/route.ts");
  const proxy = sourceAt(files, "apps/web/proxy.ts");

  if (!/<html\s+lang=/u.test(layout)) {
    findings.push(
      finding("W001", "apps/web/app/[locale]/layout.tsx", "Missing html lang attribute."),
    );
  }

  for (const file of pageFiles) {
    if (!/<main(?:\s|>)/u.test(file.source)) {
      findings.push(finding("W002", file.path, "Page has no main landmark."));
    }
  }

  for (const file of files.filter(({ path }) => path.endsWith(".tsx"))) {
    const buttons = file.source.matchAll(/<button\b([^>]*)>/gu);
    for (const match of buttons) {
      if (!/\btype=/u.test(match[1])) {
        findings.push(finding("W003", file.path, "Button is missing an explicit type."));
      }
    }
    if (/<(?:div|span)\b[^>]*\bonClick=/u.test(file.source)) {
      findings.push(
        finding("W004", file.path, "Clickable div/span must be a native interactive element."),
      );
    }
    const images = file.source.matchAll(/<img\b([^>]*)>/gu);
    for (const match of images) {
      if (!/\balt=/u.test(match[1])) {
        findings.push(finding("W005", file.path, "Image is missing alt text."));
      }
    }
    if (
      /<(?:input|select|textarea)\b(?![^>]*(?:aria-label|aria-labelledby|id=))[^>]*>/u.test(
        file.source,
      )
    ) {
      findings.push(finding("W006", file.path, "Form control has no detectable accessible name."));
    }
    if (/dangerouslySetInnerHTML/u.test(file.source)) {
      findings.push(finding("W007", file.path, "dangerouslySetInnerHTML is forbidden."));
    }
    if (
      /(?:SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|SMS_API_SECRET)/u.test(
        file.source,
      )
    ) {
      findings.push(finding("W007", file.path, "Server-only secret name appears in UI source."));
    }
  }

  if (!/:focus-visible/u.test(css) || !/@media \(prefers-reduced-motion: reduce\)/u.test(css)) {
    findings.push(
      finding("W008", "apps/web/app/globals.css", "Focus or reduced-motion contract is missing."),
    );
  }

  for (const file of files.filter(
    ({ path }) => path.endsWith(".tsx") && !path.includes("/content/"),
  )) {
    const stripped = file.source
      .replace(/import[\s\S]*?from\s+["'][^"']+["'];?/gu, "")
      .replace(/className=["'][^"']+["']/gu, "")
      .replace(/aria-[a-z-]+=["'][^"']+["']/gu, "");
    if (/[\uac00-\ud7a3]{2,}/u.test(stripped)) {
      findings.push(finding("C001", file.path, "Korean UI copy must be sourced from the catalog."));
    }
  }

  if (
    !/export type MessageDictionary = Record<MessageKey, string>/u.test(messages) ||
    !/as const satisfies MessageDictionary/u.test(messages) ||
    !localeModule.includes("detectLocale") ||
    !proxy.includes('request.headers.get("accept-language")') ||
    !localeSwitcher.includes("/api/locale") ||
    !localeRoute.includes("LOCALE_COOKIE_NAME")
  ) {
    findings.push(
      finding("C002", "apps/web/content/messages.ts", "Locale type contract is missing."),
    );
  }

  if (
    !/lines: readonly \[string, \.\.\.string\[\]\]/u.test(semanticHeading) ||
    !/className="semantic-line"/u.test(semanticHeading)
  ) {
    findings.push(
      finding(
        "C003",
        "packages/ui/src/components/semantic-heading.tsx",
        "Semantic heading line contract is incomplete.",
      ),
    );
  }
  for (const file of pageFiles) {
    if (/<h[1-3][^>]*>[\s\S]*?<br\s*\/?>/u.test(file.source)) {
      findings.push(finding("C003", file.path, "Heading line breaks must use SemanticHeading."));
    }
  }

  const wrappingMarkers = [
    "text-wrap: balance",
    "text-wrap: pretty",
    "word-break: keep-all",
    ".semantic-line",
  ];
  if (wrappingMarkers.some((marker) => !css.includes(marker))) {
    findings.push(
      finding("C004", "apps/web/app/globals.css", "Semantic wrapping CSS markers are incomplete."),
    );
  }

  const rawColorPattern = /#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/iu;
  for (const file of files.filter(
    ({ path }) => path.endsWith(".css") && !path.endsWith("tokens.css"),
  )) {
    if (rawColorPattern.test(file.source)) {
      findings.push(finding("C005", file.path, "Raw colors belong in the token module."));
    }
  }

  for (const marker of ["publicCaller", "owner", "admin", 'bottomNavigation: "hidden"']) {
    if (!routePolicy.includes(marker)) {
      findings.push(
        finding(
          "J001",
          "apps/web/policies/route-policy.ts",
          `Missing route policy marker: ${marker}`,
        ),
      );
    }
  }

  for (const state of [
    "idle",
    "loading",
    "waiting",
    "empty",
    "success",
    "error",
    "retrying",
    "completed",
  ]) {
    if (!journeyState.includes(`"${state}"`)) {
      findings.push(
        finding(
          "J002",
          "packages/ui/src/patterns/journey-state.ts",
          `Missing journey state: ${state}`,
        ),
      );
    }
  }

  for (const marker of ['aria-live="polite"', "aria-busy=", 'role="status"']) {
    if (!journeyStatus.includes(marker)) {
      findings.push(
        finding(
          "J003",
          "packages/ui/src/components/journey-status.tsx",
          `Missing accessible status marker: ${marker}`,
        ),
      );
    }
  }

  if (
    !journeyStatus.includes("requiresRecoveryAction") ||
    !errorPage.includes("reset") ||
    !errorPage.includes("<Button")
  ) {
    findings.push(
      finding("J004", "apps/web/app/[locale]/error.tsx", "Error recovery contract is incomplete."),
    );
  }

  // The public surface introduces the service to callers and vehicle owners. It must not
  // advertise administrator entry: the administrator portal is reached by its own address
  // and protected by server-side authorization, not by hiding or exposing a link.
  const publicSurfaceSources = [
    ["apps/web/app/[locale]/(public)/page.tsx", landingPage],
    ["apps/web/app/[locale]/(public)/onboarding/page.tsx", onboardingPage],
    ["apps/web/components/public-site-header.tsx", publicHeader],
  ];

  for (const [path, source] of publicSurfaceSources) {
    if (source.includes("/admin")) {
      findings.push(
        finding("J005", path, "Public surface must not link to the administrator portal."),
      );
    }
  }

  if (
    !landingPage.includes("<SemanticHeading") ||
    !onboardingPage.includes("<SemanticHeading") ||
    !adminPortalIntro.includes("<SemanticHeading")
  ) {
    findings.push(
      finding(
        "J005",
        "apps/web/components/admin-portal-intro.tsx",
        "Landing, onboarding, and the administrator portal must use semantic heading groups.",
      ),
    );
  }

  // The administrator portal keeps one canonical sign-in; role separation happens on the
  // server after login, never through a separate browser-selected login address.
  if (adminPortalPage.includes("/admin/platform/login")) {
    findings.push(
      finding(
        "J005",
        "apps/web/app/[locale]/(admin)/admin/page.tsx",
        "Administrator portal must keep a single canonical sign-in entry.",
      ),
    );
  }

  return findings;
}

async function checkLogo(root) {
  const sourcePath = await resolveApprovedLogoSource(root);
  const publicPath = resolve(root, "apps/web/public/brand/taptolk-logo.png");
  const [source, published] = await Promise.all([readFile(sourcePath), readFile(publicPath)]);
  if (
    sha256(source) === APPROVED_LOGO_SHA256 &&
    sha256(published) === APPROVED_LOGO_SHA256 &&
    source.equals(published)
  ) {
    return [];
  }
  return [
    finding(
      "C006",
      "apps/web/public/brand/taptolk-logo.png",
      "Logo is not byte-identical to the approved source.",
    ),
  ];
}

function calculateScore(findings) {
  const penalty = { critical: 35, major: 12, minor: 4 };
  const categories = {};

  for (const [category, definition] of Object.entries(WCJ_CONFIG.categories)) {
    const categoryFindings = findings.filter((item) => item.category === category);
    categories[category] = Math.max(
      0,
      100 - categoryFindings.reduce((total, item) => total + penalty[item.severity], 0),
    );
    categories[category] = {
      label: definition.label,
      score: categories[category],
      weight: definition.weight,
    };
  }

  const total = Math.round(
    Object.values(categories).reduce(
      (sum, category) => sum + category.score * (category.weight / 100),
      0,
    ),
  );
  const hasCritical = findings.some(({ severity }) => severity === "critical");
  const categoryPassed = Object.values(categories).every(
    ({ score }) => score >= WCJ_CONFIG.minimumCategoryScore,
  );

  return {
    categories,
    passed: !hasCritical && categoryPassed && total >= WCJ_CONFIG.minimumTotalScore,
    total,
  };
}

export async function runWcj({ root = process.cwd() } = {}) {
  const files = await loadSources(root);
  const findings = [...checkStaticRules(files), ...(await checkLogo(root))];
  return {
    checkedFiles: files.length,
    findings,
    score: calculateScore(findings),
    standard: WCJ_CONFIG.standard,
  };
}

export { calculateScore };
