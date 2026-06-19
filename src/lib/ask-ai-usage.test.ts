import { describe, expect, it } from "vitest";
import { askAiTokenUsageLabel } from "@/lib/ask-ai-usage";

describe("askAiTokenUsageLabel", () => {
  it("uses backend total token usage when available", () => {
    expect(
      askAiTokenUsageLabel({ usage: { totalTokens: 192 }, estimatedTokens: 359, done: true }),
    ).toBe("192 tokens");
  });

  it("marks saved estimated backend token usage", () => {
    expect(
      askAiTokenUsageLabel({
        usage: { totalTokens: 192, estimated: true },
        estimatedTokens: 359,
        done: true,
      }),
    ).toBe("~192 tokens");
  });

  it("marks in-progress estimates when backend usage is not available yet", () => {
    expect(askAiTokenUsageLabel({ usage: {}, estimatedTokens: 359, done: false })).toBe(
      "~359 tokens",
    );
  });

  it("does not show estimated tokens as final backend usage", () => {
    expect(askAiTokenUsageLabel({ usage: {}, estimatedTokens: 359, done: true })).toBe(
      "token usage unavailable",
    );
  });
});
