export function buildNoProjectAskAiResponse(_question: string): string {
  return (
    "I do not have an active project or uploaded PDF context for this chat yet. " +
    "Upload a PDF or open a project first, then I can answer using that document, workbook context, and citations."
  );
}

export function isWorkbookInventoryQuestion(question: string): boolean {
  const normalized = ` ${question.trim().toLowerCase().replace(/\s+/g, " ")} `;
  if (!normalized.trim()) return false;
  const hasInventoryAction = /\b(list|show|which|what|display|see|available)\b/.test(normalized);
  const hasWorkbookObject =
    /\b(workbook|workbooks|project|projects)\b/.test(normalized) ||
    /\b(excel|finance|financial|uploaded)\s+models?\b/.test(normalized);
  const hasUserScope = /\b(my|mine|i have|i've|accessible|available|uploaded)\b/.test(normalized);
  return hasInventoryAction && hasWorkbookObject && hasUserScope;
}
