const WARNING_LABELS: Record<string, string> = {
  prompt_guardrail_exceeded: "",
  llm_unavailable: "",
  unsupported_claim_removed: "Some unsupported external claims were removed.",
  rag_index_building:
    "PDF search is still being prepared. Ask AI is using workbook context and available project evidence for now.",
  rag_index_failed: "PDF search indexing failed. Ask AI may not include fresh PDF evidence.",
  rag_index_not_ready: "PDF search is not ready yet. Ask AI is using currently available project context.",
  rag_index_stale: "PDF search is updating after recent project changes.",
  calculation_not_supported:
    "Calculations over retrieved PDF chunks are not supported yet. Ask AI can retrieve the relevant source lines.",
};

export function userFacingAskAiWarnings(warnings: string[] | undefined): string[] {
  const labels = (warnings ?? [])
    .map((warning) => WARNING_LABELS[warning] ?? warning)
    .filter(Boolean);
  return Array.from(new Set(labels));
}
