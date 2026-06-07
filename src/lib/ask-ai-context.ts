const GENERIC_SUGGESTIONS = [
  "Summarize what I should review on this screen",
  "What information is available for this workflow?",
  "What can you help me analyze once I select a project or upload evidence?",
];

const DIAGNOSIS_SUGGESTIONS = [
  "Why doesn't my balance sheet balance?",
  "Explain the key drivers of revenue in this model",
  "What are the biggest risks in this financial model?",
];

const FORECAST_SUGGESTIONS = [
  "Build a 5-year Revenue, PAT, and EPS forecast for a company I specify",
  "Use approved web sources to identify forecast drivers and risks",
  "Compare base, upside, and downside scenarios with defensible assumptions",
];

export function askAiSuggestionsForRoute(routePath: string): string[] {
  const normalized = normalizeRoutePath(routePath);
  if (normalized === "/forecast") return FORECAST_SUGGESTIONS;
  return normalized.startsWith("/diagnosis/") ? DIAGNOSIS_SUGGESTIONS : GENERIC_SUGGESTIONS;
}

const PROJECT_CONTEXT_ROUTE_PREFIXES = ["/diagnosis/", "/ingestion/"];
const PROJECT_CONTEXT_ROUTES = new Set([
  "/assumptions",
  "/audit",
  "/review",
  "/sign-off",
]);

export function shouldUseProjectContextForRoute(routePath: string): boolean {
  const normalized = normalizeRoutePath(routePath);
  return (
    PROJECT_CONTEXT_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
    PROJECT_CONTEXT_ROUTES.has(normalized)
  );
}

export function buildAskAiSubtitleParts(input: {
  company: string | null | undefined;
  screenName: string | null | undefined;
  period: string | null | undefined;
}): string[] {
  return [input.company, input.screenName, input.period].filter(isPresent);
}

export function buildAskAiContextChips(input: {
  company: string | null | undefined;
  period: string | null | undefined;
  sector: string | null | undefined;
  documentCount: number | undefined;
  isDiagnosis: boolean;
  screenName?: string | null | undefined;
}): string[] {
  const parts = [
    input.period,
    input.company,
    input.sector ? `${input.sector} sector` : null,
  ].filter(isPresent);

  if (typeof input.documentCount === "number") {
    parts.push(`${input.documentCount} PDF${input.documentCount === 1 ? "" : "s"}`);
  }
  if (input.isDiagnosis) {
    parts.push("Diagnosis workbook open");
  }
  if (parts.length === 0 && input.screenName) {
    parts.push(input.screenName);
  }
  return parts;
}

function isPresent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeRoutePath(routePath: string): string {
  const clean = routePath.trim();
  if (!clean) return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}
