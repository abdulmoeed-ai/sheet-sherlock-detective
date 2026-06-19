export type AskAiRequestProjectContext = {
  companyName?: string | null;
  fiscalYear?: string | null;
  projectLabel?: string | null;
};

export type AskAiRequestDocumentContext = {
  id: string;
};

export function buildAskAiRequestPayload(input: {
  question: string;
  sessionId: string;
  routePath: string | null;
  screenName: string | null;
  documents: AskAiRequestDocumentContext[] | undefined;
  project: AskAiRequestProjectContext | null | undefined;
}) {
  const period = input.project?.projectLabel || input.project?.fiscalYear || null;
  const company = input.project?.companyName || null;
  const forecastRoute = normalizeRoutePath(input.routePath) === "/forecast";
  const documentIds = forecastRoute ? [] : (input.documents?.map((document) => document.id) ?? []);
  const filters = forecastRoute
    ? {}
    : {
        ...(period ? { period } : {}),
        ...(company ? { company } : {}),
      };
  return {
    question: input.question,
    sessionId: input.sessionId,
    routePath: input.routePath,
    screenName: input.screenName,
    documentIds,
    filters,
    includeExternalSources: forecastRoute || shouldUseExternalSources(input.question),
  };
}

export function shouldUseExternalSources(question: string): boolean {
  return /\b(forecast|forcast|predict|prediction|projection|outlook|sector|next\s+\d+\s+years?|market|macro|current|latest|recent|today|rate|rates|price|prices|news|industry|competitor|regulation)\b/i.test(
    question,
  );
}

function normalizeRoutePath(routePath: string | null): string {
  const clean = (routePath || "").trim();
  if (!clean) return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}
