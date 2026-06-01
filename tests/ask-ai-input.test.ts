import { describe, expect, it } from "bun:test";
import { ASK_AI_PROMPT_MAX_HEIGHT, ASK_AI_PROMPT_MIN_HEIGHT, getAskAiPromptKeyAction, getAskAiPromptTextareaLayout } from "../src/lib/ask-ai-input";

describe("Ask AI prompt input", () => {
  it("submits on Enter but keeps Shift+Enter available for multiline prompts", () => {
    expect(getAskAiPromptKeyAction({ key: "Enter", shiftKey: false })).toBe("submit");
    expect(getAskAiPromptKeyAction({ key: "Enter", shiftKey: true })).toBe("newline");
    expect(getAskAiPromptKeyAction({ key: "a", shiftKey: false })).toBe("ignore");
  });

  it("hides the scrollbar until the prompt exceeds the visible multiline area", () => {
    expect(getAskAiPromptTextareaLayout(ASK_AI_PROMPT_MIN_HEIGHT - 4)).toEqual({
      height: ASK_AI_PROMPT_MIN_HEIGHT,
      overflowY: "hidden",
    });
    expect(getAskAiPromptTextareaLayout(ASK_AI_PROMPT_MAX_HEIGHT + 24)).toEqual({
      height: ASK_AI_PROMPT_MAX_HEIGHT,
      overflowY: "auto",
    });
  });
});
