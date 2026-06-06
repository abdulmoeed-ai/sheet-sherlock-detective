import { describe, expect, it } from "vitest";
import { buildNoProjectAskAiResponse, isWorkbookInventoryQuestion } from "./ask-ai-empty-context";

describe("buildNoProjectAskAiResponse", () => {
  it("explains that project or PDF context is needed", () => {
    const response = buildNoProjectAskAiResponse("What changed?");

    expect(response).toContain("active project");
    expect(response).toContain("uploaded PDF context");
    expect(response).toContain("citations");
  });
});

describe("isWorkbookInventoryQuestion", () => {
  it("detects workbook and project inventory prompts", () => {
    expect(isWorkbookInventoryQuestion("can you list down my workbooks?")).toBe(true);
    expect(isWorkbookInventoryQuestion("can you list down my projects I've?")).toBe(true);
    expect(isWorkbookInventoryQuestion("which excel models do I have")).toBe(true);
  });

  it("does not classify ordinary no-context finance questions as inventory prompts", () => {
    expect(isWorkbookInventoryQuestion("what is working capital?")).toBe(false);
    expect(isWorkbookInventoryQuestion("how do I upload a PDF?")).toBe(false);
  });
});
