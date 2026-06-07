import type { AskAiModelCandidate, AskAiWorkbookInventoryItem } from "./api/types";

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
      candidate.accessSource === "assigned_inbox" ? "Analysis Requests assignment" : null,
    ].filter(Boolean);
    return `${index + 1}. ${candidate.companyName}${meta.length ? ` - ${meta.join(", ")}` : ""}`;
  });
  return [
    "I found more than one finance model that may match your question.",
    ...lines,
    "Please type the number or name of the model you want me to use.",
  ].join("\n");
}

export function buildWorkbookInventoryPrompt(items: AskAiWorkbookInventoryItem[]): string {
  if (items.length === 0) return "I do not see any accessible workbooks yet.";
  const lines = items.slice(0, 10).map((item, index) => {
    const meta = [
      item.projectLabel || item.fiscalYear,
      item.sector,
      item.status,
      `${item.documentCount} PDF${item.documentCount === 1 ? "" : "s"}`,
      item.workbookAvailable ? "workbook ready" : "workbook not opened yet",
      item.accessSource === "assigned_inbox" ? "Analysis Requests assignment" : null,
    ].filter(Boolean);
    return `${index + 1}. ${item.companyName}${meta.length ? ` - ${meta.join(", ")}` : ""}`;
  });
  return [
    `I found ${items.length} workbook${items.length === 1 ? "" : "s"} you can access.`,
    ...lines,
    "Please type the number or name of the workbook you want me to use.",
  ].join("\n");
}

export function workbookInventoryToModelCandidates(
  items: AskAiWorkbookInventoryItem[],
): AskAiModelCandidate[] {
  return items.map((item, index) => ({
    id: item.projectId,
    companyName: item.companyName,
    projectLabel: item.projectLabel,
    fiscalYear: item.fiscalYear,
    sector: item.sector,
    status: item.status,
    score: Math.max(1, 100 - index),
    matchReason: item.workbookAvailable ? "Workbook available" : "Project available",
    accessSource: item.accessSource,
  }));
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
