import { describe, expect, it } from "vitest";
import { userFacingAskAiWarnings } from "./ask-ai-warnings";

describe("userFacingAskAiWarnings", () => {
  it("hides internal model fallback codes from the analyst", () => {
    expect(userFacingAskAiWarnings(["prompt_guardrail_exceeded", "llm_unavailable"])).toEqual([]);
  });
});
