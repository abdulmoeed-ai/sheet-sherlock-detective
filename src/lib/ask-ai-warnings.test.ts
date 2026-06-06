import { describe, expect, it } from "vitest";
import { userFacingAskAiWarnings } from "./ask-ai-warnings";

describe("userFacingAskAiWarnings", () => {
  it("hides internal model fallback codes from the analyst", () => {
    expect(userFacingAskAiWarnings(["prompt_guardrail_exceeded", "llm_unavailable"])).toEqual([]);
  });

  it("hides pdf readiness warnings for generic finance responses", () => {
    expect(
      userFacingAskAiWarnings(["rag_index_not_ready"], { requestMode: "general_finance" }),
    ).toEqual([]);
  });

  it("hides pdf readiness warnings for partial context final answers", () => {
    expect(
      userFacingAskAiWarnings(["rag_index_building"], { requestMode: "partial_project_context" }),
    ).toEqual([]);
  });
});
