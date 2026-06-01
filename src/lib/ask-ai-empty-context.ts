export function buildNoProjectAskAiResponse(_question: string): string {
  return (
    "I do not have an active project or uploaded PDF context for this chat yet. " +
    "Upload a PDF or open a project first, then I can answer using that document, workbook context, and citations."
  );
}
