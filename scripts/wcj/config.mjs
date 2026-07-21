export const WCJ_CONFIG = Object.freeze({
  categories: Object.freeze({
    C: { label: "Content & Consistency", weight: 30 },
    J: { label: "Journey", weight: 30 },
    W: { label: "Web Compliance", weight: 40 },
  }),
  minimumCategoryScore: 80,
  minimumTotalScore: 90,
  standard: "TAPTOLK WCJ 1.0",
});

export const WCJ_RULES = Object.freeze([
  { category: "W", id: "W001", severity: "critical", title: "Document language is declared" },
  { category: "W", id: "W002", severity: "critical", title: "Every page has a main landmark" },
  { category: "W", id: "W003", severity: "major", title: "Buttons declare their type" },
  {
    category: "W",
    id: "W004",
    severity: "critical",
    title: "No clickable non-interactive elements",
  },
  { category: "W", id: "W005", severity: "major", title: "Images have alternative text" },
  { category: "W", id: "W006", severity: "major", title: "Controls retain an accessible name" },
  {
    category: "W",
    id: "W007",
    severity: "critical",
    title: "Unsafe HTML and browser secrets are forbidden",
  },
  { category: "W", id: "W008", severity: "major", title: "Focus and reduced-motion styles exist" },
  { category: "C", id: "C001", severity: "major", title: "UI copy comes from the message catalog" },
  {
    category: "C",
    id: "C002",
    severity: "critical",
    title: "Korean and English catalogs share one contract",
  },
  { category: "C", id: "C003", severity: "major", title: "Headings use semantic line groups" },
  {
    category: "C",
    id: "C004",
    severity: "major",
    title: "Korean wrapping and semantic lines are styled",
  },
  { category: "C", id: "C005", severity: "major", title: "Raw colors stay inside design tokens" },
  {
    category: "C",
    id: "C006",
    severity: "critical",
    title: "Approved logo remains byte-identical",
  },
  {
    category: "J",
    id: "J001",
    severity: "critical",
    title: "Caller, owner, and admin route policies are explicit",
  },
  { category: "J", id: "J002", severity: "major", title: "Shared journey states are complete" },
  { category: "J", id: "J003", severity: "major", title: "Async status is announced accessibly" },
  {
    category: "J",
    id: "J004",
    severity: "critical",
    title: "Errors provide an explicit recovery path",
  },
  {
    category: "J",
    id: "J005",
    severity: "major",
    title: "Public surface excludes administrator entry and roles stay server-decided",
  },
]);
