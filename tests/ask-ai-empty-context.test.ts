import { describe, expect, it } from "bun:test";
import { buildNoProjectAskAiResponse } from "../src/lib/ask-ai-empty-context";

describe("Ask AI empty project context", () => {
  it("does not return canned finance assumptions when no project or PDF is available", () => {
    const response = buildNoProjectAskAiResponse("do you have context of the current pdf?");

    expect(response).toContain("I do not have an active project or uploaded PDF context");
    expect(response).not.toContain("KIBOR");
    expect(response).not.toContain("Tractor unit sales CAGR");
  });
});
