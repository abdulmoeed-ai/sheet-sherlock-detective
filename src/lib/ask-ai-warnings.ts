const WARNING_LABELS: Record<string, string> = {
  prompt_guardrail_exceeded: "",
  llm_unavailable: "",
  unsupported_claim_removed: "Some unsupported external claims were removed.",
};

export function userFacingAskAiWarnings(warnings: string[] | undefined): string[] {
  const labels = (warnings ?? [])
    .map((warning) => WARNING_LABELS[warning] ?? warning)
    .filter(Boolean);
  return Array.from(new Set(labels));
}
