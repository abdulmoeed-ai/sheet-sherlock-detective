const WARNING_LABELS: Record<string, string> = {
  prompt_guardrail_exceeded: "",
  llm_unavailable: "",
  unsupported_numeric_claim: "",
  unverified_web_result_used: "",
  unsupported_claim_removed: "Some unsupported external claims were removed.",
  rag_index_building:
    "PDF search is still being prepared. Ask AI is using workbook context and available project evidence for now.",
  rag_index_failed: "PDF search indexing failed. Ask AI may not include fresh PDF evidence.",
  rag_index_not_ready:
    "PDF search is not ready yet. Ask AI is using currently available project context.",
  rag_index_stale: "PDF search is updating after recent project changes.",
  calculation_not_supported:
    "Calculations over retrieved PDF chunks are not supported yet. Ask AI can retrieve the relevant source lines.",
  external_search_unavailable: "",
};

const PDF_READINESS_WARNINGS = new Set([
  "rag_index_building",
  "rag_index_not_ready",
  "rag_index_stale",
]);

export function userFacingAskAiWarnings(
  warnings: string[] | undefined,
  context: { requestMode?: string | null } = {},
): string[] {
  const labels = (warnings ?? [])
    .filter((warning) => shouldShowWarning(warning, context))
    .map((warning) => warningLabel(warning))
    .filter(Boolean);
  return Array.from(new Set(labels));
}

function warningLabel(warning: string): string {
  if (warning.startsWith("tavily_request_failed:")) {
    return "";
  }
  return WARNING_LABELS[warning] ?? warning;
}

function shouldShowWarning(warning: string, context: { requestMode?: string | null }): boolean {
  if (
    PDF_READINESS_WARNINGS.has(warning) &&
    (context.requestMode === "general_finance" || context.requestMode === "partial_project_context")
  ) {
    return false;
  }
  return true;
}
