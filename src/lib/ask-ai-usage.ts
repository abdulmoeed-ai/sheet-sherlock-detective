export function askAiTokenUsageLabel({
  usage,
  estimatedTokens,
  done,
}: {
  usage: Record<string, unknown> | undefined;
  estimatedTokens: number;
  done: boolean;
}): string {
  const totalTokens = numberValue(usage?.totalTokens ?? usage?.total_tokens);
  if (totalTokens !== null) {
    return `${usage?.estimated === true ? "~" : ""}${totalTokens.toLocaleString()} tokens`;
  }
  if (done) {
    return "token usage unavailable";
  }
  return `~${estimatedTokens.toLocaleString()} tokens`;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim()))
    return Number.parseInt(value.trim(), 10);
  return null;
}
