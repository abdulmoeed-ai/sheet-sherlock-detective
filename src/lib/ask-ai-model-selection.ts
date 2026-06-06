import type { AskAiModelCandidate } from "./api/types";

const MODEL_QUERY_PATTERN =
  /\b(model|financial model|workbook|forecast|valuation|projection|statement|balance sheet|income statement|cash flow|company|limited|ltd|fy20\d{2}|20\d{2})\b/i;

export function shouldSearchModelsBeforeAskAi(question: string): boolean {
  const normalized = question.trim();
  if (!normalized) return false;
  return MODEL_QUERY_PATTERN.test(normalized) && /\b[A-Z][A-Za-z]+/.test(normalized);
}

export function buildModelSelectionPrompt(candidates: AskAiModelCandidate[]): string {
  const lines = candidates.slice(0, 5).map((candidate, index) => {
    const meta = [
      candidate.projectLabel || candidate.fiscalYear,
      candidate.sector,
      candidate.accessSource === "assigned_inbox" ? "Inbox assignment" : null,
    ].filter(Boolean);
    return `${index + 1}. ${candidate.companyName}${meta.length ? ` - ${meta.join(", ")}` : ""}`;
  });
  return [
    "I found more than one finance model that may match your question.",
    ...lines,
    "Please type the number or name of the model you want me to use.",
  ].join("\n");
}

export function matchModelSelection(
  input: string,
  candidates: AskAiModelCandidate[],
): AskAiModelCandidate | null {
  const normalized = normalize(input);
  if (!normalized) return null;
  const numeric = Number.parseInt(normalized, 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= candidates.length) {
    return candidates[numeric - 1];
  }
  return (
    candidates.find((candidate) => normalize(candidate.companyName).includes(normalized)) ??
    candidates.find((candidate) => normalized.includes(normalize(candidate.companyName))) ??
    null
  );
}

export function isConfidentSingleModelMatch(candidates: AskAiModelCandidate[]): boolean {
  return candidates.length === 1 && candidates[0].score >= 0.8;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
