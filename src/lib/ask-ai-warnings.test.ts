import { describe, expect, it } from "vitest";
import { userFacingAskAiWarnings } from "./ask-ai-warnings";

describe("userFacingAskAiWarnings", () => {
  it("hides internal model fallback codes from the analyst", () => {
    expect(
      userFacingAskAiWarnings([
        "prompt_guardrail_exceeded",
        "llm_unavailable",
        "unsupported_numeric_claim",
        "unverified_web_result_used",
      ]),
    ).toEqual([]);
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

  it("maps Tavily transport failures to a generic web-search warning", () => {
    expect(userFacingAskAiWarnings(["tavily_request_failed:ReadTimeout"])).toEqual([
      "Approved web search is temporarily unavailable. Try again in a moment.",
    ]);
    expect(userFacingAskAiWarnings(["external_search_unavailable"])).toEqual([
      "Approved web search is temporarily unavailable. Try again in a moment.",
    ]);
  });
});
