export function getAskAiCitationTitle(citation: Record<string, unknown>): string {
  if (citation.kind === "model") {
    return `${String(citation.sheetName ?? "Model")} ${String(citation.cellReference ?? "")}`.trim();
  }
  if (citation.kind === "uploaded_pdf") {
    return String(citation.filename ?? "Uploaded PDF");
  }
  return String(citation.sourceName ?? citation.kind ?? "Source");
}
