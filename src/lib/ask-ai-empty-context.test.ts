import { describe, expect, it } from "vitest";
import { buildNoProjectAskAiResponse } from "./ask-ai-empty-context";

describe("buildNoProjectAskAiResponse", () => {
  it("explains that project or PDF context is needed", () => {
    const response = buildNoProjectAskAiResponse("What changed?");

    expect(response).toContain("active project");
    expect(response).toContain("uploaded PDF context");
    expect(response).toContain("citations");
  });
});
