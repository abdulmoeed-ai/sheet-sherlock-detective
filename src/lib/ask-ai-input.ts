export type AskAiPromptKeyAction = "submit" | "newline" | "ignore";
export type AskAiPromptOverflow = "hidden" | "auto";

export const ASK_AI_PROMPT_MIN_HEIGHT = 44;
export const ASK_AI_PROMPT_MAX_HEIGHT = 120;

export function getAskAiPromptKeyAction(event: { key: string; shiftKey: boolean }): AskAiPromptKeyAction {
  if (event.key !== "Enter") return "ignore";
  return event.shiftKey ? "newline" : "submit";
}

export function getAskAiPromptTextareaLayout(scrollHeight: number): { height: number; overflowY: AskAiPromptOverflow } {
  const height = Math.max(ASK_AI_PROMPT_MIN_HEIGHT, Math.min(scrollHeight, ASK_AI_PROMPT_MAX_HEIGHT));
  return {
    height,
    overflowY: scrollHeight > ASK_AI_PROMPT_MAX_HEIGHT ? "auto" : "hidden",
  };
}
